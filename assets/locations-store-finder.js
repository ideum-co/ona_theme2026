const HTMLElementBase = globalThis.HTMLElement ?? class {};
const EARTH_RADIUS_KM = 6371;
let mapsPromise;

function coordinate(value, minimum, maximum) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

export function hasCoordinates(location) {
  return coordinate(location?.latitude, -90, 90) !== null && coordinate(location?.longitude, -180, 180) !== null;
}

export function locationsWithCoordinates(locations) {
  return locations.filter(hasCoordinates);
}

export function resolveMapUiState(currentState, locations, noCoordinatesStatus) {
  const markerCount = locationsWithCoordinates(locations).length;
  if (markerCount === 0) {
    return { view: 'list', status: noCoordinatesStatus, markerCount };
  }

  return {
    view: currentState.view,
    status: currentState.status === noCoordinatesStatus ? '' : currentState.status,
    markerCount,
  };
}

export function distanceBetweenKm(origin, destination) {
  if (!hasCoordinates(origin) || !hasCoordinates(destination)) return Number.POSITIVE_INFINITY;

  const latitudeDelta = ((Number(destination.latitude) - Number(origin.latitude)) * Math.PI) / 180;
  const longitudeDelta = ((Number(destination.longitude) - Number(origin.longitude)) * Math.PI) / 180;
  const originLatitude = (Number(origin.latitude) * Math.PI) / 180;
  const destinationLatitude = (Number(destination.latitude) * Math.PI) / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

export function radiusForFilter(origin, radiusValue) {
  if (!hasCoordinates(origin) || radiusValue === null || radiusValue === '') return 0;
  const radiusKm = Number(radiusValue);
  return Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 0;
}

export function filterLocations(locations, criteria = {}) {
  const query = String(criteria.query ?? '').trim().toLocaleLowerCase();
  const state = String(criteria.state ?? '').trim().toLocaleLowerCase();
  const tag = String(criteria.tag ?? '').trim().toLocaleLowerCase();
  const radiusKm = Number(criteria.radiusKm);
  const usesDistance = hasCoordinates(criteria.origin) && Number.isFinite(radiusKm) && radiusKm > 0;

  return locations.filter((location) => {
    const searchableText = [location.title, location.address, location.suburb, location.state]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();
    const locationState = String(location.state ?? '').trim().toLocaleLowerCase();
    const locationTags = Array.isArray(location.tags)
      ? location.tags.map((value) => String(value).trim().toLocaleLowerCase())
      : [];

    if (query && !searchableText.includes(query)) return false;
    if (state && locationState !== state) return false;
    if (tag && !locationTags.includes(tag)) return false;
    if (usesDistance && distanceBetweenKm(criteria.origin, location) > radiusKm) return false;
    return true;
  });
}

export function buildGoogleMapsUrl(apiKey) {
  const key = String(apiKey ?? '').trim();
  if (!key) return null;
  const parameters = new URLSearchParams({ key, v: 'weekly', loading: 'async' });
  return `https://maps.googleapis.com/maps/api/js?${parameters.toString()}`;
}

export function buildSectionRenderingUrl(nextPageUrl, sectionId, baseUrl = globalThis.location?.href) {
  if (!nextPageUrl) return null;
  const url = new URL(nextPageUrl, baseUrl);
  url.searchParams.set('section_id', sectionId);
  return url.toString();
}

export function buildFirstLocationPageUrl(currentPageUrl, baseUrl = globalThis.location?.href) {
  const url = new URL(currentPageUrl, baseUrl);
  url.searchParams.delete('page');
  url.searchParams.delete('section_id');
  url.hash = '';
  return url.toString();
}

function locationIdentity(location) {
  const identity = String(location?.id ?? '').trim();
  return identity || null;
}

function validateLocationPage(page) {
  if (!page || !Array.isArray(page.locations) || !Array.isArray(page.cards)) {
    throw new Error('The location page payload is invalid.');
  }
  if (page.locations.length !== page.cards.length) {
    throw new Error('Location records and cards are not aligned.');
  }
}

export async function loadAllLocationPages(initialPage, loadPage) {
  validateLocationPage(initialPage);
  const locations = [...initialPage.locations];
  const cards = [...initialPage.cards];
  const knownLocationIds = new Set(locations.map(locationIdentity).filter(Boolean));
  const visitedUrls = new Set();
  let nextPageUrl = initialPage.nextPageUrl || '';

  while (nextPageUrl) {
    if (visitedUrls.has(nextPageUrl)) {
      throw new Error(`Location pagination returned a repeated pagination URL: ${nextPageUrl}`);
    }
    visitedUrls.add(nextPageUrl);
    const page = await loadPage(nextPageUrl);
    validateLocationPage(page);

    page.locations.forEach((location, index) => {
      const identity = locationIdentity(location);
      if (identity && knownLocationIds.has(identity)) return;
      if (identity) knownLocationIds.add(identity);
      locations.push(location);
      cards.push(page.cards[index]);
    });
    nextPageUrl = page.nextPageUrl || '';
  }

  return { locations, cards };
}

export function readFinderPage(finder) {
  if (!finder) throw new Error('The location finder section is missing from the response.');
  const payload = finder.querySelector('[data-locations-store-finder-data]');
  if (!payload) throw new Error('The location finder payload is missing from the response.');
  const config = JSON.parse(payload.textContent || '{}');
  const page = {
    locations: Array.isArray(config.locations) ? config.locations : [],
    cards: [...finder.querySelectorAll('[data-location-card]')],
    nextPageUrl: finder.dataset.nextPageUrl || '',
  };
  validateLocationPage(page);
  page.locations.forEach((location, index) => {
    const recordIdentity = locationIdentity(location) ?? '';
    const cardIdentity = String(page.cards[index]?.dataset?.locationId ?? '').trim();
    if (recordIdentity !== cardIdentity) {
      throw new Error('A location record and card have different stable identity values.');
    }
  });
  return page;
}

export function loadGoogleMaps(apiKey, documentObject = globalThis.document) {
  if (!apiKey) {
    return null;
  }
  if (globalThis.google?.maps) return Promise.resolve(globalThis.google.maps);
  if (!documentObject) return Promise.reject(new Error('A document is required to load Google Maps.'));
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    let existingScript = documentObject.querySelector('script[data-locations-google-maps]');
    if (existingScript && existingScript.dataset.locationsGoogleMapsState !== 'loading') {
      existingScript.remove();
      existingScript = null;
    }
    const script = existingScript ?? documentObject.createElement('script');
    const removeListeners = () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };
    const rejectLoad = (error) => {
      removeListeners();
      script.dataset.locationsGoogleMapsState = 'failed';
      script.remove();
      mapsPromise = undefined;
      reject(error);
    };
    const handleLoad = () => {
      if (globalThis.google?.maps) {
        removeListeners();
        script.dataset.locationsGoogleMapsState = 'ready';
        resolve(globalThis.google.maps);
      } else {
        rejectLoad(new Error('Google Maps loaded without the Maps API.'));
      }
    };
    const handleError = () => {
      rejectLoad(new Error('Google Maps failed to load.'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    if (!existingScript) {
      script.src = buildGoogleMapsUrl(apiKey);
      script.async = true;
      script.dataset.locationsGoogleMaps = '';
      script.dataset.locationsGoogleMapsState = 'loading';
      documentObject.head.append(script);
    }
  });

  return mapsPromise;
}

export class LocationsStoreFinder extends HTMLElementBase {
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;

    const payload = this.querySelector('[data-locations-store-finder-data]');
    try {
      this.config = JSON.parse(payload?.textContent || '{}');
    } catch {
      this.setStatus('Location details could not be loaded. The original list remains available.');
      return;
    }

    this.locations = Array.isArray(this.config.locations) ? this.config.locations : [];
    this.settings = this.config.settings ?? {};
    this.cards = [...this.querySelectorAll('[data-location-card]')];
    this.searchInput = this.querySelector('[data-location-search]');
    this.stateFilter = this.querySelector('[data-state-filter]');
    this.tagFilter = this.querySelector('[data-tag-filter]');
    this.radiusFilter = this.querySelector('[data-radius-filter]');
    this.locationButton = this.querySelector('[data-use-location]');
    this.resetButton = this.querySelector('[data-reset-filters]');
    this.resultCount = this.querySelector('[data-result-count]');
    this.emptyState = this.querySelector('[data-no-results]');
    this.locationList = this.querySelector('[data-location-list]');
    this.mapPanel = this.querySelector('[data-map-panel]');
    this.mapElement = this.querySelector('[data-location-map]');
    this.pagination = this.querySelector('[data-fallback-pagination]');
    this.viewButtons = [...this.querySelectorAll('[data-view]')];
    this.origin = null;
    this.map = null;
    this.markers = [];
    this.visibleLocations = [...this.locations];

    if (this.locations.length !== this.cards.length) {
      this.setStatus('Location filters are unavailable. The complete location list remains available.');
      return;
    }

    this.populateStateFilter();
    this.bindEvents();
    this.applyFilters();

    if (!String(this.settings.mapsApiKey ?? '').trim()) {
      this.setStatus(this.settings.noMapKeyStatus);
    }

    if (this.settings.defaultView === 'map') {
      this.setView('map');
    } else {
      this.showListView();
    }

    this.loadRemainingLocationPages().catch(() => {
      this.setStatus(
        this.settings.paginationErrorStatus ||
          'Additional locations could not be loaded. Use the result page links to continue browsing.',
      );
    });
  }

  populateStateFilter() {
    if (!this.stateFilter) return;
    const firstOption = this.stateFilter.options[0];
    const selectedState = this.stateFilter.value;
    const states = [...new Set(this.locations.map(({ state }) => String(state ?? '').trim()).filter(Boolean))].sort(
      (first, second) => first.localeCompare(second),
    );

    this.stateFilter.replaceChildren(firstOption);
    for (const state of states) {
      const option = this.ownerDocument.createElement('option');
      option.value = state;
      option.textContent = state;
      this.stateFilter.append(option);
    }
    if (states.includes(selectedState)) this.stateFilter.value = selectedState;
  }

  bindEvents() {
    this.searchInput?.addEventListener('input', () => this.applyFilters());
    this.stateFilter?.addEventListener('change', () => this.applyFilters());
    this.tagFilter?.addEventListener('change', () => this.applyFilters());
    this.radiusFilter?.addEventListener('change', () => this.applyFilters());
    this.locationButton?.addEventListener('click', () => this.useCurrentLocation());
    this.resetButton?.addEventListener('click', () => this.resetFilters());
    for (const button of this.viewButtons) {
      button.addEventListener('click', () => this.setView(button.dataset.view));
    }
  }

  currentCriteria() {
    return {
      query: this.searchInput?.value ?? '',
      state: this.stateFilter?.value ?? '',
      tag: this.tagFilter?.value ?? '',
      origin: this.origin,
      radiusKm: radiusForFilter(this.origin, this.radiusFilter?.value ?? null),
    };
  }

  applyFilters() {
    const criteria = this.currentCriteria();
    this.visibleLocations = filterLocations(this.locations, criteria);
    const visibleSet = new Set(this.visibleLocations);

    this.cards.forEach((card, index) => {
      card.hidden = !visibleSet.has(this.locations[index]);
      const distance = card.querySelector('[data-location-distance]');
      if (!distance) return;
      const distanceKm = distanceBetweenKm(this.origin, this.locations[index]);
      distance.textContent = Number.isFinite(distanceKm) ? `${distanceKm < 100 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km` : '';
    });

    if (this.resultCount) {
      const count = this.visibleLocations.length;
      this.resultCount.textContent = `${count} ${count === 1 ? 'location' : 'locations'}`;
    }
    if (this.emptyState) this.emptyState.hidden = this.visibleLocations.length !== 0;
    if (this.resetButton) this.resetButton.hidden = !this.hasActiveFilters();
    const mapUiState = resolveMapUiState(
      { view: this.activeView ?? 'list', status: this.statusText() },
      this.visibleLocations,
      this.settings.noCoordinatesStatus,
    );
    if (mapUiState.view !== (this.activeView ?? 'list')) {
      this.applyViewState(mapUiState.view);
      this.setStatus(mapUiState.status);
    } else if (mapUiState.markerCount > 0 && mapUiState.status !== this.statusText()) {
      this.setStatus(mapUiState.status);
    }
    if (this.map) this.syncMapMarkers();
  }

  async loadRemainingLocationPages() {
    const nextPageUrl = this.dataset.nextPageUrl;
    const currentPage = Number.parseInt(this.dataset.currentPage, 10) || 1;
    if ((!nextPageUrl && currentPage === 1) || !this.locationList) return;

    const initialPage =
      currentPage > 1
        ? await this.fetchLocationPage(
            buildFirstLocationPageUrl(this.ownerDocument?.location?.href ?? globalThis.location?.href),
          )
        : { locations: this.locations, cards: this.cards, nextPageUrl };
    const aggregated = await loadAllLocationPages(
      initialPage,
      (url) => this.fetchLocationPage(url),
    );
    const fragment = this.ownerDocument.createDocumentFragment();
    aggregated.cards.forEach((card, index) => {
      card.dataset.locationIndex = String(index);
      fragment.append(card);
    });

    this.locationList.replaceChildren(fragment);
    this.locations = aggregated.locations;
    this.cards = aggregated.cards;
    this.populateStateFilter();
    this.applyFilters();
    if (this.pagination) this.pagination.hidden = true;

    if (this.requestedView === 'map' && this.activeView !== 'map') {
      await this.setView('map');
    }
  }

  async fetchLocationPage(nextPageUrl) {
    const url = buildSectionRenderingUrl(nextPageUrl, this.dataset.sectionId, globalThis.location.href);
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!response.ok) throw new Error(`Location page request failed with status ${response.status}.`);

    const html = new DOMParser().parseFromString(await response.text(), 'text/html');
    return readFinderPage(html.querySelector('locations-store-finder'));
  }

  hasActiveFilters() {
    return Boolean(
      this.searchInput?.value || this.stateFilter?.value || this.tagFilter?.value || this.origin,
    );
  }

  resetFilters() {
    if (this.searchInput) this.searchInput.value = '';
    if (this.stateFilter) this.stateFilter.value = '';
    if (this.tagFilter) this.tagFilter.value = '';
    if (this.radiusFilter) this.radiusFilter.value = String(this.settings.defaultRadius ?? '50');
    this.origin = null;
    this.setStatus('');
    this.applyFilters();
  }

  useCurrentLocation() {
    if (!globalThis.navigator?.geolocation) {
      this.setStatus(this.settings.geolocationErrorStatus);
      return;
    }

    this.locationButton.disabled = true;
    this.setStatus(this.settings.geolocationPendingStatus);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.origin = { latitude: coords.latitude, longitude: coords.longitude };
        this.locationButton.disabled = false;
        this.setStatus(this.settings.geolocationSuccessStatus);
        this.applyFilters();
        this.map?.setCenter({ lat: coords.latitude, lng: coords.longitude });
      },
      () => {
        this.locationButton.disabled = false;
        this.setStatus(this.settings.geolocationErrorStatus);
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 },
    );
  }

  async setView(view) {
    this.requestedView = view;
    if (view !== 'map') {
      this.showListView();
      return;
    }

    const apiKey = String(this.settings.mapsApiKey ?? '').trim();
    if (!apiKey) {
      this.setStatus(this.settings.noMapKeyStatus);
      this.showListView();
      return;
    }

    const mapUiState = resolveMapUiState(
      { view: 'map', status: this.statusText() },
      this.visibleLocations,
      this.settings.noCoordinatesStatus,
    );
    if (mapUiState.markerCount === 0) {
      this.setStatus(mapUiState.status);
      this.showListView();
      return;
    }

    this.applyViewState('map');
    try {
      await this.initializeMap(apiKey);
    } catch (error) {
      this.setStatus(this.settings.mapErrorStatus);
      this.showListView();
    }
  }

  showListView() {
    this.applyViewState('list');
  }

  applyViewState(view) {
    this.dataset.activeView = view;
    this.activeView = view;
    if (this.mapPanel) this.mapPanel.hidden = view !== 'map';
    for (const button of this.viewButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.view === view));
    }
  }

  async initializeMap(apiKey) {
    if (this.map) {
      this.syncMapMarkers();
      return;
    }

    const maps = await loadGoogleMaps(apiKey);
    if (!maps || !this.mapElement) throw new Error('Google Maps is unavailable.');
    const firstMappedLocation = locationsWithCoordinates(this.visibleLocations)[0];
    const center = firstMappedLocation
      ? { lat: Number(firstMappedLocation.latitude), lng: Number(firstMappedLocation.longitude) }
      : { lat: -25.2744, lng: 133.7751 };
    this.map = new maps.Map(this.mapElement, {
      center,
      zoom: firstMappedLocation ? 12 : 4,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
    this.syncMapMarkers();
  }

  syncMapMarkers() {
    for (const marker of this.markers) marker.setMap(null);
    this.markers = [];
    const mappedLocations = locationsWithCoordinates(this.visibleLocations);
    const mapUiState = resolveMapUiState(
      { view: this.activeView ?? 'list', status: this.statusText() },
      this.visibleLocations,
      this.settings.noCoordinatesStatus,
    );
    if (mapUiState.status !== this.statusText()) this.setStatus(mapUiState.status);

    if (mapUiState.markerCount === 0) {
      this.showListView();
      return;
    }

    const maps = globalThis.google?.maps;
    if (!maps || !this.map) return;
    const bounds = new maps.LatLngBounds();

    for (const location of mappedLocations) {
      const position = { lat: Number(location.latitude), lng: Number(location.longitude) };
      const marker = new maps.Marker({
        position,
        map: this.map,
        title: String(location.title ?? ''),
        icon: this.dataset.markerIcon || undefined,
      });
      marker.addListener('click', () => this.focusLocation(location));
      bounds.extend(position);
      this.markers.push(marker);
    }

    if (mappedLocations.length === 1) {
      this.map.setCenter(bounds.getCenter());
      this.map.setZoom(14);
    } else {
      this.map.fitBounds(bounds, 48);
    }
  }

  focusLocation(location) {
    const index = this.locations.indexOf(location);
    const card = this.cards[index]?.querySelector('.locations-store-finder__card');
    if (!card) return;
    if (globalThis.matchMedia?.('(max-width: 990px)').matches) this.showListView();
    card.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    card.focus({ preventScroll: true });
  }

  setStatus(message) {
    const status = this.querySelector?.('[data-location-status]');
    if (status) status.textContent = message ?? '';
  }

  statusText() {
    return this.querySelector?.('[data-location-status]')?.textContent ?? '';
  }
}

if (globalThis.customElements && !customElements.get('locations-store-finder')) {
  customElements.define('locations-store-finder', LocationsStoreFinder);
}
