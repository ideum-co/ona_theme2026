import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const themeRoot = resolve(import.meta.dirname, '..');
const sectionPath = resolve(themeRoot, 'sections/locations-store-finder.liquid');
const javascriptPath = resolve(themeRoot, 'assets/locations-store-finder.js');
const markerPath = resolve(themeRoot, 'assets/map-active.svg');
const section = readFileSync(sectionPath, 'utf8');
const javascript = existsSync(javascriptPath) ? readFileSync(javascriptPath, 'utf8') : '';

const schemaMatch = section.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);
assert.ok(schemaMatch, 'the store finder must expose a section schema');
const schema = JSON.parse(schemaMatch[1]);
const settings = new Map(schema.settings.filter((setting) => setting.id).map((setting) => [setting.id, setting]));

test('serializes a scoped, normalized payload from location and tag metaobjects', () => {
  assert.match(section, /for location in shop\.metaobjects\.store_location\.values/);
  assert.match(section, /for tag in shop\.metaobjects\.store_tag\.values/);
  assert.match(
    section,
    /<script type="application\/json" data-locations-store-finder-data>[\s\S]*?"locations"[\s\S]*?"tags"[\s\S]*?"settings"[\s\S]*?<\/script>/,
    'each section instance must own one JSON payload',
  );

  for (const field of [
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
  ]) {
    assert.match(section, new RegExp(`"${field}"\\s*:`), `the normalized payload must include ${field}`);
  }

  assert.doesNotMatch(
    section,
    /shop\.metaobjects\.(?:store_location|store_tag)\.values\s*\|\s*json|\{\{\s*(?:location|tag)\s*\|\s*json/,
    'raw metaobjects must never be serialized to the storefront',
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
  assert.match(section, /<button[^>]*data-view="list"[^>]*aria-pressed=/);
  assert.match(section, /<button[^>]*data-view="map"[^>]*aria-pressed=/);
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
    /if paginate\.pages > 1[\s\S]*?<nav[^>]*aria-label="Location result pages"[\s\S]*?paginate \| default_pagination[\s\S]*?<\/nav>/,
    'stores after the first 250 records must remain reachable through labelled pagination',
  );
});
