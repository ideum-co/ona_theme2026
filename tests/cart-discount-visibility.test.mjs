import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const products = () => read('snippets/cart-products.liquid');
const summary = () => read('snippets/cart-summary.liquid');

/*
 * ONAIN-58. Two separate holes left a BFCM discount barely visible in the cart,
 * and both came from upstream Horizon rather than from anything ONA removed:
 *
 *   1. cart-products.liquid nests the line-level discount list inside a gate that
 *      only opens for a product with multiple variants, line-item properties or a
 *      selling plan. 36 of the 91 active products satisfy none of those, so the
 *      discount's NAME never rendered on them -- every instant coffee, every gift
 *      card, all the matcha, most brew gear. PR #368 fixed it on 25 October and a
 *      Shopify editor write-back (3c35d42, 70 seconds after that merge) silently
 *      restored the stale live copy and undid it. Hence a test: the write-back
 *      path reaches main without review, so prose in the file is not a guard.
 *
 *   2. cart-summary.liquid lists only cart_level_discount_applications, and an
 *      automatic product or collection discount does not allocate there -- it
 *      allocates per line. So the totals block showed no subtotal and no discount
 *      row at all, just a total lower than the lines added up to.
 *
 * Both are fixed with Horizon's own cart-discounts component, in Horizon's own
 * locations, so a line-level discount is indistinguishable from a cart-level one.
 */

/* Matches the Liquid block tags that open and close a nesting level. Tags written
   inside a `{%- liquid -%}` block carry no `{%`, so this scanner cannot see them --
   which is correct, because such a block is self-contained and nets to zero. */
const BLOCK_TAG = /\{%-?\s*(if|unless|case|for|tablerow|endif|endunless|endcase|endfor|endtablerow)\b/g;

/* Returns the index just past the `{% endif %}` that closes the block opening at
   `openIndex`, by walking the tag stream and counting depth. */
const endOfBlockAt = (src, openIndex) => {
  const scanner = new RegExp(BLOCK_TAG.source, 'g');
  scanner.lastIndex = openIndex;
  let depth = 0;
  let match;
  while ((match = scanner.exec(src)) !== null) {
    depth += match[1].startsWith('end') ? -1 : 1;
    if (depth === 0) return match.index + match[0].length;
  }
  assert.fail('unbalanced Liquid block tags: the opening at index ' + openIndex + ' is never closed');
};

const gateOpening = (src) => {
  const index = src.indexOf('{%- if item.product.has_only_default_variant == false\n');
  assert.notEqual(
    index,
    -1,
    'the variant/properties/selling-plan gate was not found; this probe no longer reads the file it was written for'
  );
  return index;
};

test('the line-level discount list sits outside the variant/properties/selling-plan gate', () => {
  const src = products();
  const gateStart = gateOpening(src);
  const gateEnd = endOfBlockAt(src, gateStart);

  const discountList = src.indexOf('{%- if item.line_level_discount_allocations.size > 0 -%}');
  assert.notEqual(discountList, -1, 'the line-level discount list was not found at all');

  /* Proves the probe bites: inside the gate the list would start before the gate's
     endif, which is exactly the state Horizon ships and the write-back restored. */
  assert.ok(gateEnd > gateStart, 'the gate span is empty; the scanner is broken');
  assert.ok(
    discountList > gateEnd,
    'the line-level discount list is nested back inside the gate, so single-variant products show no discount name (see 3c35d42)'
  );
});

test('the line-level discount list is Horizon’s cart-discounts component, not bespoke markup', () => {
  const src = products();
  const start = src.indexOf('{%- if item.line_level_discount_allocations.size > 0 -%}');
  const block = src.slice(start, endOfBlockAt(src, start));

  for (const token of [
    'class="cart-discounts"',
    'class="cart-discounts__item"',
    'class="cart-discounts__label"',
    'cart-discounts__value cart-secondary-typography',
    "'icon-discount.svg' | inline_asset_content",
  ]) {
    assert.ok(block.includes(token), `the line-level discount list no longer uses ${token}`);
  }

  assert.ok(
    !/class="list-unstyled"/.test(block),
    'the bespoke list-unstyled markup is back; a line discount must look like a cart discount'
  );
  assert.ok(block.includes('-{{ discount.amount | money -}}'), 'the discount amount is no longer rendered');
});

test('the totals block renders whenever anything in the cart is discounted', () => {
  const src = summary();
  assert.ok(
    src.includes('{%- if cart.total_discount > 0 -%}'),
    'the totals block is gated on something other than cart.total_discount, so a per-line discount can leave it silent again'
  );
  assert.ok(
    !src.includes('{%- if cart.cart_level_discount_applications.size > 0 -%}'),
    'the totals block is gated on cart-level discounts only, which an automatic product discount never populates'
  );
});

test('the subtotal row is the pre-discount total, so the arithmetic adds up', () => {
  const src = summary();
  const row = src.slice(src.indexOf('data-testid="cart-subtotal-value"'));

  assert.ok(
    row.includes('{{- cart.original_total_price | money -}}'),
    'the subtotal is not cart.original_total_price; with a line-level discount it would read $80.00 - $20.00 = $80.00'
  );
  /* Matched as an output tag, not as bare text: the comment above the block names
     items_subtotal_price to explain why it is the wrong figure here. */
  assert.ok(
    !/\{\{-?\s*cart\.items_subtotal_price/.test(src),
    'cart.items_subtotal_price is rendered again: it is already net of line-level discounts and double-counts them'
  );
});

test('line-level discounts are summed per title into the same cart-discounts list', () => {
  const src = summary();

  assert.ok(
    src.includes("assign line_discount_titles = line_discount_titles | split: '|~|' | uniq"),
    'the per-title collection changed shape; line-level discounts may no longer be listed'
  );
  assert.ok(
    src.includes('assign line_discount_amount = line_discount_amount | plus: allocation.amount'),
    'line-level allocations are no longer summed per discount title'
  );
  assert.ok(
    src.includes('{%- for title in line_discount_titles -%}'),
    'the line-level discounts are no longer rendered into the totals list'
  );

  /* `contains` on the accumulated string looks equivalent and is not: once
     "Member 10% Extra" is in the string, "Member 10%" tests as already present
     and gets dropped from the cart silently. */
  assert.ok(
    !/line_discount_titles contains/.test(src),
    'titles are deduped with `contains`, which drops any discount whose name is a substring of another'
  );
});

test('both discount lists render through the same component', () => {
  const src = summary();
  const occurrences = (needle) => src.split(needle).length - 1;

  assert.equal(
    occurrences('<li class="cart-discounts__item">'),
    2,
    'expected exactly two cart-discounts items -- one for cart-level discounts, one for line-level'
  );
  assert.equal(
    occurrences("{{- 'icon-discount.svg' | inline_asset_content -}}"),
    2,
    'both discount rows must carry Shopify’s own discount icon'
  );
});
