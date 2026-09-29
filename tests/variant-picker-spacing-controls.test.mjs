import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const themeRoot = resolve(import.meta.dirname, '..');
const blockSource = readFileSync(resolve(themeRoot, 'blocks/variant-picker.liquid'), 'utf8');
const pickerSource = readFileSync(resolve(themeRoot, 'snippets/variant-main-picker.liquid'), 'utf8');
const stylesSource = readFileSync(resolve(themeRoot, 'snippets/variant-picker-styles.liquid'), 'utf8');

const schemaMatch = blockSource.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);
assert.ok(schemaMatch, 'Variant picker schema must exist');
const schema = JSON.parse(schemaMatch[1]);

test('exposes independent Variant picker gap controls', () => {
  const setting = (id) => schema.settings.find((item) => item.id === id);

  assert.equal(setting('option_gap')?.default, 16);
  assert.equal(setting('value_gap')?.default, 11);
  assert.equal(setting('label_gap')?.default, 8);

  assert.match(pickerSource, /--variant-picker-option-gap:[\s\S]*?block_settings\.option_gap/);
  assert.match(pickerSource, /--variant-picker-value-gap:[\s\S]*?block_settings\.value_gap/);
  assert.match(pickerSource, /--variant-picker-label-gap:[\s\S]*?block_settings\.label_gap/);
  assert.match(stylesSource, /gap: var\(--variant-picker-option-gap/);
  assert.match(stylesSource, /column-gap: var\(--variant-picker-value-gap/);
  assert.match(stylesSource, /margin-block-end: var\(--variant-picker-label-gap/);
});
