import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const source = read('blocks/brewguide-article-tasting-info.liquid');

/*
 * Split out of sections/brewguide-article-info.liquid specifically so the Tastes Like / Roast
 * info can render near the article title again, matching the pre-migration layout. A BLOCK, not
 * a second sibling section: see this file's own doc comment for why (main-blog-post's title is
 * the first block INSIDE that section, so only a block nested in its own block_order can land
 * between the title and the rest of the post -- a sibling section can only go fully before or
 * fully after the whole thing). Same "code only, strip comments" discipline as
 * tests/collection-itemlist-schema.test.mjs.
 */
const code = source.replace(/\{%-?\s*doc\s*-?%\}[\s\S]*?\{%-?\s*enddoc\s*-?%\}/g, '');

test('templates/article.json nests this block in main-blog-post\'s own block_order, right after the title', () => {
  // Codex, PR #282 round 3: a sibling section placed before "section" rendered the info ABOVE
  // the <h1> (the title is the first thing INSIDE main-blog-post, not before it) -- the opposite
  // problem from round 2's "below the whole article body". main-blog-post's own schema declares
  // "@theme" and "@app" block slots alongside its private _blog-post-* ones, so a block is
  // actually accepted there, unlike trying to interleave a second top-level section.
  const template = JSON.parse(read('templates/article.json').replace(/^\/\*[\s\S]*?\*\/\s*/, ''));
  const mainSection = template.sections.section;
  assert.ok(mainSection, 'templates/article.json must still define the main-blog-post section');
  assert.ok(mainSection.blocks['blog-post-tasting-info'], 'main-blog-post must carry a blog-post-tasting-info block entry');
  assert.equal(mainSection.blocks['blog-post-tasting-info'].type, 'brewguide-article-tasting-info', 'the entry must use this block\'s type');
  const order = mainSection.block_order;
  const titleIndex = order.indexOf('blog-post-title');
  const tastingIndex = order.indexOf('blog-post-tasting-info');
  assert.ok(titleIndex > -1 && tastingIndex > -1, 'both blocks must appear in block_order');
  assert.equal(tastingIndex, titleIndex + 1, 'the tasting-info block must sit immediately after the title block, not anywhere else in block_order');
  assert.ok(
    !Object.prototype.hasOwnProperty.call(template.sections, 'brewguide-tasting-info') && !(template.order || []).includes('brewguide-tasting-info'),
    'the old top-level sibling-section entry must be gone, not left alongside the new block entry'
  );
});

test('every piece is gated on blog.handle == \'brewguides\', so News/Journal articles stay untouched', () => {
  // A live diagnostic (PR #286/#287) proved article.blog.handle resolves blank in this theme's
  // actual rendering of this block, even though article.metafields.* on the same object reads
  // correctly -- so the gate uses the simpler, standard `blog` context object instead.
  const gateIndex = code.indexOf("if blog.handle == 'brewguides'");
  assert.ok(gateIndex > -1, 'must gate on blog.handle, not render unconditionally for every blog sharing templates/article.json');
  assert.ok(!code.includes('article.blog.handle'), 'article.blog.handle resolves blank in this theme -- must not reintroduce it as the gate');
  const ifBrewguideIndex = code.indexOf('if is_brewguide_article');
  assert.ok(ifBrewguideIndex > gateIndex, 'the blog-handle check must set the flag the rendering is gated on');
});

test('tastes like / roast info only renders when at least one of the two has a value', () => {
  assert.match(code, /assign has_info = false\s*\n\s*if tastes_like != blank or roast != blank\s*\n\s*assign has_info = true/, 'has_info must only be set when accentuate.tastes_like or accentuate.roast is non-blank');
  assert.match(code, /\{%-\s*if has_info\s*-%\}\s*\n\s*<dl class="brewguide-article-info"/, 'the info list must be gated on has_info, never emitted empty');
  assert.match(code, /\{%-\s*if tastes_like != blank\s*-%\}/, 'tastes_like row must be independently guarded');
  assert.match(code, /\{%-\s*if roast != blank\s*-%\}/, 'roast row must be independently guarded, so one being blank does not hide the other');
});

test('uses dt/dd for each label/value pair, matching the semantic markup the sibling recipe section uses for the same shape', () => {
  // Raised in an independent review of PR #282: this block originally used plain <span>s for a
  // "label: value" pair while sections/brewguide-article-info.liquid's recipe spec table used
  // real <dt>/<dd> inside a <dl> for the identical shape. Not a functional bug, but worth
  // matching -- and a <dl>/<dd> carries default browser margins a <div>/<span> pair doesn't, so
  // the stylesheet must reset them explicitly rather than relying on span defaults being zero.
  const dtCount = (code.match(/<dt class="brewguide-article-info__label">/g) || []).length;
  const ddCount = (code.match(/<dd class="brewguide-article-info__value">/g) || []).length;
  assert.equal(dtCount, 2, 'both the tastes-like and roast rows must use <dt> for their label');
  assert.equal(ddCount, 2, 'both the tastes-like and roast rows must use <dd> for their value');
  assert.match(code, /\.brewguide-article-info\s*\{[^}]*margin:\s*0/, 'the <dl> itself needs margin: 0 reset (browsers give dl a default block margin)');
  assert.match(code, /\.brewguide-article-info__value\s*\{[^}]*margin:\s*0/, 'each <dd> needs margin: 0 reset (browsers give dd a default margin-inline-start)');
});

test('no nested .section wrapper -- this renders inside main-blog-post\'s own page-width wrapper already', () => {
  // Unlike the sibling recipe/cross-sell section (a top-level entry in templates/article.json's
  // own "order", which needs its own .section instance for page-width gutters), this block is a
  // child of main-blog-post's existing section-content-wrapper -- wrapping it in a second nested
  // .section would double up the grid.
  assert.doesNotMatch(code, /class="section"/, 'must not wrap its content in Horizon\'s .section grid class, unlike the sibling section');
});

test('block.shopify_attributes is present so the block is selectable in the theme editor', () => {
  assert.match(code, /\{\{ block\.shopify_attributes \}\}/, 'a block rendered via block_order needs block.shopify_attributes for editor selection/highlighting, same as other nested blocks in this theme');
});

test('no Jinja-style {# #} comment delimiters', () => {
  assert.doesNotMatch(source, /\{#/, 'must not contain any {# ... #} Jinja-style comment delimiter -- Liquid has no such syntax');
});

test('spacing token is one already proven to resolve elsewhere in this theme', () => {
  assert.doesNotMatch(code, /var\(--margin-xl\)/, 'must not reference the undefined --margin-xl token (same class of bug Codex caught on the sibling section: --margin-3xl etc. are never declared anywhere in this theme)');
});

test('the block schema name is under Shopify\'s 25-character limit and has a preset', () => {
  // Codex, PR #282 round 3: "Brew guide article tasting info" (31 chars) exceeds Shopify's
  // documented 25-character limit on section/block schema `name` and blocks the file from
  // syncing at all -- shortened to "Brew guide tasting info" (23 chars).
  const schemaStart = code.indexOf('{% schema %}');
  const schemaEnd = code.indexOf('{% endschema %}');
  assert.ok(schemaStart > -1 && schemaEnd > schemaStart, 'the schema tag must exist');
  const schema = JSON.parse(code.slice(schemaStart + '{% schema %}'.length, schemaEnd));
  assert.equal(schema.name, 'Brew guide tasting info');
  assert.ok(schema.name.length <= 25, `schema name must be <= 25 characters (Shopify's own limit), got ${schema.name.length}`);
  assert.ok(Array.isArray(schema.presets) && schema.presets.length === 1, 'must have exactly one preset so it can be added back from the theme editor if ever removed');
  assert.equal(schema.tag, null, 'tag: null is valid for a block (unlike a section) and means no extra wrapper element around this block\'s own markup');
});
