import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('a product card updates its own price even when it renders only one price block', () => {
  const source = read('assets/product-card.js');

  // The defect: stock Horizon reads index [1], which only exists when quick-add
  // has injected a second <product-price> into the card. ONA runs quick-add off,
  // so every card has exactly one and the morph never ran -- measured live on
  // theme 154676789439: the card's link gained ?variant=... while the price did not move.
  assert.doesNotMatch(
    source,
    /const priceContainer = this\.querySelectorAll\(`product-price \[ref='priceContainer'\]`\)\[1\];/,
    'the bare [1] lookup is back -- card prices will stop reacting to variant changes'
  );
  assert.match(
    source,
    /const priceContainers = this\.querySelectorAll\(`product-price \[ref='priceContainer'\]`\);/
  );
  assert.match(
    source,
    /const priceContainer = priceContainers\[1\] \?\? priceContainers\[0\];/,
    'keep [1] first so a quick-add card still behaves like stock Horizon'
  );
});

test('the header search button does not overlap the account and cart buttons', () => {
  const source = read('snippets/search.liquid');

  // Negative margins pulled the 44px search button 14.4px into the account button
  // and 8px into the cart button. Both neighbours won the overlap, leaving the
  // search button 21px of its own target and sending the left edge of the visible
  // magnifier to the account page.
  const rightColumnRule = source.match(
    /\.header__column--right \.search-action \{[\s\S]*?\n {2}\}/
  );
  assert.ok(rightColumnRule, 'the right-column search-action rule is missing');
  assert.doesNotMatch(
    rightColumnRule[0],
    /margin-inline:\s*calc\(var\(--gap-md\) \* -1\)/,
    'the negative pull is back -- the search button loses half its tap target'
  );
  assert.match(rightColumnRule[0], /margin-inline:\s*0;/);
});

test('the coffee quiz never renders an "explore" CTA without a destination', () => {
  const source = read('sections/coffee-quiz.liquid');

  // This anchor lives inside <template ref="resultTemplate">, so it only appears
  // after a shopper finishes the quiz -- which is why scanning the initial
  // homepage DOM does not catch it. coffee-quiz.js fills in [data-subscribe] but
  // never this one, so a blank explore_link could only ever be a dead CTA.
  assert.match(
    source,
    /{%- if settings\.explore_label != blank and settings\.explore_link != blank -%}/,
    'the explore CTA must be gated on its link, not only on its label'
  );
  assert.match(source, /<a class="coffee-quiz__action" href="{{ settings\.explore_link }}">/);

  const js = read('assets/coffee-quiz.js');
  assert.doesNotMatch(js, /explore/i, 'if the script starts filling this href in, drop the Liquid gate');
});
