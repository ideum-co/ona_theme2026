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
  'location',
  'private-courses-and-experiences',
  'privacy',
  'sustainability',
  'text-template',
  'training',
  'wholesale',
];

/*
 * Deliberately absent, and absent from the legacy theme too, so the fallback is
 * not a regression: `maintenance` and `llms` render ~212px and two words on
 * BOTH themes, and `html-sitemap` is on an unpublished page. Listing them here
 * stops someone "fixing" the gap without checking that there is one.
 */
const DELIBERATELY_ABSENT = ['maintenance', 'llms', 'html-sitemap'];

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
