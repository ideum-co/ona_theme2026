import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const source = read('blocks/product-specifications.liquid');

/*
 * Comments first, for the same reason tests/product-brew-guide.test.mjs strips them: the doc header
 * explains why the CSS is not inline, and an assertion that scanned the prose would pass or fail on
 * the explanation rather than the code.
 */
const block = source
  .replace(/\{%-?\s*doc\s*-?%\}[\s\S]*?\{%-?\s*enddoc\s*-?%\}/g, '')
  .replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
  .replace(/^\s*#.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/*
 * Specifications is a product tab like the brew guide: it must render nothing when the product has
 * no spec content, so #236's pruning (an empty panel removes its tab) hides it on products that are
 * not equipment. This mirrors the brew guide's two load-bearing guarantees.
 */

test('nothing renders unless the product actually has spec content', () => {
  assert.match(block, /\{%-?\s*if intro != blank or spec_count > 0\s*-?%\}/, 'the markup must be guarded');

  const guarded = block.slice(block.indexOf('{%- if intro != blank'));
  assert.match(guarded, /class="product-specs"/, 'the wrapper belongs inside the guard');

  const beforeGuard = block.slice(0, block.indexOf('{%- if intro != blank'));
  assert.doesNotMatch(beforeGuard, /<(div|dl|p|a)\b/, 'nothing may be emitted before the guard');
});

test('the CSS is a theme stylesheet, never an inline <style>', () => {
  /*
   * Correctness, not style: #236 judges an empty panel with `panel.textContent.trim() === ''`, and
   * a <style> element's text counts. An inline sheet would keep every empty panel alive and bring
   * the Specifications tab back on every product without specs.
   */
  assert.match(block, /\{%\s*stylesheet\s*%\}/, 'the rules belong in a theme stylesheet');
  assert.doesNotMatch(block, /<style\b/i, 'an inline <style> would defeat the empty-tab pruning');
  assert.match(block, /\.product-specs \{/, 'and the stylesheet must actually carry the rules');
});

test('the metafield keys are settings, so one block serves any paired list', () => {
  for (const id of ['namespace', 'intro_key', 'labels_key', 'values_key']) {
    assert.match(block, new RegExp(`"id":\\s*"${id}"`), `${id} must be a setting`);
    assert.match(block, new RegExp(`block\\.settings\\.${id}`), `${id} must drive the lookup, not a hardcoded key`);
  }
  // Paired lists are read as arrays (.value); pairing stops at the shorter list.
  assert.match(block, /labels_key\]\.value/, 'labels read the array');
  assert.match(block, /values_key\]\.value/, 'values read the array');
  assert.match(block, /if values\.size < spec_count/, 'pairing must not index past the shorter list');
});
