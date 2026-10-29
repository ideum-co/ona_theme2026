import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const source = read('blocks/product-brew-guide.liquid');

/*
 * Code only. The {%- doc -%} header explains why there is no inline <style>. An earlier draft of
 * this file failed on correct code because assertions found forbidden words in explanatory prose.
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
   */
  assert.match(block, /assign labels = product\.metafields\.custom\.brew_spec_labels\.value/, 'list metafields need .value');
  assert.match(block, /assign values = product\.metafields\.custom\.brew_spec_values\.value/, 'list metafields need .value');

  assert.match(block, /assign intro = product\.metafields\.custom\.brew_guide_intro\b(?!\.value)/, 'rich text takes no .value');

  /*
   * A rich_text_field printed as a bare drop exposes its structured representation rather than the
   * authored HTML; `metafield_tag` is the filter Shopify provides for it. The rest of this template
   * already does this -- product.json's `description_video` and the three `who_is_for` descriptions
   * all go through it. Codex, #240.
   */
  assert.match(block, /\{\{ intro \| metafield_tag \}\}/, 'rich text must be rendered through metafield_tag');
});

test('the tab does not link to a second copy of its brewing content', () => {
  assert.doesNotMatch(block, /articles\[|select_artlice|brew-guide__link|link_label/, 'the tab contains the complete recipe and needs no article link');
  const brew = readTemplate('product.json').sections.product_tabs_fW4maV.blocks.product_tab_4tzPxX.blocks.brew_guide_Qm4rTp;
  assert.deepEqual(brew.settings, {}, 'the removed link setting must not linger in the template');
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

test('product descriptions live in Profile on templates that have a Profile tab', () => {
  for (const name of ['product.json', 'product.non-coffee.json']) {
    const template = readTemplate(name);
    const details = template.sections.main.blocks['product-details'];
    const content = template.sections.product_tabs_fW4maV.blocks.product_tab_ePcCkQ.blocks
      .media_with_text_NwxVtm.blocks.content;
    assert.ok(!details.block_order.includes('text_aEtTtq'), `${name}: description must not extend the purchase column`);
    assert.ok(!content.block_order.includes('text_aEtTtq'), `${name}: description must not duplicate the profile copy`);
    assert.equal(content.blocks.text_aEtTtq, undefined, `${name}: remove the duplicated description block`);
    assert.equal(
      content.blocks.text_C78MjG.settings.text,
      '{{ closest.product.metafields.custom.profile_intro | metafield_tag }}',
      `${name}: keep Shopify's supported dynamic metafield source`,
    );
    assert.equal(content.blocks.text_C78MjG.settings.fallback_to_product_description, true,
      `${name}: opt into the description fallback in the text block`);
    assert.equal(details.settings.sticky_details_desktop, false, `${name}: long purchase columns must scroll with the page`);
  }

  const textBlock = read('blocks/text.liquid');
  assert.match(textBlock, /if block\.settings\.fallback_to_product_description[\s\S]*?assign fallback_text = closest\.product\.description/);
  assert.match(textBlock, /render 'text', block: block, fallback_text: fallback_text/);
});
