import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

/*
 * The slideshow's dot and thumbnail controls are plain <button>s with no role,
 * so `aria-selected` is not an allowed attribute on them -- axe reports
 * `aria-allowed-attr`, and Lighthouse counted 8 on the homepage. `aria-current`
 * is a global attribute, valid on any element, and says the right thing about
 * the active item in a set.
 *
 * The attribute is also the hook the active-state CSS keys off, and the JS
 * setter moves it, so markup, stylesheet and script have to agree. If they
 * drift the dot keeps working but loses its active colour, which is easy to
 * miss in review -- hence this test.
 */
test('slideshow controls mark the active item with aria-current, not aria-selected', () => {
  const controls = read('snippets/slideshow-controls.liquid');
  const script = read('assets/slideshow.js');

  assert.doesNotMatch(controls, /aria-selected/, 'aria-selected is invalid on these roleless buttons');
  assert.doesNotMatch(script, /aria-selected/, 'the setter must write aria-current');

  // Initial render: the first thumbnail and the first dot start active.
  assert.equal(
    (controls.match(/aria-current="true"/g) ?? []).length,
    2,
    'both the thumbnail and the dot variants seed the first control'
  );

  // The CSS active state must follow the same attribute in all three places.
  assert.equal(
    (controls.match(/\[aria-current='true'\]/g) ?? []).length,
    3,
    'all active-state selectors must key off aria-current'
  );

  // The runtime setter keeps every control in sync as the slide changes.
  assert.match(
    script,
    /controls\?\.forEach\(\(el, i\) => el\.setAttribute\('aria-current', `\$\{i === value\}`\)\)/,
    'the current setter must write aria-current across thumbnails and dots'
  );
});
