import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const themeRoot = resolve(import.meta.dirname, '..');
const headerSource = readFileSync(resolve(themeRoot, 'sections/header.liquid'), 'utf8');
const headerGroupSource = readFileSync(resolve(themeRoot, 'sections/header-group.json'), 'utf8').replace(
  /^\s*\/\*[\s\S]*?\*\/\s*/,
  '',
);
const headerGroup = JSON.parse(headerGroupSource);
const headerSettings = headerGroup.sections.header_section.settings;

test('uses the homepage transparent treatment on PDP without changing internal page defaults', () => {
  assert.match(headerSource, /when 'product'\s+assign template_group = 'product'/);
  assert.match(headerSource, /assign transparent_key = 'enable_transparent_header_' \| append: template_group/);

  assert.equal(headerSettings.enable_transparent_header_home, true);
  assert.equal(headerSettings.home_inverse_logo, true);
  assert.equal(headerSettings.text_color_transparent_home, '#ffffff');

  assert.equal(headerSettings.enable_transparent_header_product, true);
  assert.equal(headerSettings.product_inverse_logo, true);
  assert.equal(headerSettings.text_color_transparent_product, '#ffffff');

  assert.equal(headerSettings.enable_transparent_header_collection, false);
  assert.equal(headerSettings.collection_inverse_logo, false);
  assert.equal(headerSettings.transparent_when_sticky ?? false, false);
});
