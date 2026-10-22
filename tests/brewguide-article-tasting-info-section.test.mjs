import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const source = read('sections/brewguide-article-tasting-info.liquid');

/*
 * Split out of sections/brewguide-article-info.liquid specifically so the Tastes Like / Roast
 * info can render near the article title again, matching the pre-migration layout -- see this
 * section's own doc comment, and tests/brewguide-article-info-section.test.mjs for the sibling
 * section (recipe + cross-sell) that stayed after the full article body. Same "code only, strip
 * comments" discipline as tests/collection-itemlist-schema.test.mjs.
 */
const code = source.replace(/\{%-?\s*doc\s*-?%\}[\s\S]*?\{%-?\s*enddoc\s*-?%\}/g, '');

test('templates/article.json wires this section in before the existing main-blog-post one, not after', () => {
  // Codex, PR #282: bundling this into the same section as the recipe/cross-sell (both placed
  // after main-blog-post) put the tasting info below the full article body instead of near the
  // title, since main-blog-post's own block_order can't be interleaved with a sibling section.
  const template = JSON.parse(read('templates/article.json').replace(/^\/\*[\s\S]*?\*\/\s*/, ''));
  assert.ok(template.sections['brewguide-tasting-info'], 'templates/article.json must define a brewguide-tasting-info section entry');
  assert.equal(template.sections['brewguide-tasting-info'].type, 'brewguide-article-tasting-info', 'the entry must use this section\'s type');
  const order = template.order;
  const tastingIndex = order.indexOf('brewguide-tasting-info');
  const mainIndex = order.indexOf('section');
  assert.ok(tastingIndex > -1 && mainIndex > -1, 'both sections must appear in order');
  assert.ok(tastingIndex < mainIndex, 'brewguide-tasting-info must render before the main-blog-post section (title/image/body), not after it');
});

test('every piece is gated on article.blog.handle == \'brewguides\', so News/Journal articles stay untouched', () => {
  const gateIndex = code.indexOf("if article.blog.handle == 'brewguides'");
  assert.ok(gateIndex > -1, 'must gate on article.blog.handle, not render unconditionally for every blog sharing templates/article.json');
  const ifBrewguideIndex = code.indexOf('if is_brewguide_article');
  assert.ok(ifBrewguideIndex > gateIndex, 'the blog-handle check must set the flag the rendering is gated on');
});

test('tastes like / roast info only renders when at least one of the two has a value', () => {
  assert.match(code, /assign has_info = false\s*\n\s*if tastes_like != blank or roast != blank\s*\n\s*assign has_info = true/, 'has_info must only be set when accentuate.tastes_like or accentuate.roast is non-blank');
  assert.match(code, /\{%-\s*if has_info\s*-%\}[\s\S]*?<div class="section">/, 'the .section wrapper must be gated on has_info, never emitted empty');
  assert.match(code, /\{%-\s*if tastes_like != blank\s*-%\}/, 'tastes_like row must be independently guarded');
  assert.match(code, /\{%-\s*if roast != blank\s*-%\}/, 'roast row must be independently guarded, so one being blank does not hide the other');
});

test('no Jinja-style {# #} comment delimiters -- Liquid does not recognise them, so they would render as visible text', () => {
  assert.doesNotMatch(source, /\{#/, 'must not contain any {# ... #} Jinja-style comment delimiter');
  assert.match(source, /\{%-?\s*comment\s*-?%\}/, 'the developer note must use a real Liquid comment tag instead');
});

test('spacing token is one already proven to resolve elsewhere in this theme', () => {
  assert.doesNotMatch(code, /var\(--margin-xl\)/, 'must not reference the undefined --margin-xl token (same class of bug Codex caught on the sibling section: --margin-3xl etc. are never declared anywhere in this theme)');
  assert.match(code, /margin-block-end:\s*var\(--gap-xl\)/, 'must use the proven --gap-xl token instead');
});

test('the section schema has no visible settings and a preset, matching the other pruning-safe PDP/article blocks', () => {
  const schemaStart = code.indexOf('{% schema %}');
  const schemaEnd = code.indexOf('{% endschema %}');
  assert.ok(schemaStart > -1 && schemaEnd > schemaStart, 'the schema tag must exist');
  const schema = JSON.parse(code.slice(schemaStart + '{% schema %}'.length, schemaEnd));
  assert.equal(schema.name, 'Brew guide article tasting info');
  assert.ok(Array.isArray(schema.presets) && schema.presets.length === 1, 'must have exactly one preset so it can be added back from the theme editor if ever removed');
  assert.equal(schema.tag, undefined, 'tag must be omitted (section schema does not accept tag: null the way a theme block schema does)');
});
