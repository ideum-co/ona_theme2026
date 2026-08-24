import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const productHighlight = readFileSync(new URL('../sections/product-highlight.liquid', import.meta.url), 'utf8');
const productCardStyles = readFileSync(new URL('../snippets/product-card-styles.liquid', import.meta.url), 'utf8');

const regressions = [];
for (const [name, assertion] of [
  ['Product highlight native preset color', () => assert.match(
    productHighlight,
    /--product-highlight-color: \{\{ settings\.text_color \}\};\s*--color: \{\{ settings\.text_color \}\};/,
    'must scope --color to its configured text color',
  )],
  ['Product-card action adjacency', () => assert.doesNotMatch(
    productCardStyles,
    /\.product-card__content > \.group-block:has\(\.buy-buttons-block, \.subscribe-block\)\s*\{\s*margin-top: auto;/,
    'must not force the action group to the card bottom',
  )],
]) {
  try {
    assertion();
  } catch (error) {
    regressions.push(`${name}: ${error.message}`);
  }
}

assert.deepEqual(regressions, [], `color/action regressions failed:\n${regressions.join('\n')}`);

console.log('product-highlight color and product-card action regression harness: PASS');
