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

const reviewRegressions = [];
const check = (name, assertion) => {
  try {
    assertion();
  } catch (error) {
    reviewRegressions.push(`${name}: ${error.message}`);
  }
};

check('responsive inline padding', () => {
  assert.equal(settings.get('padding-inline-start')?.default, 40, 'desktop left padding must remain 40px');
  assert.equal(settings.get('padding-inline-end')?.default, 40, 'desktop right padding must remain 40px');
  assert.equal(settings.get('mobile_padding_inline_start')?.default, 16, 'mobile left padding must default to 16px');
  assert.equal(settings.get('mobile_padding_inline_end')?.default, 16, 'mobile right padding must default to 16px');
  assert.match(section, /--product-highlight-content-padding-inline-start-mobile: \{\{ settings\.mobile_padding_inline_start \| default: 16 \}\}px;/, 'saved sections without the new mobile setting must keep a 16px left padding');
  assert.match(section, /--product-highlight-content-padding-inline-start: \{\{ settings\['padding-inline-start'\] \| default: 40 \}\}px;/, 'saved sections must keep a 40px desktop left padding');
  assert.match(section, /@media screen and \(min-width: 750px\)[\s\S]*padding-inline: var\(--product-highlight-content-padding-inline-start\) var\(--product-highlight-content-padding-inline-end\);/, 'desktop inline padding must apply at 750px');
});

check('spec value alignment', () => {
  assert.match(section, /\.product-highlight__spec-value \{\s*margin: 0;\s*text-align: end;/, 'spec values must remain end-aligned for every preset');
});

check('blank-heading space-between', () => {
  assert.match(section, /assign has_heading = false\s*if settings\.heading != blank\s*assign has_heading = true\s*endif/, 'the layout needs an explicit, valid Liquid heading-presence state');
  assert.match(section, /product-highlight__content--space-between/, 'space-between needs an explicit content state class');
  assert.match(section, /product-highlight__content--without-heading/, 'blank headings need a distinct content state class');
  assert.match(section, /content--space-between\.product-highlight__content--without-heading \.product-highlight__details \{\s*margin-block-start: auto;/, 'blank-heading space-between must push details to the bottom');
});

check('description preset cascade', () => {
  assert.match(section, /class="product-highlight__description text-block \{\{ description_preset \}\}/, 'description must use Horizon text-block preset cascade for richtext children');
});

assert.deepEqual(reviewRegressions, [], `review regression checks failed:\n${reviewRegressions.join('\n')}`);

console.log('product-highlight editor controls regression harness: PASS');
