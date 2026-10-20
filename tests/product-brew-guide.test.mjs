import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const source = read('blocks/product-brew-guide.liquid');

/*
 * Code only. The {%- doc -%} header explains why there is no inline <style> and why the article is
 * not found by scanning blogs.brewguides.articles -- and the first draft of this file then failed
 * on correct code, because the assertions found those words in the prose describing their absence.
 * A guard that reads documentation as implementation can be fooled in both directions, so the
 * comments come out first. Same lesson as tests/locations-flagship-tabs.test.mjs.
 */
const block = source
  .replace(/\{%-?\s*doc\s*-?%\}[\s\S]*?\{%-?\s*enddoc\s*-?%\}/g, '')
  .replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
  .replace(/^\s*#.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const readTemplate = (name) => JSON.parse(read(`templates/${name}`).replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));

/*
 * The brew guide was content the old theme showed and this one dropped. It is back as a tab rather
 * than a section because the tab can disappear: 15 coffees have a recipe, 37 merch and equipment
 * products do not, and nobody wants to tick a box per product.
 */

test('nothing renders unless the product actually has brew content', () => {
  /*
   * This is the whole hide-on-products-without-a-recipe mechanism. #236 prunes a tab whose panel
   * renders nothing, so "emit no markup" IS "hide the tab". If the guard ever lets an empty
   * wrapper through, the Brew Guide tab reappears on every product in the store.
   */
  assert.match(block, /\{%-?\s*if intro != blank or spec_count > 0\s*-?%\}/, 'the markup must be guarded');

  const guarded = block.slice(block.indexOf('{%- if intro != blank'));
  assert.match(guarded, /class="brew-guide"/, 'the wrapper belongs inside the guard');

  const beforeGuard = block.slice(0, block.indexOf('{%- if intro != blank'));
  assert.doesNotMatch(beforeGuard, /<(div|dl|p|a)\b/, 'nothing may be emitted before the guard');
});

test('the CSS is a theme stylesheet, never an inline <style>', () => {
  /*
   * Not a style preference -- a correctness requirement. #236 decides a panel is empty with
   * `panel.textContent.trim() === ''`, and a <style> element's text counts towards textContent.
   * An inline sheet would therefore make every panel non-empty, pruning would stop firing, and the
   * Brew Guide tab would come back on all 37 non-coffee products with an empty panel behind it.
   *
   * The previous implementation (the disabled `brew_guide` section) did inline its <style>.
   */
  assert.match(block, /\{%\s*stylesheet\s*%\}/, 'the rules belong in a theme stylesheet');
  assert.doesNotMatch(block, /<style\b/i, 'an inline <style> would defeat the empty-tab pruning');
  assert.match(block, /\.brew-guide \{/, 'and the stylesheet must actually carry the rules');
});

test('each metafield is read the way its own type requires', () => {
  /*
   * Measured on the live products, not assumed:
   *   custom.brew_guide_intro    rich_text_field             -> render it; .value is a hash
   *   custom.brew_spec_labels    list.single_line_text_field -> .value is the array
   *   custom.brew_spec_values    list.single_line_text_field -> .value is the array
   *   accentuate.select_artlice  string (DEPRECATED)         -> .value is NIL
   *
   * The deprecated types are the trap. `string`, `integer` and `json_string` predate the metafield
   * properties, so `.value` on them is nil and every downstream `!= blank` is quietly false -- the
   * feature renders nothing, no error appears, and the suite stays green. The superseded
   * `brew_guide` section made exactly this mistake on `content_brew_guide.value` and
   * `select_artlice.value`, which is one reason it never worked.
   */
  assert.match(block, /assign labels = product\.metafields\.custom\.brew_spec_labels\.value/, 'list metafields need .value');
  assert.match(block, /assign values = product\.metafields\.custom\.brew_spec_values\.value/, 'list metafields need .value');

  assert.match(block, /assign intro = product\.metafields\.custom\.brew_guide_intro\b(?!\.value)/, 'rich text renders directly');
  assert.match(
    block,
    /assign guide_path = product\.metafields\.accentuate\.select_artlice \| strip/,
    'select_artlice is a deprecated `string`: .value is nil, read it directly',
  );
  assert.doesNotMatch(block, /select_artlice\.value/, '.value on a deprecated string metafield is nil');
});

test('the article is a direct lookup, not a scan of every brew guide', () => {
  /*
   * `select_artlice` already holds "brewguides/aspen" -- the full path, not the handle. The
   * superseded section paginated blogs.brewguides.articles by 250 and compared `a.handle` to it,
   * a test that can never pass because "brewguides/aspen" != "aspen". So it loaded every article
   * on every product page to find nothing.
   */
  assert.match(block, /articles\[guide_path\]/, 'the path indexes the articles object directly');
  assert.doesNotMatch(block, /paginate|blogs\.brewguides\.articles/, 'no scan over the blog');
  assert.match(block, /if guide != blank and block\.settings\.link_label != blank/, 'no link to a missing article');
});

test('the two spec lists are paired only as far as both of them go', () => {
  /*
   * Labels and values are separate hand-maintained lists; nothing in Shopify keeps them the same
   * length. Indexing labels.size into the shorter list prints rows with an empty side.
   */
  assert.match(block, /if values\.size < spec_count/, 'pair to the shorter of the two lists');
  assert.match(block, /if label != blank and value != blank/, 'and skip a row missing either half');
});

test('the Brew Guide tab is enabled and holds the block', () => {
  const tabs = readTemplate('product.json').sections.product_tabs_fW4maV.blocks;
  const tab = tabs.product_tab_4tzPxX;

  assert.equal(tab.settings.label, 'Brew Guide');
  assert.ok(!tab.disabled, 'the tab is what shows the recipe; disabled it shows nothing');

  const types = (tab.block_order ?? []).map((id) => tab.blocks[id]?.type);
  assert.deepEqual(types, ['product-brew-guide'], 'the tab must hold the brew guide block');
});

test('the Profile tab has its own text rather than a second copy of the description', () => {
  /*
   * The description already renders in the details column, so the Profile tab was showing it
   * twice on one page. `custom.profile_intro` is a rich_text_field carrying the long-form profile
   * copy, present on every coffee (37 products without it are merch, equipment and matcha).
   */
  const content =
    readTemplate('product.json').sections.product_tabs_fW4maV.blocks.product_tab_ePcCkQ.blocks
      .media_with_text_NwxVtm.blocks.content.blocks;

  const texts = Object.values(content).map((b) => b.settings?.text ?? '');
  assert.ok(
    texts.some((t) => t.includes('metafields.custom.profile_intro')),
    'the Profile tab must read its own metafield',
  );
  assert.ok(
    !texts.some((t) => t.trim() === '{{ closest.product.description }}'),
    'the description belongs in the details column only',
  );
});
