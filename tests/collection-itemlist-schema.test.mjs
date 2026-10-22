import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const source = read('sections/main-collection.liquid');

/*
 * Code only. Same discipline as tests/product-faqs.test.mjs and the lesson from #269: a guard run
 * over prose can match the sentence describing the thing instead of the thing itself. The comment
 * above the capture in main-collection.liquid names "numberOfItems" and "collection.products_count"
 * together while arguing against using the latter -- exactly the kind of text a careless match would
 * be fooled by -- so comments are stripped before any assertion runs.
 */
const code = source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');

const paginateStart = code.indexOf('{% paginate collection.products by products_per_page %}');
assert.ok(paginateStart > -1, 'the paginate block must still exist');
const paginateBlock = code.slice(paginateStart, code.indexOf('{% endpaginate %}', paginateStart));

test('ItemList is captured from the same collection.products loop the page actually renders', () => {
  const captureStart = paginateBlock.indexOf('{%- capture item_list_entries -%}');
  assert.ok(captureStart > -1, 'the item_list_entries capture must exist');
  const captureBlock = paginateBlock.slice(captureStart, paginateBlock.indexOf('{%- endcapture -%}', captureStart));
  assert.match(captureBlock, /for product in collection\.products/, 'must iterate the same collection.products the product grid renders, not a separately-fetched list');
});

test('numberOfItems is derived from the same source as itemListElement, never from products_count', () => {
  const scriptStart = paginateBlock.indexOf('"@type": "ItemList"');
  assert.ok(scriptStart > -1, 'the ItemList ld+json object must exist');
  const scriptBlock = paginateBlock.slice(Math.max(0, scriptStart - 200), scriptStart + 400);
  assert.match(scriptBlock, /"numberOfItems":\s*\{\{\s*collection\.products\.size\s*\}\}/, 'numberOfItems must read collection.products.size (what is actually listed)');
  assert.doesNotMatch(scriptBlock, /numberOfItems.*products_count/s, 'numberOfItems must not come from products_count -- that can exceed what this page actually lists under pagination, and a claimed total that disagrees with the listed items is the exact defect this is designed to avoid');
});

test('the script only renders when there is at least one item, guarded on the captured output', () => {
  const guardIndex = paginateBlock.indexOf('{%- if item_list_entries != blank -%}');
  assert.ok(guardIndex > -1, 'must be guarded on the captured markup, not a counter -- same pattern as product-faqs.liquid, so the guard cannot drift from what is actually rendered');
  const afterGuard = paginateBlock.slice(guardIndex);
  assert.match(afterGuard, /application\/ld\+json/, 'the ld+json script must be inside the blank-guard');
});

test('position is 1-based and scoped to this page, via forloop.index', () => {
  assert.match(paginateBlock, /"position":\s*\{\{\s*forloop\.index\s*\}\}/, 'position must use forloop.index (1-based) from the current page\'s loop, not a running total across pages');
});

test('url and name are escaped against JSON metacharacters and premature </script> termination', () => {
  const captureStart = paginateBlock.indexOf('{%- capture item_list_entries -%}');
  const captureBlock = paginateBlock.slice(captureStart, paginateBlock.indexOf('{%- endcapture -%}', captureStart));
  assert.match(captureBlock, /item_url = request\.origin \| append: product\.url \| json \| replace: '<\/', '<\\\/'/, 'product url must be escaped the same way as blocks/product-faqs.liquid');
  assert.match(captureBlock, /item_name = product\.title \| json \| replace: '<\/', '<\\\/'/, 'product title must be escaped the same way as blocks/product-faqs.liquid');
});

test('image is included only when the product actually has a featured image', () => {
  const captureStart = paginateBlock.indexOf('{%- capture item_list_entries -%}');
  const captureBlock = paginateBlock.slice(captureStart, paginateBlock.indexOf('{%- endcapture -%}', captureStart));
  assert.match(captureBlock, /if product\.featured_image != blank/, 'image must be conditional, not asserted blindly for every product');
});
