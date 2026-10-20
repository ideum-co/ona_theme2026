import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const block = read('blocks/product-tab.liquid');
const section = read('sections/product-tabs.liquid');

/*
 * A Brew Guide tab enabled once for the whole catalogue is empty on every
 * coffee with no brew data. Rather than a per-product flag -- which goes stale
 * the first time a metafield is filled in and nobody remembers the switch --
 * the tab disappears when its blocks render nothing. That works for Profile,
 * Origin and Sourcing too, not just Brew Guide.
 */

test('a panel that renders nothing says so', () => {
  assert.match(block, /\{%-? ?capture children ?-?%\}/, 'the block must capture what it renders');
  assert.match(
    block,
    /\{%-? ?if children \| strip == blank ?-?%\}data-tab-empty="true"/,
    'and mark itself when that is nothing',
  );
});

test('the strip removes the button and the panel together', () => {
  /*
   * The component pairs button i with panel i and bails when the counts differ
   * -- leaving every panel stacked and visible, which is worse than an empty
   * tab. Removing one half of a pair is exactly that condition.
   */
  assert.match(section, /panels\[index\]\.remove\(\);/, 'the empty panel goes');
  assert.match(section, /tabs\[index\]\?\.remove\(\);/, 'and so does its button');

  /*
   * Asserted directly rather than by slicing the block out. A non-greedy
   * [\s\S]*? up to the next closing brace stops at the reduce() above, not at
   * the prune -- which is how the first draft of this test failed against
   * correct code.
   */
  assert.match(
    section,
    /for \(const index of empties\.reverse\(\)\)/,
    'remove from the end so the earlier indices stay valid',
  );
});

test('the prune runs before the component connects', () => {
  /*
   * The module is deferred; this inline script is not. Pruning here means the
   * component builds its refs from the already-pruned DOM and never sees a
   * mismatch. Doing it inside the component would mean mutating refs it has
   * already read.
   */
  const inline = section.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(inline, 'the inline script must still exist');
  assert.match(inline[1], /data-tab-empty/, 'and it is where the prune lives');
  assert.doesNotMatch(read('assets/product-tabs.js'), /data-tab-empty/, 'not in the deferred module');
});

test('the last tab is never removed', () => {
  /*
   * A strip of one is still a heading for the content beneath it. Removing the
   * only remaining tab would leave an unlabelled panel with nothing naming it.
   */
  assert.match(
    section,
    /empties\.length && empties\.length < panels\.length/,
    'an all-empty strip must be left alone',
  );
});
