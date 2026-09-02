import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const themeRoot = resolve(import.meta.dirname, '..');
const sectionPath = resolve(themeRoot, 'sections/locations-flagships.liquid');
const javascriptPath = resolve(themeRoot, 'assets/locations-flagships.js');
const section = readFileSync(sectionPath, 'utf8');
const javascript = existsSync(javascriptPath) ? readFileSync(javascriptPath, 'utf8') : '';

const schemaMatch = section.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);
assert.ok(schemaMatch, 'the flagship section must expose a schema');
const schema = JSON.parse(schemaMatch[1]);
const settings = new Map(schema.settings.filter((setting) => setting.id).map((setting) => [setting.id, setting]));

test('renders only store_location records related to the flagship store_tag', () => {
  assert.match(section, /for location in shop\.metaobjects\.store_location\.values/);
  assert.match(section, /for tag in location\.tags\.value/);
  assert.match(section, /tag\.slug\.value\s*==\s*'flagship'/);
  assert.match(
    section,
    /if is_flagship[\s\S]*?<article[^>]*class="locations-flagships__card"[\s\S]*?endif/,
    'a location card must only render after the flagship relation is confirmed',
  );
});

test('uses the shared metaobject contract without legacy dependencies', () => {
  const migratedSource = `${section}\n${javascript}`;

  assert.doesNotMatch(migratedSource, /blogs\.flagship-stores|accentuate/i);
  assert.doesNotMatch(migratedSource, /jquery|jQuery|\$\s*\(/i);
  assert.doesNotMatch(migratedSource, /\.push\([^\n]*location|location\.(?:tags|gallery)\s*=/, 'records must not be mutated');
});

test('renders the complete flagship content with safe external links', () => {
  assert.match(section, /assign title = location\.title\.value/);
  assert.match(section, /assign address = location\.storeaddress\.value/);
  assert.match(section, /assign hours = location\.time\.value/);
  assert.match(section, /assign overview = location\.overview\.value/);
  assert.match(section, /assign website = location\.storeaddressurl\.value/);
  assert.match(section, /<a[^>]*href="{{ website \| escape }}"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  assert.match(section, /{{ address \| escape \| newline_to_br }}/);
  assert.match(section, /{{ location\.time \| metafield_tag }}/);
  assert.match(section, /{{ location\.overview \| metafield_tag }}/);
});

test('renders gallery references and falls back to the existing location image', () => {
  assert.match(section, /assign gallery = location\.gallery\.value/);
  assert.match(section, /if gallery != blank/);
  assert.match(section, /for media in gallery/);
  assert.match(section, /elsif location\.image\.value != blank/);
  assert.match(section, /assign media = location\.image\.value/);
  assert.match(section, /media\.alt\s*\|\s*default:\s*title/);
  assert.match(section, /(?:media|image)\s*\|\s*image_url:/);
});

test('falls back when a nonempty gallery contains no renderable images', () => {
  assert.match(section, /assign use_fallback_image = false/);
  assert.match(
    section,
    /if media_count == 0 and fallback_image != blank[\s\S]*?assign use_fallback_image = true/,
    'the image fallback must be selected after gallery references are checked for renderable previews',
  );
  assert.match(
    section,
    /if gallery != blank and use_fallback_image == false[\s\S]*?elsif location\.image\.value != blank/,
    'a nonempty but unusable gallery must not mask the existing location image',
  );
});

test('only renders labelled gallery controls for multiple images', () => {
  assert.match(section, /if media_count > 1/);
  assert.match(section, /<locations-flagship-gallery[^>]*data-slide-count="{{ media_count }}"/);
  assert.match(section, /<button[^>]*data-gallery-previous[^>]*aria-label="Previous image"/);
  assert.match(section, /<button[^>]*data-gallery-next[^>]*aria-label="Next image"/);
  assert.match(section, /data-gallery-status[^>]*aria-live="polite"/);
  assert.match(section, /data-gallery-viewport[\s\S]{0,180}tabindex="0"/);
});

test('supports keyboard gallery navigation and reduced motion', async () => {
  assert.ok(existsSync(javascriptPath), 'assets/locations-flagships.js must exist');
  const { galleryIndexForKey, galleryScrollBehavior } = await import(`${javascriptPath}?test=${Date.now()}`);

  assert.equal(galleryIndexForKey('ArrowRight', 0, 3), 1);
  assert.equal(galleryIndexForKey('ArrowLeft', 0, 3), 2);
  assert.equal(galleryIndexForKey('Home', 2, 3), 0);
  assert.equal(galleryIndexForKey('End', 0, 3), 2);
  assert.equal(galleryIndexForKey('Enter', 1, 3), null);
  assert.equal(galleryScrollBehavior(true), 'auto');
  assert.equal(galleryScrollBehavior(false), 'smooth');
  assert.match(javascript, /customElements\.define\('locations-flagship-gallery'/);
  assert.match(javascript, /window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
});

test('synchronizes direct scrolling before button navigation and cleans up its lifecycle', async () => {
  const originalWindow = globalThis.window;
  globalThis.window = { matchMedia: () => ({ matches: true }) };

  const eventTarget = (properties = {}) => {
    const listeners = new Map();
    return {
      ...properties,
      listeners,
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
      removeEventListener(type, listener) {
        if (listeners.get(type) === listener) listeners.delete(type);
      },
      dispatch(type, event = {}) {
        listeners.get(type)?.(event);
      },
    };
  };

  try {
    const { LocationsFlagshipGallery } = await import(`${javascriptPath}?component=${Date.now()}`);
    const slides = [{ offsetLeft: 0 }, { offsetLeft: 100 }, { offsetLeft: 200 }];
    const scrollCalls = [];
    const viewport = eventTarget({
      scrollLeft: 0,
      scrollTo(options) {
        this.scrollLeft = options.left;
        scrollCalls.push(options);
      },
    });
    const previousButton = eventTarget();
    const nextButton = eventTarget();
    const status = { textContent: '' };
    const gallery = new LocationsFlagshipGallery();

    gallery.querySelectorAll = (selector) => (selector === '[data-gallery-slide]' ? slides : []);
    gallery.querySelector = (selector) => ({
      '[data-gallery-viewport]': viewport,
      '[data-gallery-previous]': previousButton,
      '[data-gallery-next]': nextButton,
      '[data-gallery-status]': status,
    })[selector] ?? null;

    gallery.connectedCallback();
    assert.equal(typeof viewport.listeners.get('scroll'), 'function', 'the live viewport must be observed');

    viewport.scrollLeft = 190;
    viewport.dispatch('scroll');
    await new Promise((resolve) => setTimeout(resolve, 80));

    assert.equal(gallery.currentIndex, 2, 'the closest slide must become current after direct scrolling');
    assert.equal(status.textContent, 'Image 3 of 3', 'the live status must follow direct scrolling');

    previousButton.dispatch('click');
    assert.deepEqual(scrollCalls.at(-1), { left: 100, behavior: 'auto' });
    assert.equal(status.textContent, 'Image 2 of 3');

    nextButton.dispatch('click');
    assert.deepEqual(scrollCalls.at(-1), { left: 200, behavior: 'auto' });
    assert.equal(status.textContent, 'Image 3 of 3');

    viewport.scrollLeft = 0;
    viewport.dispatch('scroll');
    gallery.disconnectedCallback();
    assert.equal(viewport.listeners.size, 0, 'viewport listeners must be removed on disconnect');
    assert.equal(previousButton.listeners.size, 0, 'previous-button listeners must be removed on disconnect');
    assert.equal(nextButton.listeners.size, 0, 'next-button listeners must be removed on disconnect');

    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(gallery.currentIndex, 2, 'disconnect must cancel a pending scroll synchronization');
    assert.equal(status.textContent, 'Image 3 of 3');
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test('exposes flagship copy, layout, media, color, alignment, and spacing controls', () => {
  const expectedTypes = {
    heading: 'text',
    intro: 'richtext',
    content_width: 'select',
    background_color: 'color',
    text_color: 'color',
    accent_color: 'color',
    media_aspect_ratio: 'select',
    media_fit: 'select',
    alignment: 'text_alignment',
    'padding-block-start': 'range',
    'padding-block-end': 'range',
  };

  for (const [id, type] of Object.entries(expectedTypes)) {
    assert.equal(settings.get(id)?.type, type, `${id} must be a ${type} setting`);
  }

  assert.match(section, /render 'spacing-style', settings: section\.settings/);
  assert.match(section, /render 'contrast-override',[\s\S]*?text_color: section\.settings\.text_color/);
  assert.match(section, /--locations-flagships-content-width:/);
  assert.match(section, /--locations-flagships-alignment:/);
  assert.match(section, /--locations-flagships-media-ratio:/);
  assert.match(section, /--locations-flagships-media-fit:/);
});

test('loads the gallery enhancement as a deferred theme asset', () => {
  assert.match(section, /<script\s+src="{{ 'locations-flagships\.js' \| asset_url }}"\s+type="module"><\/script>/);
});
