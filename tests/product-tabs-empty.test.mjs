import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const block = read('blocks/product-tab.liquid');
const section = read('sections/product-tabs.liquid');

/*
 * A Brew Guide tab enabled once for the catalogue is empty on every coffee with
 * no brew data. Rather than a per-product flag -- which goes stale the first
 * time a metafield is filled in and nobody remembers the switch -- the tab
 * disappears when its blocks render nothing. That works for Profile, Origin and
 * Sourcing too, not just Brew Guide.
 */

test('emptiness is judged from rendered content, not from Liquid', () => {
  /*
   * A Liquid `capture` of the children is never blank: child blocks always emit
   * a wrapper. blocks/custom-liquid.liquid outputs a <div> unconditionally, and
   * blocks/product-metafield-text.liquid outputs a hidden, aria-hidden <div>
   * for a blank value. The first pass tested `children | strip == blank` in the
   * block and so would never have removed anything at all. Codex, #236.
   */
  assert.doesNotMatch(block, /data-tab-empty/, 'the block cannot make this call');
  assert.match(section, /const isEmpty = \(panel\) =>/, 'the strip judges the rendered panel');
  assert.match(section, /panel\.textContent\.trim\(\) === ''/, 'no text');
  assert.match(section, /const EMBEDS = '[^']*'/, 'embeds are listed in one place');
  assert.match(section, /!panel\.querySelector\(EMBEDS\)/, 'and no embed -- a media-only tab is not empty');

  /*
   * The whitelist cannot be exhaustive, so the two outcomes are weighted:
   * keeping a tab that turned out to be empty costs an empty tab; removing one
   * that was not costs the customer content they can no longer reach. Codex
   * raised <audio> specifically.
   */
  const embeds = section.match(/const EMBEDS = '([^']*)'/)[1];
  for (const tag of ['img', 'video', 'audio', 'iframe', 'svg', 'object', 'embed']) {
    assert.ok(embeds.includes(tag), `${tag} renders something, so it must keep its tab`);
  }

  /*
   * textContent, not innerText: this runs during parse, before layout, and
   * innerText would force one. Both wrappers above hold no text when they have
   * nothing to show, so textContent is enough to tell them apart.
   */
  assert.doesNotMatch(section, /panel\.innerText/, 'innerText would force layout during parse');
});

test('the strip removes the button and the panel together', () => {
  /*
   * The component pairs button i with panel i and bails when the counts differ
   * -- leaving every panel stacked and visible, which is worse than an empty
   * tab. Removing one half of a pair is exactly that condition.
   */
  assert.match(section, /panelList\[index\]\.remove\(\);/, 'the empty panel goes');
  assert.match(section, /tabList\[index\]\?\.remove\(\);/, 'and so does its button');
  assert.match(
    section,
    /for \(const index of empties\.reverse\(\)\)/,
    'remove from the end so the earlier indices stay valid',
  );
});

test('the surviving buttons are renumbered', () => {
  /*
   * Each button carries its index in `on:click="/select/N"`, baked in at
   * render. After a removal the survivors keep their original N, so the new
   * first button would open the second panel. Codex, #236.
   */
  assert.match(
    section,
    /forEach\(\(tab, index\) => tab\.setAttribute\('on:click', `\/select\/\$\{index\}`\)\)/,
    'renumber after pruning, or every click is off by the number removed',
  );
});

test('the prune runs before the component connects', () => {
  /*
   * The module is deferred; this inline script is not. Pruning here means the
   * component builds its refs from the already-pruned DOM and never sees a
   * mismatch. Doing it inside the component would mean mutating refs it has
   * already read -- and renumbering handlers it has already bound.
   */
  const inline = section.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(inline, 'the inline script must still exist');
  assert.match(inline[1], /const isEmpty/, 'and it is where the prune lives');
  assert.doesNotMatch(read('assets/product-tabs.js'), /isEmpty|data-tab-empty/, 'not in the deferred module');
});

test('the last tab is never removed', () => {
  /*
   * A strip of one is still a heading for the content beneath it. Removing the
   * only remaining tab would leave an unlabelled panel with nothing naming it.
   */
  assert.match(
    section,
    /if \(!empties\.length \|\| empties\.length >= panelList\.length\) return;/,
    'an all-empty strip must be left alone',
  );
});

test('pruning survives a combined-listing product swap', () => {
  /*
   * Combined listings swap products without a page load: variant-picker.js
   * calls updateMain(), which morphs a new <main> into the document rather than
   * re-running this inline script. The replacement markup arrives unpruned, so
   * a product with no brew data would show the Brew Guide tab again. Codex,
   * #236.
   */
  assert.match(section, /const prune = \(\) => \{/, 'the prune must be callable more than once');
  assert.match(section, /new MutationObserver\(\(\) => prune\(\)\)/, 'and re-run when the panels change');
  assert.match(section, /\.observe\(panelHost, \{ childList: true \}\)/, 'watching the panel container');

  /*
   * It re-reads the DOM each time rather than closing over the original
   * NodeLists, which would be stale after a morph.
   */
  const body = section.match(/const prune = \(\) => \{([\s\S]*?)\n    \};/);
  assert.ok(body, 'prune must have a body');
  assert.match(body[1], /section\.querySelectorAll\('\.product-tabs__panels/, 're-read the panels');
});
