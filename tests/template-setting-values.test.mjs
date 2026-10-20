import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

const schemaCache = new Map();
const schemaOf = (type, dirs) => {
  const key = `${dirs.join()}:${type}`;
  if (schemaCache.has(key)) return schemaCache.get(key);
  let found = null;
  for (const dir of dirs) {
    for (const name of [type, `_${type}`]) {
      const path = resolve(root, dir, `${name}.liquid`);
      if (!existsSync(path)) continue;
      const match = readFileSync(path, 'utf8').match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
      if (!match) continue;
      try {
        found = JSON.parse(match[1]);
      } catch {
        found = null;
      }
      if (found) break;
    }
    if (found) break;
  }
  schemaCache.set(key, found);
  return found;
};

/*
 * Shopify's `text_alignment` is an enum like `select`, but it declares no
 * `options` -- the allowed values are the platform's, not the schema's.
 * Leaving it out is how the first version of this test passed while the exact
 * bug it was written for, `"alignment": "flex-start"` on a text block, was
 * still present. Codex, #211.
 *
 * `left` and `center` are the only values this theme stores across all
 * templates; `right` is the third the platform accepts.
 */
const TEXT_ALIGNMENT_VALUES = ['left', 'center', 'right'];

const allowedValues = (schema) => {
  const out = {};
  for (const setting of schema?.settings ?? []) {
    if (setting.type === 'select' && setting.options) {
      out[setting.id] = setting.options.map((o) => o.value);
    } else if (setting.type === 'text_alignment') {
      out[setting.id] = TEXT_ALIGNMENT_VALUES;
    }
  }
  return out;
};

const violations = () => {
  const found = [];

  const check = (node, type, dirs, where) => {
    const allowed = allowedValues(schemaOf(type, dirs));
    for (const [key, value] of Object.entries(node.settings ?? {})) {
      if (typeof value === 'string' && allowed[key] && !allowed[key].includes(value)) {
        // The location is part of the record: a tuple alone would let a new
        // occurrence hide behind an allowlisted one somewhere else.
        found.push(`${where} ${type}.${key}=${JSON.stringify(value)}`);
      }
    }
    for (const [id, child] of Object.entries(node.blocks ?? {})) {
      check(child, child.type, ['blocks', 'sections'], `${where}.${id}`);
    }
  };

  const files = [
    ...readdirSync(resolve(root, 'templates')).filter((f) => f.endsWith('.json')).map((f) => `templates/${f}`),
    ...readdirSync(resolve(root, 'sections')).filter((f) => f.endsWith('.json')).map((f) => `sections/${f}`),
  ];
  for (const file of files) {
    let parsed;
    try {
      parsed = JSON.parse(stripComments(read(file)));
    } catch {
      continue;
    }
    // Sections carry their own settings and their own schema, in sections/.
    for (const [id, section] of Object.entries(parsed.sections ?? {})) {
      check(section, section.type, ['sections', 'blocks'], `${file}:${id}`);
    }
  }
  return found.sort();
};

/*
 * The complete set, with locations, so a new off-schema value fails rather
 * than hiding behind an allowlisted tuple elsewhere.
 *
 * These live in files the theme editor owns, so they are the merchant's
 * values: `font_size` and `letter_spacing` are selects whose option lists do
 * not cover everything the editor has written. Recorded rather than "fixed" --
 * editing a shop-owned template from here is what
 * tests/shop-owned-templates.test.mjs exists to prevent.
 */
const KNOWN = [
  'sections/footer-group.json:brand.wordmark text.letter_spacing="0.18em"',
  'templates/collection.json:main main-collection.mobile_product_card_size="medium"',
  'templates/collection.json:main.product-card.product_title_4nY4eT product-title.font_size="1.875rem"',
  'templates/index.json:coffee_spotlight.static-product-card.product_title product-title.font_size="1.875rem"',
  'templates/index.json:special_release media-with-content.media_height="small"',
  'templates/search.json:main search-results.mobile_product_card_size="medium"',
].sort();

test('every enum setting in a template holds a value its schema allows', () => {
  assert.deepEqual(
    violations(),
    KNOWN,
    'a template setting is off-schema; the theme editor may reset or drop it',
  );
});
