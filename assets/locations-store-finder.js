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

export function loadGoogleMaps(apiKey, documentObject = globalThis.document) {
  if (!apiKey) {
    return null;
  }
  if (globalThis.google?.maps) return Promise.resolve(globalThis.google.maps);
  if (!documentObject) return Promise.reject(new Error('A document is required to load Google Maps.'));
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    const existingScript = documentObject.querySelector('script[data-locations-google-maps]');
    const script = existingScript ?? documentObject.createElement('script');
    const handleLoad = () => {
      if (globalThis.google?.maps) {
        resolve(globalThis.google.maps);
      } else {
        mapsPromise = undefined;
        reject(new Error('Google Maps loaded without the Maps API.'));
      }
    };
    const handleError = () => {
      mapsPromise = undefined;
      reject(new Error('Google Maps failed to load.'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    if (!existingScript) {
      script.src = buildGoogleMapsUrl(apiKey);
      script.async = true;
      script.dataset.locationsGoogleMaps = '';
      documentObject.head.append(script);
    }
  });

  return mapsPromise;
}

class LocationsStoreFinder extends HTMLElementBase {
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
    this.mapPanel = this.querySelector('[data-map-panel]');
    this.mapElement = this.querySelector('[data-location-map]');
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
  }

  populateStateFilter() {
    if (!this.stateFilter) return;
    const firstOption = this.stateFilter.options[0];
    const states = [...new Set(this.locations.map(({ state }) => String(state ?? '').trim()).filter(Boolean))].sort(
      (first, second) => first.localeCompare(second),
    );

    this.stateFilter.replaceChildren(firstOption);
    for (const state of states) {
      const option = document.createElement('option');
      option.value = state;
      option.textContent = state;
      this.stateFilter.append(option);
    }
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
    if (this.map) this.syncMapMarkers();
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

    if (mappedLocations.length === 0) {
      this.setStatus(this.settings.noCoordinatesStatus);
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
}

if (globalThis.customElements && !customElements.get('locations-store-finder')) {
  customElements.define('locations-store-finder', LocationsStoreFinder);
}
