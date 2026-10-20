import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const source = read('blocks/product-origin-story.liquid');

/*
 * Code only. The {%- doc -%} header names the very things these guards assert are absent -- an
 * inline <style>, the accentuate namespace -- so a guard run over the prose fails on correct code
 * and can be fooled into passing by a comment. Same lesson as tests/product-brew-guide.test.mjs
 * and tests/locations-flagship-tabs.test.mjs.
 */
const block = source
  .replace(/\{%-?\s*doc\s*-?%\}[\s\S]*?\{%-?\s*enddoc\s*-?%\}/g, '')
  .replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
  .replace(/^\s*#.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const readTemplate = (name) => JSON.parse(read(`templates/${name}`).replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));

/*
 * Where a coffee comes from is the single biggest thing the Horizon port dropped: 17 of 60 active
 * products carry origin copy or specs, and not one of them rendered any of it. The template did
 * ship a `story` section for exactly this, but it read `accentuate.*` -- the namespace the fields
 * were migrated out of -- so it could only ever have drawn a blank, which is why it is disabled.
 */

test('nothing renders unless the product actually has origin content', () => {
  /*
   * This is the whole hide-on-blends-and-merch mechanism. #236 prunes a tab whose panel renders
   * nothing, so "emit no markup" IS "hide the tab". If the guard ever lets an empty wrapper
   * through, an Origin tab appears on all 43 products that have no origin.
   */
  const guardStart = block.indexOf('{%- if origin != blank or sourcing != blank or has_specs -%}');
  assert.ok(guardStart > -1, 'the markup must be guarded on all three sources at once');

  assert.match(block.slice(guardStart), /class="origin-story"/, 'the wrapper belongs inside the guard');
  assert.doesNotMatch(block.slice(0, guardStart), /<(div|dl|dt|dd|h3|p|a)\b/, 'nothing may be emitted before the guard');

  // has_specs must mean "any one of them", not "all of them".
  assert.match(
    block,
    /if producer != blank or region != blank or varietal != blank or process != blank or altitude != blank/,
    'a product with only a region still has an origin worth showing',
  );
});

test('the CSS is a theme stylesheet, never an inline <style>', () => {
  /*
   * Not a style preference -- a correctness requirement. #236 decides a panel is empty with
   * `panel.textContent.trim() === ''`, and a <style> element's text counts towards textContent.
   * An inline sheet would make every panel non-empty, pruning would stop firing, and the Origin
   * tab would come back on every product with an empty panel behind it.
   *
   * The superseded `story` section did inline its <style>.
   */
  assert.match(block, /\{%\s*stylesheet\s*%\}/, 'the rules belong in a theme stylesheet');
  assert.doesNotMatch(block, /<style\b/i, 'an inline <style> would defeat the empty-tab pruning');
  assert.match(block, /\.origin-story \{/, 'and the stylesheet must actually carry the rules');
});

test('the fields come from custom, which is where they were migrated to', () => {
  /*
   * The whole reason the `story` section shows nothing. Reading accentuate.* here would reproduce
   * the bug this block exists to fix, silently: every value comes back nil, every `!= blank` is
   * false, the guard never opens and the suite stays green.
   */
  assert.doesNotMatch(block, /metafields\.accentuate\./, 'these fields live in custom.* now');

  for (const key of ['origin_intro', 'sourcing_intro', 'producer', 'region', 'varietal', 'process', 'altitude']) {
    assert.match(block, new RegExp(`product\\.metafields\\.custom\\.${key}\\b`), `custom.${key} must be read`);
  }
});

test('each metafield is read the way its own type requires', () => {
  /*
   * Measured against the live metafield definitions, not assumed:
   *   custom.origin_intro    rich_text_field        -> metafield_tag, no .value
   *   custom.sourcing_intro  rich_text_field        -> metafield_tag, no .value
   *   custom.producer etc.   single_line_text_field -> .value is the string
   *
   * A rich_text_field printed as a bare drop exposes its structured representation -- a literal
   * `{"type":"root"...` on the page -- rather than the authored HTML. Codex caught this twice on
   * #240; the rest of the template already goes through metafield_tag.
   */
  assert.match(block, /assign origin = product\.metafields\.custom\.origin_intro\b(?!\.value)/, 'rich text takes no .value');
  assert.match(block, /assign sourcing = product\.metafields\.custom\.sourcing_intro\b(?!\.value)/, 'rich text takes no .value');
  assert.match(block, /\{\{ origin \| metafield_tag \}\}/, 'origin copy must go through metafield_tag');
  assert.match(block, /\{\{ sourcing \| metafield_tag \}\}/, 'sourcing copy must go through metafield_tag');

  for (const key of ['producer', 'region', 'varietal', 'process', 'altitude']) {
    assert.match(block, new RegExp(`assign ${key} = product\\.metafields\\.custom\\.${key}\\.value \\| strip`), `${key} is a single_line_text_field: .value, stripped`);
  }
});

test('the rules are drawn in currentColor, not a fixed border token', () => {
  /*
   * The tabs section paints the panel from the product's own pdp_background_color and sets the
   * foreground to match. Eleven product colours are in use, so a hard-coded rule colour is
   * invisible on at least one of them. Same rule as the brew guide.
   */
  const stylesheet = block.slice(block.indexOf('{% stylesheet %}'));
  assert.match(stylesheet, /border-block-end: 1px solid currentColor/, 'the row rules follow the text colour');
  assert.doesNotMatch(stylesheet, /var\(--border-color\)|#[0-9a-f]{3,8}\b/i, 'no fixed colour survives eleven product palettes');
});

test('the Origin tab sits between Profile and Brew Guide and holds the block', () => {
  const section = readTemplate('product.json').sections.product_tabs_fW4maV;
  const tab = section.blocks.product_tab_origin_Hq2Lvn;

  assert.ok(tab, 'the tab must exist');
  assert.equal(tab.settings.label, 'Origin');
  assert.ok(!tab.disabled, 'the tab is what shows the story; disabled it shows nothing');

  const types = (tab.block_order ?? []).map((id) => tab.blocks[id]?.type);
  assert.deepEqual(types, ['product-origin-story'], 'the tab must hold the origin block');

  /*
   * Reading order, not decoration: what it tastes like, then where it is from, then how to brew
   * it. Asserted because block_order is the only thing that fixes it and a JSON merge can reorder
   * it without anything else noticing.
   */
  const order = section.block_order;
  assert.ok(
    order.indexOf('product_tab_ePcCkQ') < order.indexOf('product_tab_origin_Hq2Lvn'),
    'Profile comes before Origin',
  );
  assert.ok(
    order.indexOf('product_tab_origin_Hq2Lvn') < order.indexOf('product_tab_4tzPxX'),
    'Origin comes before Brew Guide',
  );
});
