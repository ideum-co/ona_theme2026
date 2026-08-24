import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const section = readFileSync(new URL('../sections/product-highlight.liquid', import.meta.url), 'utf8');
const schema = JSON.parse(section.match(/\{% schema %\}\s*([\s\S]*?)\s*\{% endschema %\}/)[1]);
const settings = new Map(schema.settings.map((setting) => [setting.id, setting]));
const roles = ['eyebrow', 'title', 'description', 'spec_label', 'spec_value'];
const presetValues = ['rte', 'paragraph', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'custom'];
const customFields = ['font', 'font_size', 'line_height', 'letter_spacing', 'case', 'wrap'];

for (const role of roles) {
  const preset = settings.get(`${role}_type_preset`);
  assert.ok(preset, `${role} needs its own typography preset setting`);
  assert.deepEqual(preset.options.map((option) => option.value), presetValues, `${role} must expose all Horizon presets`);

  for (const field of customFields) {
    const setting = settings.get(`${role}_${field}`);
    assert.ok(setting, `${role} needs a ${field} custom control`);
    assert.equal(setting.visible_if, `{{ section.settings.${role}_type_preset == 'custom' }}`, `${role} ${field} must only appear for Custom`);
  }

  assert.match(section, new RegExp(`product-highlight-typography-style[^%]*prefix: '${role}'`), `${role} must publish independent custom typography variables`);
}

for (const padding of ['padding-block-start', 'padding-block-end', 'padding-inline-start', 'padding-inline-end']) {
  assert.ok(settings.has(padding), `content column needs ${padding}`);
}

assert.match(section, /class="product-highlight__heading[^\n]*\{\{ heading_preset \}\}/, 'section heading must apply its preset class');
assert.match(section, /--product-highlight-heading-push: auto;/, 'space-between must keep the separately rendered heading at the top');
assert.match(section, /--product-highlight-details-margin: 0;/, 'space-between must keep details grouped below the heading');

console.log('product-highlight editor controls regression harness: PASS');
