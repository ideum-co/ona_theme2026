import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const source = read('sections/brewguide-article-info.liquid');

/*
 * This section restores content the 2026 theme migration dropped from individual Brew Guides
 * blog articles: see sections/brewguide-article-info.liquid's own doc comment for the full
 * story (source: sections/article-template.liquid in Shopify theme 147471433919, "ONA - OLD
 * 11/26/2025"). Same "code only, strip comments" discipline as
 * tests/collection-itemlist-schema.test.mjs -- comment prose shouldn't satisfy a pattern match
 * meant to prove something about the actual Liquid.
 */
const code = source.replace(/\{%-?\s*doc\s*-?%\}[\s\S]*?\{%-?\s*enddoc\s*-?%\}/g, '');

test('templates/article.json wires in the new section, after the existing one', () => {
  const template = JSON.parse(read('templates/article.json').replace(/^\/\*[\s\S]*?\*\/\s*/, ''));
  assert.ok(template.sections['brewguide-info'], 'templates/article.json must define a brewguide-info section entry');
  assert.equal(template.sections['brewguide-info'].type, 'brewguide-article-info', 'the entry must use this section\'s type');
  assert.deepEqual(template.order, ['section', 'brewguide-info'], 'the new section must render after the existing main-blog-post section, not replace or precede it');
});

test('every piece is gated on article.blog.handle == \'brewguides\', so News/Journal articles stay untouched', () => {
  const gateIndex = code.indexOf("if article.blog.handle == 'brewguides'");
  assert.ok(gateIndex > -1, 'must gate on article.blog.handle, not render unconditionally for every blog sharing templates/article.json');
  const ifBrewguideIndex = code.indexOf('if is_brewguide_article');
  assert.ok(ifBrewguideIndex > gateIndex, 'the blog-handle check must set the flag the rendering is gated on');
});

test('tastes like / roast info only renders when at least one of the two has a value', () => {
  assert.match(code, /\{%-\s*if tastes_like != blank or roast != blank\s*-%\}/, 'the info block must not render when both accentuate.tastes_like and accentuate.roast are blank');
  assert.match(code, /\{%-\s*if tastes_like != blank\s*-%\}/, 'tastes_like row must be independently guarded');
  assert.match(code, /\{%-\s*if roast != blank\s*-%\}/, 'roast row must be independently guarded, so one being blank does not hide the other');
});

test('the recipe block only renders when there is an intro or at least one spec pair, matching the pruning-safe pattern in blocks/product-brew-guide.liquid', () => {
  assert.match(code, /\{%-\s*if guide_intro != blank or spec_count > 0\s*-%\}/, 'must gate the whole recipe block on intro-or-specs, not render an empty "Brew guide" heading over nothing');
});

test('spec_labels and spec_values are paired only as far as both lists go, same discipline as the product-level brew guide', () => {
  assert.match(code, /assign spec_count = 0/, 'spec_count must default to 0');
  assert.match(code, /if spec_labels\.size > 0 and spec_values\.size > 0/, 'must check both lists have entries before pairing');
  assert.match(code, /if spec_values\.size < spec_count[\s\S]{0,40}assign spec_count = spec_values\.size/, 'must shrink spec_count to the shorter list, never index past the end of either');
});

test('a spec row with a blank label or blank value is skipped, not emitted with an empty cell', () => {
  assert.match(code, /assign label = spec_labels\[index\] \| strip/, 'must read and strip the label before using it');
  assert.match(code, /assign value = spec_values\[index\] \| strip/, 'must read and strip the value before using it');
  assert.match(code, /\{%-\s*if label != blank and value != blank\s*-%\}/, 'each spec row must be guarded on both label and value being non-blank before it is emitted');
});

test('the cross-sell does a direct product lookup, not a loop over every product in the catalog', () => {
  assert.doesNotMatch(code, /for product in collections\.all\.products/, 'must not reproduce the old O(n) collections.all scan the legacy section used');
  assert.match(code, /assign cross_sell_product = all_products\[cross_sell_handle\]/, 'must use a direct all_products[handle] lookup instead');
  assert.match(code, /\{%-\s*if cross_sell_product != blank\s*-%\}/, 'the cross-sell card must only render when the lookup actually found a product');
});

test('the cross-sell only looks up a handle when accentuate.select_product is actually set', () => {
  assert.match(code, /assign cross_sell_product = blank/, 'cross_sell_product must default to blank');
  assert.match(code, /if cross_sell_handle != blank\s*\n\s*assign cross_sell_product = all_products\[cross_sell_handle\]/, 'the lookup itself must be guarded on cross_sell_handle being non-blank, so all_products[blank] is never attempted');
});

test('the section schema has no visible settings and a preset, matching the other pruning-safe PDP/article blocks', () => {
  const schemaStart = code.indexOf('{% schema %}');
  const schemaEnd = code.indexOf('{% endschema %}');
  assert.ok(schemaStart > -1 && schemaEnd > schemaStart, 'the schema tag must exist');
  const schema = JSON.parse(code.slice(schemaStart + '{% schema %}'.length, schemaEnd));
  assert.equal(schema.name, 'Brew guide article info');
  assert.ok(Array.isArray(schema.presets) && schema.presets.length === 1, 'must have exactly one preset so it can be added back from the theme editor if ever removed');
});
