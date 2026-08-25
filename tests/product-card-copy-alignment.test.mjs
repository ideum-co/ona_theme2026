import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const metafieldBlock = readFileSync(new URL('../blocks/product-metafield-text.liquid', import.meta.url), 'utf8');
const productTitleBlock = readFileSync(new URL('../blocks/product-title.liquid', import.meta.url), 'utf8');
const productCardStyles = readFileSync(new URL('../snippets/product-card-styles.liquid', import.meta.url), 'utf8');

assert.match(
  metafieldBlock,
  /product-metafield-text--empty/,
  'empty product metafields need an explicit state that card CSS can reserve',
);
assert.doesNotMatch(
  metafieldBlock,
  /if value == blank[\s\S]*?display:\s*none;[\s\S]*?else[\s\S]*?display:\s*block;/,
  'the block must not hide empty metafields inline because cards need their space',
);
assert.match(
  productCardStyles,
  /\.product-card \.product-metafield-text--empty\s*\{[\s\S]*?visibility:\s*hidden;[\s\S]*?min-height:\s*1lh;/,
  'each empty metafield row must remain invisible while reserving one text line in product cards',
);
assert.match(
  productTitleBlock,
  /class="contents user-select-text product-title-link"/,
  'product titles need a stable hook that only targets their card text',
);
assert.match(
  productCardStyles,
  /\.product-card \.product-title-link \.text-block[\s\S]*?min-width:\s*0;[\s\S]*?\.product-card \.product-title-link \.text-block > \*[\s\S]*?white-space:\s*nowrap;[\s\S]*?overflow:\s*hidden;[\s\S]*?text-overflow:\s*ellipsis;/,
  'product-card titles must stay on one line and end with an ellipsis when needed',
);

console.log('product-card copy alignment regression harness: PASS');
