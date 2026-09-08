import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const themeRoot = resolve(import.meta.dirname, '..');
const sectionPath = resolve(themeRoot, 'sections/locations-store-finder.liquid');
const javascriptPath = resolve(themeRoot, 'assets/locations-store-finder.js');
const markerPath = resolve(themeRoot, 'assets/map-active.svg');
const safeUrlSnippetPath = resolve(themeRoot, 'snippets/safe-external-url.liquid');
const migrationDocPath = resolve(themeRoot, 'docs/locations-metaobject-migration.md');
const section = readFileSync(sectionPath, 'utf8');
const javascript = existsSync(javascriptPath) ? readFileSync(javascriptPath, 'utf8') : '';
const safeUrlSnippet = existsSync(safeUrlSnippetPath) ? readFileSync(safeUrlSnippetPath, 'utf8') : '';
const migrationDoc = readFileSync(migrationDocPath, 'utf8');

const schemaMatch = section.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);
assert.ok(schemaMatch, 'the store finder must expose a section schema');
const schema = JSON.parse(schemaMatch[1]);
const settings = new Map(schema.settings.filter((setting) => setting.id).map((setting) => [setting.id, setting]));

test('serializes a scoped, normalized payload from location and tag metaobjects', () => {
  assert.match(section, /assign all_locations = shop\.metaobjects\.store_location\.values/);
  assert.match(section, /for location in all_locations/);
  assert.match(section, /for tag in shop\.metaobjects\.store_tag\.values/);
  assert.match(
    section,
    /<script type="application\/json" data-locations-store-finder-data>[\s\S]*?"locations"[\s\S]*?"tags"[\s\S]*?"settings"[\s\S]*?<\/script>/,
    'each section instance must own one JSON payload',
  );

  for (const field of [
    'id',
    'title',
    'address',
    'suburb',
    'state',
    'latitude',
    'longitude',
    'hours',
    'overview',
    'website',
    'imageUrl',
    'imageAlt',
    'tags',
    'tagOptions',
  ]) {
    assert.match(section, new RegExp(`"${field}"\\s*:`), `the normalized payload must include ${field}`);
  }

  assert.doesNotMatch(
    section,
    /shop\.metaobjects\.(?:store_location|store_tag)\.values\s*\|\s*json|\{\{\s*(?:location|tag)\s*\|\s*json/,
    'raw metaobjects must never be serialized to the storefront',
  );
  assert.match(
    section,
    /data-location-id="\{\{ location\.system\.id \| escape \}\}"/,
    'each card must carry the same stable identity as its normalized record',
  );
});

test('keeps credentials editor-supplied and removes legacy dependencies', () => {
  const migratedSource = `${section}\n${javascript}`;

  assert.match(section, /section\.settings\.maps_api_key/);
  assert.doesNotMatch(migratedSource, /AIza[0-9A-Za-z_-]{20,}/, 'a Google Maps key must not be committed');
  assert.doesNotMatch(migratedSource, /jquery|jQuery|\$\s*\(/i, 'the finder must be dependency-free');
  assert.doesNotMatch(migratedSource, /accentuate|blogs\.flagship-stores/i);
  assert.doesNotMatch(migratedSource, /\.push\([^\n]*location\.tags|location\.tags\s*=/, 'location records must not be mutated');
});

test('rejects javascript and data website schemes while retaining absolute HTTP URLs', async () => {
  const { approvedExternalUrl } = await import(`${javascriptPath}?safe-urls=${Date.now()}`);
  assert.equal(approvedExternalUrl('https://example.com/store'), 'https://example.com/store');
  assert.equal(approvedExternalUrl('HTTP://example.com/store'), 'HTTP://example.com/store');
  assert.equal(approvedExternalUrl('javascript:alert(1)'), null);
  assert.equal(approvedExternalUrl('data:text/html,unsafe'), null);
  assert.match(section, /render 'safe-external-url', url: location\.storeaddressurl/);
  assert.match(safeUrlSnippet, /candidate_prefix_7 == 'http:\/\/'[\s\S]*candidate_prefix_8 == 'https:\/\/'/);
  assert.match(migrationDoc, /`storeaddressurl`[^\n]*Shopify [`*]*url[`*]* field/i);
});

test('renders explicitly labelled filters, live status, and selected view controls', () => {
  for (const control of ['search', 'state', 'tag', 'radius']) {
    assert.match(
      section,
      new RegExp(`<label[^>]*for="LocationsFinder-${control}-\\{\\{ section\\.id \\}\\}"[\\s\\S]*?<[^>]+id="LocationsFinder-${control}-\\{\\{ section\\.id \\}\\}"`),
      `${control} must have an explicit label`,
    );
  }

  assert.match(section, /data-location-status[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(section, /data-result-count[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(section, /<button[^>]*data-view="list"[^>]*aria-pressed="true"/);
  assert.match(section, /<button[^>]*data-view="map"[^>]*aria-pressed="false"/);
  assert.match(section, /<button[^>]*data-use-location/);
  assert.match(section, /<a[^>]*data-directions-link[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  assert.match(section, /<a[^>]*data-website-link[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
});

test('exposes copy, map, filter, width, color, and spacing settings', () => {
  const expectedTypes = {
    heading: 'text',
    intro: 'richtext',
    search_label: 'text',
    state_label: 'text',
    tag_label: 'text',
    radius_label: 'text',
    maps_api_key: 'text',
    default_view: 'select',
    default_radius: 'select',
    enable_state_filter: 'checkbox',
    enable_tag_filter: 'checkbox',
    enable_radius_filter: 'checkbox',
    pagination_error_status: 'text',
    content_width: 'select',
    background_color: 'color',
    text_color: 'color',
    accent_color: 'color',
    'padding-block-start': 'range',
    'padding-block-end': 'range',
  };

  for (const [id, type] of Object.entries(expectedTypes)) {
    assert.equal(settings.get(id)?.type, type, `${id} must be a ${type} setting`);
  }

  assert.deepEqual(settings.get('default_view').options.map(({ value }) => value), ['list', 'map']);
  assert.ok(Number(settings.get('default_radius').default) > 0, 'the default radius must be positive');
  assert.match(section, /render 'spacing-style', settings: section\.settings/);
  assert.match(section, /--locations-finder-content-width:/);
});

test('ships a theme-native custom element with resilient map and geolocation states', () => {
  assert.ok(existsSync(javascriptPath), 'assets/locations-store-finder.js must exist');
  assert.ok(existsSync(markerPath), 'assets/map-active.svg must exist');
  assert.match(javascript, /customElements\.define\('locations-store-finder'/);
  assert.match(javascript, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(javascript, /setAttribute\('aria-pressed', String\(/);
  assert.match(javascript, /if \(!apiKey\)[\s\S]*?return null;/, 'Maps must not load without an editor-supplied key');
  assert.match(javascript, /catch[\s\S]*?showListView/, 'a Maps failure must return to the usable list');
  assert.match(section, /@media \(max-width:/, 'the finder must provide a responsive layout');
  assert.match(section, /@media \(prefers-reduced-motion: no-preference\)/, 'motion must be opt-in');
});

test('filters the list without treating missing coordinates as missing stores', async () => {
  assert.ok(existsSync(javascriptPath), 'assets/locations-store-finder.js must exist');
  const { filterLocations } = await import(`${javascriptPath}?test=${Date.now()}`);
  const locations = [
    {
      title: 'ONA Sydney',
      address: '140 Marrickville Road',
      suburb: 'Marrickville',
      state: 'NSW',
      latitude: -33.907,
      longitude: 151.165,
      tags: ['flagship', 'cafe'],
    },
    {
      title: 'ONA Melbourne',
      address: '22 Ovens Street',
      suburb: 'Brunswick',
      state: 'VIC',
      latitude: -37.766,
      longitude: 144.961,
      tags: ['cafe'],
    },
    {
      title: 'Partner Perth',
      address: 'Hay Street',
      suburb: 'Perth',
      state: 'WA',
      latitude: null,
      longitude: null,
      tags: ['retailer'],
    },
  ];

  assert.deepEqual(
    filterLocations(locations, { query: 'marrickville', state: '', tag: '', origin: null, radiusKm: 0 }),
    [locations[0]],
    'text search must include address fields',
  );
  assert.deepEqual(
    filterLocations(locations, { query: '', state: 'VIC', tag: 'cafe', origin: null, radiusKm: 0 }),
    [locations[1]],
    'state and tag filters must combine',
  );
  assert.deepEqual(
    filterLocations(locations, { query: '', state: '', tag: '', origin: null, radiusKm: 0 }),
    locations,
    'missing coordinates must not remove a store from the unfiltered list',
  );
});

test('builds venue options from every location so a related tag beyond the first fifty remains selectable', async () => {
  const { locationTagOptions } = await import(`${javascriptPath}?all-location-tags=${Date.now()}`);
  assert.equal(typeof locationTagOptions, 'function');
  const configuredTags = Array.from({ length: 50 }, (_, index) => ({
    label: `Venue ${index + 1}`,
    slug: `venue-${index + 1}`,
  }));
  const locations = [
    {
      title: 'Location carrying tag 51',
      tagOptions: [{ label: 'Venue 51', slug: 'venue-51' }],
    },
  ];

  const options = locationTagOptions(locations, configuredTags);

  assert.equal(options.length, 51);
  assert.deepEqual(options.find(({ slug }) => slug === 'venue-51'), { label: 'Venue 51', slug: 'venue-51' });
});

test('places a related venue tag beyond fifty into the actual filter control', async () => {
  const { LocationsStoreFinder } = await import(`${javascriptPath}?tag-control-51=${Date.now()}`);
  const finder = new LocationsStoreFinder();
  const allVenues = { value: '', textContent: 'All venues' };
  const tagFilter = {
    options: [allVenues],
    value: '',
    replaceChildren(option) {
      this.options = [option];
    },
    append(option) {
      this.options.push(option);
    },
  };
  finder.tagFilter = tagFilter;
  finder.config = {
    tags: Array.from({ length: 50 }, (_, index) => ({ label: `Venue ${index + 1}`, slug: `venue-${index + 1}` })),
  };
  finder.locations = [{ tagOptions: [{ label: 'Venue 51', slug: 'venue-51' }] }];
  finder.ownerDocument = { createElement: () => ({ value: '', textContent: '' }) };

  finder.populateTagFilter();

  assert.equal(tagFilter.options.length, 52);
  assert.deepEqual(
    tagFilter.options.find(({ value }) => value === 'venue-51'),
    { value: 'venue-51', textContent: 'Venue 51' },
  );
});

test('uses coordinates only for distance filtering and map markers', async () => {
  assert.ok(existsSync(javascriptPath), 'assets/locations-store-finder.js must exist');
  const { filterLocations, locationsWithCoordinates } = await import(`${javascriptPath}?coordinates=${Date.now()}`);
  const nearby = { title: 'Nearby', latitude: -35.281, longitude: 149.128, tags: [] };
  const distant = { title: 'Distant', latitude: -33.8688, longitude: 151.2093, tags: [] };
  const unplaced = { title: 'Unplaced', latitude: null, longitude: null, tags: [] };
  const locations = [nearby, distant, unplaced];

  assert.deepEqual(locationsWithCoordinates(locations), [nearby, distant]);
  assert.deepEqual(
    filterLocations(locations, {
      query: '',
      state: '',
      tag: '',
      origin: { latitude: -35.2809, longitude: 149.13 },
      radiusKm: 20,
    }),
    [nearby],
    'an active radius must exclude stores whose distance cannot be calculated',
  );
});

test('does not apply a hidden radius filter after geolocation', async () => {
  assert.ok(existsSync(javascriptPath), 'assets/locations-store-finder.js must exist');
  const { radiusForFilter } = await import(`${javascriptPath}?radius=${Date.now()}`);
  const origin = { latitude: -35.2809, longitude: 149.13 };

  assert.equal(typeof radiusForFilter, 'function', 'the finder must resolve whether radius filtering is active');
  assert.equal(radiusForFilter(origin, null), 0, 'a disabled radius control must not filter the list');
  assert.equal(radiusForFilter(origin, '50'), 50, 'an enabled radius control must use its selected value');
  assert.equal(radiusForFilter(null, '50'), 0, 'radius filtering must wait until a location is available');
});

test('keeps location records beyond the Liquid page-size limit reachable', () => {
  assert.match(section, /paginate all_locations by 250/, 'the finder must request Shopify’s maximum supported page size');
  assert.match(
    section,
    /data-next-page-url="\{\{ paginate\.next\.url \| escape \}\}"/,
    'the enhanced finder must expose its next server-rendered result page',
  );
  assert.match(
    section,
    /data-current-page="\{\{ paginate\.current_page \}\}"/,
    'enhancement must distinguish a direct entry on a later result page',
  );
  assert.match(
    section,
    /if paginate\.pages > 1[\s\S]*?<nav[^>]*aria-label="Location result pages"[\s\S]*?paginate \| default_pagination[\s\S]*?<\/nav>/,
    'stores after the first 250 records must remain reachable through labelled pagination',
  );
});

test('keeps the accessible list selected when map view has no marker coordinates', async () => {
  const { resolveMapUiState } = await import(`${javascriptPath}?map-state-empty=${Date.now()}`);
  assert.equal(typeof resolveMapUiState, 'function', 'the finder must expose its map availability transition');

  assert.deepEqual(
    resolveMapUiState(
      { view: 'map', status: '' },
      [{ title: 'Unmapped store', latitude: null, longitude: null }],
      'No mapped locations match.',
    ),
    { view: 'list', status: 'No mapped locations match.', markerCount: 0 },
  );
});

test('clears only a stale no-coordinate status when mapped results return', async () => {
  const { resolveMapUiState } = await import(`${javascriptPath}?map-state-restored=${Date.now()}`);
  assert.equal(typeof resolveMapUiState, 'function', 'the finder must expose its map availability transition');
  const mappedLocations = [{ title: 'Mapped store', latitude: -35.28, longitude: 149.13 }];

  assert.deepEqual(
    resolveMapUiState(
      { view: 'list', status: 'No mapped locations match.' },
      mappedLocations,
      'No mapped locations match.',
    ),
    { view: 'list', status: '', markerCount: 1 },
  );
  assert.deepEqual(
    resolveMapUiState(
      { view: 'list', status: 'Showing locations near you.' },
      mappedLocations,
      'No mapped locations match.',
    ),
    { view: 'list', status: 'Showing locations near you.', markerCount: 1 },
  );
});

test('returns the actual custom element to its accessible list while Maps is still loading', async () => {
  const originalHTMLElement = globalThis.HTMLElement;
  globalThis.HTMLElement = class {
    constructor() {
      this.dataset = {};
    }
  };

  try {
    const { LocationsStoreFinder } = await import(`${javascriptPath}?map-race=${Date.now()}`);
    assert.equal(typeof LocationsStoreFinder, 'function', 'the finder custom element must be testable');

    const finder = new LocationsStoreFinder();
    const status = { textContent: '' };
    const listButton = {
      dataset: { view: 'list' },
      attributes: new Map(),
      setAttribute(name, value) {
        this.attributes.set(name, value);
      },
    };
    const mapButton = {
      dataset: { view: 'map' },
      attributes: new Map(),
      setAttribute(name, value) {
        this.attributes.set(name, value);
      },
    };
    const mapped = { id: 'mapped', title: 'Mapped', latitude: -35.28, longitude: 149.13, tags: [] };
    const unmapped = { id: 'unmapped', title: 'Unmapped', latitude: null, longitude: null, tags: [] };
    finder.settings = { mapsApiKey: 'editor-key', noCoordinatesStatus: 'No mapped locations match.' };
    finder.locations = [mapped, unmapped];
    finder.visibleLocations = [...finder.locations];
    finder.cards = [mapped, unmapped].map(() => ({ hidden: false, querySelector: () => null }));
    finder.searchInput = { value: '' };
    finder.stateFilter = null;
    finder.tagFilter = null;
    finder.radiusFilter = null;
    finder.origin = null;
    finder.resultCount = { textContent: '' };
    finder.emptyState = { hidden: true };
    finder.resetButton = { hidden: true };
    finder.mapPanel = { hidden: true };
    finder.map = null;
    finder.markers = [];
    finder.viewButtons = [listButton, mapButton];
    finder.querySelector = (selector) => (selector === '[data-location-status]' ? status : null);

    let finishMapLoad;
    finder.initializeMap = () => new Promise((resolve) => {
      finishMapLoad = resolve;
    });

    const mapTransition = finder.setView('map');
    await Promise.resolve();
    assert.equal(finder.dataset.activeView, 'list', 'map view must wait until the API is ready');

    finder.searchInput.value = 'unmapped';
    finder.applyFilters();

    assert.equal(finder.dataset.activeView, 'list', 'the narrow-layout list visibility state must be restored');
    assert.equal(finder.mapPanel.hidden, true, 'the unusable map panel must be hidden');
    assert.equal(listButton.attributes.get('aria-pressed'), 'true');
    assert.equal(mapButton.attributes.get('aria-pressed'), 'false');
    assert.equal(status.textContent, 'No mapped locations match.', 'the fallback must be announced politely');

    finishMapLoad();
    await mapTransition;
  } finally {
    if (originalHTMLElement === undefined) {
      delete globalThis.HTMLElement;
    } else {
      globalThis.HTMLElement = originalHTMLElement;
    }
  }
});

test('keeps list view active during a slow Maps load and ignores completion after a view change', async () => {
  const { LocationsStoreFinder } = await import(`${javascriptPath}?slow-map-view=${Date.now()}`);
  const finder = new LocationsStoreFinder();
  const listButton = {
    dataset: { view: 'list' },
    setAttribute(name, value) {
      this[name] = value;
    },
  };
  const mapButton = {
    dataset: { view: 'map' },
    setAttribute(name, value) {
      this[name] = value;
    },
  };
  finder.dataset = { activeView: 'list' };
  finder.activeView = 'list';
  finder.requestedView = 'list';
  finder.settings = { mapsApiKey: 'editor-key', noCoordinatesStatus: 'No mapped locations.' };
  finder.visibleLocations = [{ title: 'Mapped', latitude: -35.28, longitude: 149.13 }];
  finder.mapPanel = { hidden: true };
  finder.viewButtons = [listButton, mapButton];
  finder.statusText = () => '';
  finder.setStatus = () => {};

  let finishMapLoad;
  finder.initializeMap = () => new Promise((resolve) => {
    finishMapLoad = resolve;
  });

  const pendingMapView = finder.setView('map');
  await Promise.resolve();
  assert.equal(finder.dataset.activeView, 'list', 'map view must wait for successful initialization');
  assert.equal(finder.mapPanel.hidden, true);
  assert.equal(listButton['aria-pressed'], 'true', 'the list toggle must stay selected while readiness is pending');

  await finder.setView('list');
  finishMapLoad();
  await pendingMapView;

  assert.equal(finder.dataset.activeView, 'list', 'stale Maps completion must not override the newer list request');
  assert.equal(finder.mapPanel.hidden, true);
  assert.equal(listButton['aria-pressed'], 'true');
  assert.equal(mapButton['aria-pressed'], 'false');
});

test('activates map view after readiness when map remains requested', async () => {
  const { LocationsStoreFinder } = await import(`${javascriptPath}?ready-map-view=${Date.now()}`);
  const finder = new LocationsStoreFinder();
  finder.dataset = { activeView: 'list' };
  finder.activeView = 'list';
  finder.requestedView = 'list';
  finder.settings = { mapsApiKey: 'editor-key', noCoordinatesStatus: 'No mapped locations.' };
  finder.visibleLocations = [{ title: 'Mapped', latitude: -35.28, longitude: 149.13 }];
  finder.mapPanel = { hidden: true };
  finder.viewButtons = [];
  finder.finderConnected = true;
  finder.statusText = () => '';
  finder.setStatus = () => {};
  finder.syncMapMarkers = () => {};
  let finishMapLoad;
  finder.initializeMap = () => new Promise((resolve) => {
    finishMapLoad = resolve;
  });

  const pendingMapView = finder.setView('map');
  await Promise.resolve();
  assert.equal(finder.dataset.activeView, 'list');
  finishMapLoad();
  await pendingMapView;

  assert.equal(finder.dataset.activeView, 'map');
  assert.equal(finder.mapPanel.hidden, false);
});

test('returns active finders to accessible List view when Maps authentication fails after readiness', async () => {
  const previousAuthFailure = globalThis.gm_authFailure;
  let previousHandlerCalls = 0;
  const chainedHandler = () => {
    previousHandlerCalls += 1;
  };
  globalThis.gm_authFailure = chainedHandler;

  const { LocationsStoreFinder } = await import(`${javascriptPath}?post-ready-auth=${Date.now()}`);
  const finder = new LocationsStoreFinder();
  const listButton = {
    dataset: { view: 'list' },
    setAttribute(name, value) {
      this[name] = value;
    },
  };
  const mapButton = {
    dataset: { view: 'map' },
    setAttribute(name, value) {
      this[name] = value;
    },
  };
  let status = '';
  let detachedMarkers = 0;
  finder.dataset = { activeView: 'list' };
  finder.activeView = 'list';
  finder.requestedView = 'list';
  finder.settings = {
    mapsApiKey: 'editor-key',
    mapErrorStatus: 'Map is unavailable. Browse the location list instead.',
    noCoordinatesStatus: 'No mapped locations.',
  };
  finder.visibleLocations = [{ title: 'Mapped', latitude: -35.28, longitude: 149.13 }];
  finder.mapPanel = { hidden: true };
  finder.viewButtons = [listButton, mapButton];
  finder.finderConnected = true;
  finder.connectionVersion = 0;
  finder.mapInitializationPromise = null;
  finder.markers = [{ setMap(value) { if (value === null) detachedMarkers += 1; } }];
  finder.statusText = () => status;
  finder.setStatus = (message) => { status = message; };
  finder.syncMapMarkers = () => {};
  finder.initializeMap = async () => {
    finder.map = { ready: true };
    return finder.map;
  };

  try {
    await finder.setView('map');
    assert.equal(finder.dataset.activeView, 'map', 'the map must first activate after readiness');
    assert.notEqual(globalThis.gm_authFailure, chainedHandler, 'the finder must retain an auth-failure dispatcher');

    globalThis.gm_authFailure();

    assert.equal(previousHandlerCalls, 1, 'a pre-existing global auth handler must remain chained');
    assert.equal(finder.dataset.activeView, 'list');
    assert.equal(finder.mapPanel.hidden, true);
    assert.equal(listButton['aria-pressed'], 'true');
    assert.equal(mapButton['aria-pressed'], 'false');
    assert.equal(status, 'Map is unavailable. Browse the location list instead.');
    assert.equal(detachedMarkers, 1);
    assert.deepEqual(finder.markers, []);
    assert.equal(finder.map, null);
    assert.equal(finder.mapInitializationPromise, null);

    finder.disconnectedCallback();
    assert.equal(globalThis.gm_authFailure, chainedHandler, 'disconnect must restore the prior global handler');
  } finally {
    if (globalThis.gm_authFailure !== chainedHandler) finder.disconnectedCallback();
    if (previousAuthFailure === undefined) delete globalThis.gm_authFailure;
    else globalThis.gm_authFailure = previousAuthFailure;
  }
});

test('ignores a stale Maps rejection after the visitor returns to list view', async () => {
  const { LocationsStoreFinder } = await import(`${javascriptPath}?stale-map-error=${Date.now()}`);
  const finder = new LocationsStoreFinder();
  finder.dataset = { activeView: 'list' };
  finder.activeView = 'list';
  finder.requestedView = 'list';
  finder.settings = {
    mapsApiKey: 'editor-key',
    mapErrorStatus: 'Map failed.',
    noCoordinatesStatus: 'No mapped locations.',
  };
  finder.visibleLocations = [{ title: 'Mapped', latitude: -35.28, longitude: 149.13 }];
  finder.mapPanel = { hidden: true };
  finder.viewButtons = [];
  finder.finderConnected = true;
  let status = '';
  finder.statusText = () => status;
  finder.setStatus = (message) => {
    status = message;
  };
  let failMapLoad;
  finder.initializeMap = () => new Promise((resolve, reject) => {
    failMapLoad = reject;
  });

  const pendingMapView = finder.setView('map');
  await Promise.resolve();
  await finder.setView('list');
  failMapLoad(new Error('late failure'));
  await pendingMapView;

  assert.equal(status, '', 'a superseded map request must not announce a stale error');
  assert.equal(finder.dataset.activeView, 'list');
});

test('caches concurrent per-finder map initialization and clears stale disconnected work', async () => {
  const { LocationsStoreFinder } = await import(`${javascriptPath}?map-init-cache=${Date.now()}`);
  const finder = new LocationsStoreFinder();
  finder.map = null;
  finder.mapElement = {};
  finder.visibleLocations = [{ title: 'Mapped', latitude: -35.28, longitude: 149.13 }];
  finder.syncMapMarkers = () => {};
  finder.finderConnected = true;
  finder.connectionVersion = 0;
  let resolveMaps;
  let loaderCalls = 0;
  let mapInstances = 0;
  const loader = () => {
    loaderCalls += 1;
    return new Promise((resolve) => {
      resolveMaps = resolve;
    });
  };
  const maps = {
    Map: class {
      constructor() {
        mapInstances += 1;
      }
    },
  };

  const first = finder.initializeMap('editor-key', loader);
  const second = finder.initializeMap('editor-key', loader);
  const concurrentResults = Promise.allSettled([first, second]);
  await Promise.resolve();
  assert.equal(loaderCalls, 1, 'concurrent requests must share one initialization operation');
  resolveMaps(maps);
  assert.deepEqual((await concurrentResults).map(({ status }) => status), ['fulfilled', 'fulfilled']);
  assert.equal(mapInstances, 1, 'one finder must never create duplicate Map instances');

  const staleFinder = new LocationsStoreFinder();
  staleFinder.map = null;
  staleFinder.mapElement = {};
  staleFinder.visibleLocations = finder.visibleLocations;
  staleFinder.syncMapMarkers = () => {};
  staleFinder.finderConnected = true;
  staleFinder.connectionVersion = 0;
  let resolveStaleMaps;
  const staleInitialization = staleFinder.initializeMap(
    'editor-key',
    () => new Promise((resolve) => {
      resolveStaleMaps = resolve;
    }),
  );
  const staleResult = Promise.allSettled([staleInitialization]);
  await Promise.resolve();
  staleFinder.disconnectedCallback();
  resolveStaleMaps(maps);

  assert.equal((await staleResult)[0].status, 'rejected');
  assert.equal(staleFinder.map, null, 'a disconnected finder must ignore a stale loader completion');
  assert.equal(staleFinder.mapInitializationPromise, null, 'disconnect must clear cached initialization state');
});

function createMapsScriptDocument() {
  const createdScripts = [];
  const activeScripts = [];
  const documentObject = {
    querySelector() {
      return activeScripts[0] ?? null;
    },
    createElement() {
      const listeners = new Map();
      const script = {
        dataset: {},
        removed: false,
        addEventListener(type, listener, options = {}) {
          const entries = listeners.get(type) ?? [];
          entries.push({ listener, once: Boolean(options.once) });
          listeners.set(type, entries);
        },
        removeEventListener(type, listener) {
          listeners.set(type, (listeners.get(type) ?? []).filter((entry) => entry.listener !== listener));
        },
        dispatch(type) {
          const entries = [...(listeners.get(type) ?? [])];
          for (const entry of entries) {
            entry.listener();
            if (entry.once) this.removeEventListener(type, entry.listener);
          }
        },
        remove() {
          this.removed = true;
          const index = activeScripts.indexOf(this);
          if (index >= 0) activeScripts.splice(index, 1);
        },
      };
      createdScripts.push(script);
      return script;
    },
    head: {
      append(script) {
        activeScripts.push(script);
      },
    },
  };
  return { documentObject, createdScripts, activeScripts };
}

function mapsCallbackName(script) {
  return new URL(script.src).searchParams.get('callback');
}

test('waits for the documented Maps callback rather than the async script load event', async () => {
  const { loadGoogleMaps } = await import(`${javascriptPath}?maps-retry=${Date.now()}`);
  const { documentObject, createdScripts, activeScripts } = createMapsScriptDocument();
  const originalGoogle = globalThis.google;

  try {
    delete globalThis.google;
    const firstAttempt = loadGoogleMaps('editor-key', documentObject);
    createdScripts[0].dispatch('error');
    await assert.rejects(firstAttempt, /failed to load/);
    assert.equal(createdScripts[0].removed, true, 'the terminally failed script must be removed');

    const secondAttempt = loadGoogleMaps('editor-key', documentObject);
    assert.equal(createdScripts.length, 2, 'retry must create a new script element');
    assert.equal(activeScripts.length, 1, 'only the retry script may remain active');
    const callbackName = mapsCallbackName(createdScripts[1]);
    assert.ok(callbackName, 'the Maps request must use a unique readiness callback');

    let settled = false;
    secondAttempt.then(() => {
      settled = true;
    });
    createdScripts[1].dispatch('load');
    await Promise.resolve();
    assert.equal(settled, false, 'loading=async script load is not API readiness');

    globalThis.google = { maps: { source: 'second attempt' } };
    globalThis[callbackName]();
    assert.equal(await secondAttempt, globalThis.google.maps);
    assert.equal(globalThis[callbackName], undefined, 'readiness globals must be removed after success');
  } finally {
    if (originalGoogle === undefined) {
      delete globalThis.google;
    } else {
      globalThis.google = originalGoogle;
    }
  }
});

test('rejects Maps authentication failure and resets scripts and loader globals', async () => {
  const { loadGoogleMaps } = await import(`${javascriptPath}?maps-auth=${Date.now()}`);
  const { documentObject, createdScripts, activeScripts } = createMapsScriptDocument();
  const originalGoogle = globalThis.google;
  const originalAuthFailure = globalThis.gm_authFailure;

  try {
    delete globalThis.google;
    delete globalThis.gm_authFailure;
    const loading = loadGoogleMaps('bad-key', documentObject);
    const callbackName = mapsCallbackName(createdScripts[0]);
    assert.equal(typeof globalThis.gm_authFailure, 'function');
    globalThis.google = { maps: { partial: true } };
    globalThis.gm_authFailure();

    await assert.rejects(loading, /authentication/i);
    assert.equal(createdScripts[0].removed, true);
    assert.equal(activeScripts.length, 0);
    assert.equal(globalThis[callbackName], undefined);
    assert.equal(globalThis.gm_authFailure, undefined);
    assert.equal(globalThis.google, undefined, 'partial loader globals must be rolled back');
  } finally {
    if (originalGoogle === undefined) delete globalThis.google;
    else globalThis.google = originalGoogle;
    if (originalAuthFailure === undefined) delete globalThis.gm_authFailure;
    else globalThis.gm_authFailure = originalAuthFailure;
  }
});

test('times out an unready Maps request and permits a clean retry', async () => {
  const { loadGoogleMaps } = await import(`${javascriptPath}?maps-timeout=${Date.now()}`);
  const { documentObject, createdScripts, activeScripts } = createMapsScriptDocument();
  let timeoutCallback;
  let clearedTimer = null;
  const loading = loadGoogleMaps('slow-key', documentObject, {
    timeoutMs: 25,
    setTimeoutFn(callback) {
      timeoutCallback = callback;
      return 77;
    },
    clearTimeoutFn(timer) {
      clearedTimer = timer;
    },
  });
  assert.equal(typeof timeoutCallback, 'function', 'the loader must schedule a readiness deadline');
  timeoutCallback();

  await assert.rejects(loading, /timed out/i);
  assert.equal(createdScripts[0].removed, true);
  assert.equal(activeScripts.length, 0);
  assert.equal(clearedTimer, 77);

  const retry = loadGoogleMaps('slow-key', documentObject, {
    setTimeoutFn: () => 88,
    clearTimeoutFn: () => {},
  });
  assert.equal(createdScripts.length, 2, 'a timeout must not poison the next attempt');
  createdScripts[1].dispatch('error');
  await assert.rejects(retry, /failed to load/);
});

test('builds a section-rendering URL without losing the pagination cursor', async () => {
  const { buildSectionRenderingUrl } = await import(`${javascriptPath}?section-url=${Date.now()}`);
  assert.equal(typeof buildSectionRenderingUrl, 'function', 'the finder must build its scoped page request');

  assert.equal(
    buildSectionRenderingUrl(
      '/pages/locations?page=2',
      'template--123__store_finder',
      'https://onacoffee.test/pages/locations?view=locations',
    ),
    'https://onacoffee.test/pages/locations?page=2&section_id=template--123__store_finder',
  );
});

test('derives the deterministic first location page without dropping unrelated query parameters', async () => {
  const { buildFirstLocationPageUrl } = await import(`${javascriptPath}?first-page-url=${Date.now()}`);
  assert.equal(typeof buildFirstLocationPageUrl, 'function', 'the finder must derive its first result page');

  assert.equal(
    buildFirstLocationPageUrl(
      'https://onacoffee.test/pages/locations?view=locations&page=3&sort=title&section_id=stale',
    ),
    'https://onacoffee.test/pages/locations?view=locations&sort=title',
  );
});

test('direct entry on page two atomically replaces it with every page starting at page one', async () => {
  const { LocationsStoreFinder } = await import(`${javascriptPath}?direct-page-two=${Date.now()}`);
  const pageOneLocation = { id: 'gid://shopify/Metaobject/1', title: 'Page one' };
  const pageTwoLocation = { id: 'gid://shopify/Metaobject/2', title: 'Page two' };
  const pageThreeLocation = { id: 'gid://shopify/Metaobject/3', title: 'Page three' };
  const card = (id) => ({ dataset: { locationId: id, locationIndex: '' } });
  const pageOneCard = card(pageOneLocation.id);
  const pageTwoCard = card(pageTwoLocation.id);
  const pageThreeCard = card(pageThreeLocation.id);
  const serverPageTwoCard = card(pageTwoLocation.id);
  const finder = new LocationsStoreFinder();
  const currentUrl = 'https://onacoffee.test/pages/locations?view=locations&page=2';
  const requestedPages = [];
  const pages = new Map([
    [
      'https://onacoffee.test/pages/locations?view=locations',
      { locations: [pageOneLocation], cards: [pageOneCard], nextPageUrl: '/pages/locations?view=locations&page=2' },
    ],
    [
      '/pages/locations?view=locations&page=2',
      { locations: [pageTwoLocation], cards: [serverPageTwoCard], nextPageUrl: '/pages/locations?view=locations&page=3' },
    ],
    [
      '/pages/locations?view=locations&page=3',
      { locations: [pageThreeLocation], cards: [pageThreeCard], nextPageUrl: '' },
    ],
  ]);
  const locationList = {
    children: [pageTwoCard],
    append(fragment) {
      this.children.push(...fragment.children);
    },
    replaceChildren(fragment) {
      this.children = [...fragment.children];
    },
  };
  finder.dataset = {
    currentPage: '2',
    nextPageUrl: '/pages/locations?view=locations&page=3',
    sectionId: 'template--123__store_finder',
  };
  finder.locations = [pageTwoLocation];
  finder.cards = [pageTwoCard];
  finder.locationList = locationList;
  finder.pagination = { hidden: false };
  finder.requestedView = 'list';
  finder.activeView = 'list';
  finder.ownerDocument = {
    location: { href: currentUrl },
    createDocumentFragment() {
      return {
        children: [],
        append(node) {
          this.children.push(node);
        },
      };
    },
  };
  finder.fetchLocationPage = async (url) => {
    requestedPages.push(url);
    return pages.get(url);
  };
  finder.populateStateFilter = () => {};
  finder.applyFilters = () => {};

  await finder.loadRemainingLocationPages();

  assert.deepEqual(requestedPages, [
    'https://onacoffee.test/pages/locations?view=locations',
    '/pages/locations?view=locations&page=2',
    '/pages/locations?view=locations&page=3',
  ]);
  assert.deepEqual(finder.locations, [pageOneLocation, pageTwoLocation, pageThreeLocation]);
  assert.deepEqual(locationList.children, [pageOneCard, serverPageTwoCard, pageThreeCard]);
  assert.deepEqual(
    locationList.children.map(({ dataset }) => dataset.locationIndex),
    ['0', '1', '2'],
    'every card must remain index-aligned after the atomic replacement',
  );
  assert.equal(finder.pagination.hidden, true, 'fallback pagination hides only after complete aggregation');
});

test('direct-entry aggregation failure preserves the current page and fallback pagination', async () => {
  const { LocationsStoreFinder } = await import(`${javascriptPath}?direct-page-failure=${Date.now()}`);
  const currentLocation = { id: 'gid://shopify/Metaobject/2', title: 'Current page store' };
  const currentCard = { dataset: { locationId: currentLocation.id, locationIndex: '0' } };
  const locationList = {
    children: [currentCard],
    replaceChildren() {
      throw new Error('the list must not be replaced after a request failure');
    },
  };
  const finder = new LocationsStoreFinder();
  finder.dataset = { currentPage: '2', nextPageUrl: '', sectionId: 'template--123__store_finder' };
  finder.locations = [currentLocation];
  finder.cards = [currentCard];
  finder.locationList = locationList;
  finder.pagination = { hidden: false };
  finder.ownerDocument = {
    location: { href: 'https://onacoffee.test/pages/locations?page=2' },
  };
  finder.fetchLocationPage = async () => {
    throw new Error('simulated page-one request failure');
  };

  await assert.rejects(() => finder.loadRemainingLocationPages(), /simulated page-one request failure/);

  assert.deepEqual(finder.locations, [currentLocation]);
  assert.deepEqual(finder.cards, [currentCard]);
  assert.deepEqual(locationList.children, [currentCard]);
  assert.equal(finder.pagination.hidden, false);
});

test('aggregates every paginated location before applying finder-wide filters', async () => {
  const { filterLocations, loadAllLocationPages } = await import(`${javascriptPath}?all-pages=${Date.now()}`);
  assert.equal(typeof loadAllLocationPages, 'function', 'the finder must aggregate its server-rendered pages');

  const sydney = Object.freeze({ id: 'gid://shopify/Metaobject/1', title: 'Sydney', state: 'NSW', tags: ['cafe'] });
  const melbourne = Object.freeze({ id: 'gid://shopify/Metaobject/2', title: 'Melbourne', state: 'VIC', tags: ['cafe'] });
  const perth = Object.freeze({ id: 'gid://shopify/Metaobject/3', title: 'Partner Perth', suburb: 'Perth', state: 'WA', tags: ['retailer'] });
  const initialPage = Object.freeze({
    locations: Object.freeze([sydney]),
    cards: Object.freeze(['sydney-card']),
    nextPageUrl: '/pages/locations?page=2',
  });
  const pages = new Map([
    [
      '/pages/locations?page=2',
      { locations: [melbourne], cards: ['melbourne-card'], nextPageUrl: '/pages/locations?page=3' },
    ],
    [
      '/pages/locations?page=3',
      {
        locations: [sydney, perth],
        cards: ['duplicate-sydney-card', 'perth-card'],
        nextPageUrl: '',
      },
    ],
  ]);
  const requestedPages = [];

  const result = await loadAllLocationPages(initialPage, async (url) => {
    requestedPages.push(url);
    return pages.get(url);
  });

  assert.deepEqual(requestedPages, ['/pages/locations?page=2', '/pages/locations?page=3']);
  assert.deepEqual(result.locations, [sydney, melbourne, perth]);
  assert.deepEqual(result.cards, ['sydney-card', 'melbourne-card', 'perth-card']);
  assert.deepEqual(
    result.locations.map((location, index) => [location.title, result.cards[index]]),
    [
      ['Sydney', 'sydney-card'],
      ['Melbourne', 'melbourne-card'],
      ['Partner Perth', 'perth-card'],
    ],
    'deduplication must keep each location aligned with its own card',
  );
  assert.deepEqual(
    filterLocations(result.locations, { query: 'perth', state: '', tag: '', origin: null, radiusKm: 0 }),
    [perth],
    'a match on a later Liquid page must be visible to text search',
  );
  assert.deepEqual(initialPage.locations, [sydney], 'aggregation must not mutate the initial location page');
});

test('aggregates a two-hundred-and-fifty-first location instead of stopping at the Liquid page size', async () => {
  const { loadAllLocationPages } = await import(`${javascriptPath}?location-251=${Date.now()}`);
  const firstPageLocations = Array.from({ length: 250 }, (_, index) => ({
    id: `gid://shopify/Metaobject/${index + 1}`,
    title: `Location ${index + 1}`,
  }));
  const firstPageCards = firstPageLocations.map(({ id }) => ({ dataset: { locationId: id } }));
  const finalLocation = { id: 'gid://shopify/Metaobject/251', title: 'Location 251' };
  const finalCard = { dataset: { locationId: finalLocation.id } };

  const result = await loadAllLocationPages(
    { locations: firstPageLocations, cards: firstPageCards, nextPageUrl: '/pages/locations?page=2' },
    async () => ({ locations: [finalLocation], cards: [finalCard], nextPageUrl: '' }),
  );

  assert.equal(result.locations.length, 251);
  assert.equal(result.locations[250], finalLocation);
  assert.equal(result.cards[250], finalCard);
});

test('keeps visibly identical stores when their stable identities differ or are unavailable', async () => {
  const { loadAllLocationPages } = await import(`${javascriptPath}?stable-location-id=${Date.now()}`);
  const first = { id: 'gid://shopify/Metaobject/1', title: 'ONA Cafe', state: 'NSW', tags: ['cafe'] };
  const second = { id: 'gid://shopify/Metaobject/2', title: 'ONA Cafe', state: 'NSW', tags: ['cafe'] };
  const anonymousOne = { title: 'Partner Cafe', state: 'VIC', tags: ['cafe'] };
  const anonymousTwo = { title: 'Partner Cafe', state: 'VIC', tags: ['cafe'] };

  const result = await loadAllLocationPages(
    {
      locations: [first, anonymousOne],
      cards: ['first-card', 'anonymous-one-card'],
      nextPageUrl: '/pages/locations?page=2',
    },
    async () => ({
      locations: [{ ...first }, second, anonymousTwo],
      cards: ['repeated-first-card', 'second-card', 'anonymous-two-card'],
      nextPageUrl: '',
    }),
  );

  assert.deepEqual(result.locations, [first, anonymousOne, second, anonymousTwo]);
  assert.deepEqual(result.cards, ['first-card', 'anonymous-one-card', 'second-card', 'anonymous-two-card']);
});

test('rejects a normalized record paired with a card from another stable identity', async () => {
  const { readFinderPage } = await import(`${javascriptPath}?location-pairing=${Date.now()}`);
  const payload = { textContent: JSON.stringify({ locations: [{ id: 'gid://shopify/Metaobject/1' }] }) };
  const wrongCard = { dataset: { locationId: 'gid://shopify/Metaobject/2' } };
  const finder = {
    dataset: { nextPageUrl: '' },
    querySelector: (selector) => (selector === '[data-locations-store-finder-data]' ? payload : null),
    querySelectorAll: () => [wrongCard],
  };

  assert.throws(() => readFinderPage(finder), /identity/, 'record/card pairing must be verified before append');
});

test('rejects a repeated pagination cursor instead of appending a page twice', async () => {
  const { loadAllLocationPages } = await import(`${javascriptPath}?page-cycle=${Date.now()}`);
  assert.equal(typeof loadAllLocationPages, 'function', 'the finder must aggregate its server-rendered pages');

  await assert.rejects(
    loadAllLocationPages(
      { locations: [], cards: [], nextPageUrl: '/pages/locations?page=2' },
      async (url) => ({ locations: [], cards: [], nextPageUrl: url }),
    ),
    /repeated pagination URL/,
  );
});
