import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const stripBanner = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

const schemaOf = (type) => {
  for (const dir of ['blocks', 'sections']) {
    for (const name of [type, `_${type}`]) {
      const path = resolve(root, dir, `${name}.liquid`);
      if (!existsSync(path)) continue;
      const match = readFileSync(path, 'utf8').match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
      if (!match) continue;
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    }
  }
  return null;
};

/*
 * A `select` setting whose stored value is not one of its options is not a
 * loud failure: Shopify may reset it in the editor or drop it on save, and
 * the storefront usually renders the raw string, so the page looks right
 * until someone opens the theme editor.
 *
 * That is how PR #211 shipped `"width": "100%"` on four `group` blocks, whose
 * schema allows only fit-content / fill / custom, and `"alignment":
 * "flex-start"` on text blocks, whose `text_alignment` takes `left`. Both
 * came from copying the shape of a neighbouring block instead of reading the
 * schema. Codex caught it.
 */
const violations = () => {
  const found = [];
  const walk = (node, where) => {
    for (const [id, block] of Object.entries(node.blocks ?? {})) {
      const schema = schemaOf(block.type);
      if (schema) {
        const options = Object.fromEntries(
          (schema.settings ?? [])
            .filter((s) => s.type === 'select' && s.options)
            .map((s) => [s.id, s.options.map((o) => o.value)]),
        );
        for (const [key, value] of Object.entries(block.settings ?? {})) {
          if (typeof value === 'string' && options[key] && !options[key].includes(value)) {
            found.push(`${block.type}.${key}=${JSON.stringify(value)}`);
          }
        }
      }
      walk(block, `${where}.${id}`);
    }
  };

  const files = [
    ...readdirSync(resolve(root, 'templates')).filter((f) => f.endsWith('.json')).map((f) => `templates/${f}`),
    ...readdirSync(resolve(root, 'sections')).filter((f) => f.endsWith('.json')).map((f) => `sections/${f}`),
  ];
  for (const file of files) {
    let parsed;
    try {
      parsed = JSON.parse(stripBanner(read(file)));
    } catch {
      continue;
    }
    for (const [id, section] of Object.entries(parsed.sections ?? {})) walk(section, `${file}:${id}`);
  }
  return [...new Set(found)].sort();
};

/*
 * The complete set, not a sample -- a new off-schema value has to fail rather
 * than hide among known ones.
 *
 * These two are pre-existing and live in files the theme editor owns, so they
 * are the merchant's values rather than the repo's: `font_size` and
 * `letter_spacing` are `select` settings whose option lists do not cover every
 * value the editor has written. Left recorded rather than "fixed", because
 * editing a shop-owned template from here is exactly what
 * tests/shop-owned-templates.test.mjs exists to prevent.
 */
const KNOWN = [
  'product-title.font_size="1.875rem"',
  'text.letter_spacing="0.18em"',
];

test('every select setting in a template holds a value its schema allows', () => {
  assert.deepEqual(
    violations(),
    KNOWN,
    'a template setting is off-schema; the theme editor may reset or drop it',
  );
});
