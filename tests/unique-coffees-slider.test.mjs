import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const section = read('sections/ona-unique-coffees.liquid');
const layout = read('assets/legacy-page-layout.css');
const script = read('assets/ona-unique-coffees.js');

/*
 * The ported markup carries the pieces of a slider the legacy theme drove with
 * slick: one `.slider-block` of three images per coffee, one handle per coffee.
 * slick is not in this theme, so every block rendered at once -- nine images
 * stacked, 9,110px on /pages/wholesale, 39% of the page, against the old
 * theme's 475px.
 *
 * The real pre-Horizon theme (147508887743, Debut 17.13.0) overlays the blocks
 * and cross-fades: wrapper 637x332, blocks at left 0 / -637px / -1274px with
 * opacity 1 / 0 / 0.
 */
test('the coffee image groups are stacked, not listed', () => {
  const wrapper = layout.match(/\.unique-coffee-block \.imgs-slider-unique\s*\{([^}]*)\}/);
  assert.ok(wrapper, 'the slider wrapper needs a layout');
  assert.match(wrapper[1], /display:\s*grid/, 'grid is what stacks them without needing pixel widths');

  const block = layout.match(/\.unique-coffee-block \.imgs-slider-unique > \.slider-block\s*\{([^}]*)\}/);
  assert.ok(block, 'the blocks must be positioned');
  assert.match(block[1], /grid-area:\s*1\s*\/\s*1/, 'every block occupies the same cell');
  assert.match(block[1], /opacity:\s*0/, 'only the selected one shows');

  assert.match(
    layout,
    /\.imgs-slider-unique > \.slider-block\.is-active\s*\{[^}]*opacity:\s*1/,
    'the active block must be the visible one',
  );
});

test('only the selected coffee keeps its copy open', () => {
  // Three open panels is how a 475px section becomes a 9,110px one.
  assert.match(layout, /\.unique-coffee-block \.faqs-text\s*\{[^}]*display:\s*none/);
  assert.match(layout, /\.unique-coffee-block \.faqs-text\.is-active\s*\{[^}]*display:\s*block/);
});

test('the handles are real buttons wired to the panels', () => {
  assert.match(section, /<button[\s\S]{0,200}class="slider-handle/, 'a <p> cannot be focused or pressed');
  assert.match(section, /role="tab"/);
  assert.match(section, /role="tablist"/);
  assert.match(section, /aria-controls="\{\{ section\.id \}\}-panel-\{\{ i \}\}"/, 'each tab must name its panel');
  assert.match(section, /role="tabpanel"/);

  // The element that does the switching has to actually be loaded.
  assert.match(section, /<ona-unique-coffees>/, 'the custom element must wrap the section');
  assert.match(section, /ona-unique-coffees\.js['"]?\s*\|\s*asset_url/, 'and its script must be requested');
  assert.match(script, /customElements\.define\('ona-unique-coffees'/);
});

test('the slider degrades to one visible group without JavaScript', () => {
  /*
   * `is-active` is applied by the script, so with JS off nothing would show at
   * all unless the first block carries it from Liquid. The old theme showed
   * the first group on load.
   */
  /*
   * Each of the three must carry it. A first version of this used an
   * ungrouped alternation, so it matched the HANDLE's class and passed with
   * the block's default removed -- the probe tripped nothing.
   */
  for (const [what, pattern] of [
    ['image group', /class="slider-block\{%\s*if forloop\.first\s*%\}\s*is-active\{%\s*endif\s*%\}"/],
    ['tab', /class="slider-handle\{%\s*if forloop\.first\s*%\}\s*is-active\{%\s*endif\s*%\}"/],
    ['copy', /class="faqs-text\{%\s*if forloop\.first\s*%\}\s*is-active\{%\s*endif\s*%\}"/],
  ]) {
    assert.match(section, pattern, `the first ${what} must be active before the script runs`);
  }
});
