import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../snippets/product-card-styles.liquid', import.meta.url), 'utf8');
test('Featured collection uses explicit rows, not individual card heights', () => {
  assert.match(css, /\.ui-test-product-list\s+\.resource-list__carousel\s+\.product-card__content\s*\{/);
  assert.match(css, /grid-template-rows:\s*minmax\(/);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});
test('The carousel card gallery, title and action positions remain consistent', () => {
  assert.match(css, /\.ui-test-product-list[^{]*\.card-gallery\s*\{[^}]*grid-row:\s*1/s);
  assert.match(css, /\.ui-test-product-list[^{]*\.group-block:has\(\.buy-buttons-block\)\s*\{[^}]*grid-row:\s*8/s);
  assert.match(css, /\.ui-test-product-list[^{]*\.product-card__variant-placeholder\s*\{[^}]*grid-row:\s*7/s);
});
test('No automatic height override in homepage carousel', () => {
  assert.doesNotMatch(css, /\.resource-list__carousel \.resource-list__item \.product-card,\s*\.resource-list__carousel \.resource-list__item \.product-card__content\s*\{\s*height:\s*auto/s);
});
