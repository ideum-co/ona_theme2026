import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('custom variant dropdown names follow the visible selection', () => {
  for (const path of ['snippets/variant-select-dropdown.liquid', 'snippets/variant-main-picker.liquid']) {
    const source = read(path);
    assert.match(source, /<legend id="\{\{ trigger_id \}\}-label" class="variant-select__legend">\{\{ panel_title \}\}<\/legend>/);
    assert.match(source, /aria-labelledby="\{\{ trigger_id \}\}-label \{\{ trigger_id \}\}-value"/);
    assert.match(source, /<span id="\{\{ trigger_id \}\}-value" class="variant-select__trigger-value">/);
    assert.doesNotMatch(source, /class="variant-select__trigger"[^>]*aria-label=/);
  }

  assert.match(read('assets/variant-select.js'), /target\.textContent =/);
});
