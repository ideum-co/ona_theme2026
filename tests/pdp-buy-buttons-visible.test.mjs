import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const snippet = readFileSync(resolve(root, 'snippets/product-information-content.liquid'), 'utf8');

/*
 * The PDP is a one-screen layout: .product-information__viewport is
 * `height: 100svh; overflow: hidden`, and the details column scrolls
 * independently so the whole thing fits. The column's scrollbar is
 * deliberately hidden, so nothing says there is more below it.
 *
 * Measured on the live theme, /products/raspberry-candy: the column's content
 * is 985px and Add to cart sits at 682px inside it. A 1440x900 browser gives
 * the column roughly 590-620px, so the button fell 60-90px below the fold of a
 * region with no scrollbar that the page's own scroll does not move. At 560px
 * of column, 122px of it was cut off.
 */

const stickyRule = () => {
  const m = snippet.match(
    /\.product-information__grid:not\(\.product-information--media-none\)\s*>\s*\.product-details\s*\.buy-buttons-block \{([\s\S]*?)\n      \}/,
  );
  assert.ok(m, 'the buy buttons must be pinned inside the scrolling column');
  return m[1];
};

test('add to cart stays visible however short the column is', () => {
  const decls = stickyRule();
  assert.match(decls, /position:\s*sticky/, 'it has to be pinned, not merely placed last');
  assert.match(decls, /inset-block-end:\s*0/, 'to the bottom of the scroller');
});

test('the pinned bar matches the product colour behind it', () => {
  /*
   * The PDP sets a per-product background (#e3649d on Raspberry Candy). A
   * pinned bar with a default background would punch a light box into a
   * coloured column, and one with no background would let the content it
   * covers show through.
   */
  const decls = stickyRule();
  assert.match(decls, /background:\s*var\(--color-background/, 'take the column background');
  assert.doesNotMatch(decls, /background:\s*(#|rgb|white)/i, 'never a literal colour');
});

test('the pin is desktop only', () => {
  /*
   * Below 750px the column does not scroll -- the page does -- so a
   * bottom-pinned bar would cover content instead of revealing it.
   */
  const before = snippet.slice(0, snippet.indexOf('.buy-buttons-block {'));
  const lastMedia = before.lastIndexOf('@media');
  assert.ok(lastMedia > -1, 'the rule must sit inside a media query');
  assert.match(
    before.slice(lastMedia, lastMedia + 60),
    /min-width:\s*750px/,
    'Horizon\'s desktop breakpoint, not an invented one',
  );
});

test('the independent scroll it depends on is still there', () => {
  // Removing it would let .product-information__viewport clip instead.
  assert.match(
    snippet,
    /\.product-information__grid:not\(\.product-information--media-none\) > \.product-details \{[\s\S]*?overflow-y: auto;/,
    'the column must still scroll, or the viewport clips the content outright',
  );
});
