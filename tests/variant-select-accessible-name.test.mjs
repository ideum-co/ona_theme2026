import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('custom variant dropdown triggers include their option context in the accessible name', () => {
  const cardDropdown = read('snippets/variant-select-dropdown.liquid');
  const mainPicker = read('snippets/variant-main-picker.liquid');

  assert.match(
    cardDropdown,
    /class="variant-select__trigger"[\s\S]*?aria-label="\{\{ panel_title \}\}: \{\{ selected_variant\.title \| escape \}\}"/,
    'product-card dropdowns must announce both the option and selected variant',
  );
  assert.match(
    mainPicker,
    /class="variant-select__trigger"[\s\S]*?aria-label="\{\{ panel_title \}\}: \{\{ product_option\.selected_value \| escape \}\}"/,
    'main-picker dropdowns must announce both the option and selected value',
  );
});
