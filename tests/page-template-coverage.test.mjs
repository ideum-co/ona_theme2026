import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

/*
 * Every `templateSuffix` the shop's published pages actually use, read off the
 * live store on 2026-10-20. A suffix with no template falls back to
 * `templates/page.json`, which renders the title and body and nothing else --
 * silently, with no error anywhere.
 *
 * That had already happened to five published pages. The visible cost, measured
 * against the legacy theme: /pages/womenincoffee rendered 494px against 2,732px
 * and lost all five of its images, /pages/recycled-boxes 584px against 1,025px
 * and lost its one.
 */
const SUFFIXES_IN_USE = [
  'about',
  'bookings',
  'contact',
  'faq',
  'faq-subscriptions',
  'learn',
  'llms',
  'location',
  'private-courses-and-experiences',
  'privacy',
  'sustainability',
  'text-template',
  'training',
  'wholesale',
];

/*
 * `maintenance` is absent on purpose; `html-sitemap` is on an unpublished page.
 *
 * `llms` used to be on this list, on the stated grounds that it was "absent
 * from the legacy theme too". That was checked against theme 160815546559,
 * which is itself an unfinished Horizon port rather than the theme that was
 * live. The genuine pre-Horizon theme, 147508887743, carries BOTH
 * templates/page.llms.liquid (4,062 bytes) and templates/page.maintenance.liquid
 * (383 bytes), so the fallback was a regression after all -- and because both
 * Shopify pages have an empty body, the fallback serves nothing whatsoever.
 *
 * `maintenance` stays off for a different and verified reason: its template is
 * a single full-bleed image, `maintenance-page-2.jpg`, which is not among this
 * theme's assets. Porting the template without the asset would render a broken
 * image on an unlinked, dormant page -- worse than the empty fallback. Bring
 * the asset across first.
 */
const DELIBERATELY_ABSENT = ['maintenance', 'html-sitemap'];

test('every page template suffix the shop uses has a template', () => {
  const missing = SUFFIXES_IN_USE.filter(
    (s) => !existsSync(resolve(root, `templates/page.${s}.json`)) &&
           !existsSync(resolve(root, `templates/page.${s}.liquid`)),
  );
  assert.deepEqual(missing, [], `published pages would fall back to the bare default: ${missing.join(', ')}`);
});

test('the suffixes left out are left out on purpose', () => {
  for (const s of DELIBERATELY_ABSENT) {
    assert.ok(
      !SUFFIXES_IN_USE.includes(s),
      `${s} is in both lists; decide which it is`,
    );
  }
});

test('the sustainability template renders the gallery the page carries', () => {
  const template = JSON.parse(read('templates/page.sustainability.json').replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));
  const types = Object.values(template.sections).map((s) => s.type);
  assert.ok(types.includes('main-page'), 'the page title and body come from Horizon\'s own section');
  assert.ok(types.includes('ona-page-media-gallery'), 'the accentuate.image gallery must be on this template');
});

test('the gallery reads the deprecated metafield the way Liquid actually exposes it', () => {
  /*
   * `accentuate.image` is a `json_string`, one of Shopify's deprecated
   * metafield types. Those do NOT carry the `.value` property modern types do:
   * `page.metafields.accentuate.image.value` returns nil and the gallery
   * renders nothing at all, silently. The first draft of this section had
   * exactly that bug.
   *
   * Ground truth is the section rendering these images today on theme
   * 160815546559, which iterates `page.metafields.accentuate.image` directly.
   * https://shopify.dev/docs/api/liquid/objects/metafield#deprecated-metafields
   */
  const section = read('sections/ona-page-media-gallery.liquid');
  assert.match(
    section,
    /assign raw = page\.metafields\.accentuate\.image\s*$/m,
    'the metafield must be read directly',
  );
  assert.doesNotMatch(
    section,
    /page\.metafields\.accentuate\.image\.value/,
    '`.value` is nil on a json_string metafield and renders an empty gallery',
  );

  // Horizon-native, not another ported legacy section.
  assert.match(section, /\{% stylesheet %\}/, 'styles belong in {% stylesheet %}, not a {% style %} blob');
  assert.match(section, /\{% schema %\}/, 'it must be configurable in the editor');
  assert.doesNotMatch(section, /\bwowo\b|animate__/, 'the legacy animation hooks are inert in this theme');
  // Horizon has two breakpoints; 575.98px is the bootstrap one the legacy sections use.
  assert.doesNotMatch(section, /575\.98|991\.98|767\.98/, 'use Horizon\'s 749/989 breakpoints');
});

test('the gallery images are marked decorative rather than repeating the page title', () => {
  /*
   * The metafield carries URLs and nothing else, so there is no per-image
   * description. An earlier draft used alt="{{ page.title }}", which on
   * /pages/womenincoffee announces "Women In Coffee" five times and says
   * nothing about any image. Empty alt marks them decorative so a screen
   * reader skips to the prose that actually describes the campaign -- which
   * is also what the section serving these today does. Codex, #210.
   */
  const section = read('sections/ona-page-media-gallery.liquid');
  const img = section.match(/<img\b[\s\S]*?>/);
  assert.ok(img, 'the gallery must render an image');
  assert.match(img[0], /\balt=""/, 'gallery images are decorative');
  assert.doesNotMatch(img[0], /alt="\{\{\s*page\.title/, 'the page title is not alternative text for five different photographs');
});

test('the llms index is served by the template, not by an empty page body', () => {
  /*
   * The Shopify page `llms` has an empty body, so nothing a crawler reads comes
   * from page content -- it all has to be in the template. Falling back to
   * templates/page.json served four characters: an <h1> reading "llms".
   *
   * `{% layout none %}` matters as much as the content: wrapped in the theme
   * layout this becomes a normal page with a header, a footer and the cart
   * drawer, which is not what an llms.txt index is for.
   */
  const tpl = read('templates/page.llms.liquid');

  assert.match(tpl, /\{% layout none %\}/, 'the index must be served without the theme layout');
  assert.doesNotMatch(tpl, /page\.content|\{\{\s*page\.body/, 'the page body is empty; the content belongs in the template');

  // The hubs it exists to point at, and the shape llms.txt readers expect.
  for (const needle of [
    '# onacoffee.com.au',
    '/pages/about',
    '/pages/locations',
    '/pages/contact',
    '/pages/wholesale',
    '/pages/privacy',
    '/pages/faq',
    '/blogs/news',
    '/blogs/brewguides',
    '/collections/filter',
    '/collections/espresso',
    '/collections/coffee-subscriptions',
  ]) {
    assert.ok(tpl.includes(needle), `the llms index must still list ${needle}`);
  }

  /*
   * It tells models to prefer hubs over individual items, so it must not
   * contradict itself by linking any single product or article.
   */
  assert.doesNotMatch(tpl, /onacoffee\.com\.au\/products\//, 'the index tells models to avoid product URLs');
  assert.doesNotMatch(tpl, /\/blogs\/[a-z-]+\/[a-z-]+/, 'the index tells models to reference blog hubs, not articles');
  // And must not send them anywhere transactional or account-bound.
  for (const forbidden of ['/cart', '/checkout', '/account']) {
    assert.ok(!tpl.includes(`onacoffee.com.au${forbidden}`), `the index must not point at ${forbidden}`);
  }
});
