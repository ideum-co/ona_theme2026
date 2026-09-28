import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const themeRoot = resolve(import.meta.dirname, '..');
const sectionPath = resolve(themeRoot, 'sections/inline-cta.liquid');

test('ships an editable inline CTA section for product templates', () => {
  assert.equal(existsSync(sectionPath), true, 'sections/inline-cta.liquid must exist');

  const source = readFileSync(sectionPath, 'utf8');
  const schemaMatch = source.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);
  assert.ok(schemaMatch, 'Inline CTA schema must exist');

  const schema = JSON.parse(schemaMatch[1]);
  const setting = (id) => schema.settings.find((item) => item.id === id);

  assert.deepEqual(schema.enabled_on?.templates, ['product']);

  for (const id of ['text', 'button_label', 'button_link']) {
    assert.ok(setting(id), `missing content setting: ${id}`);
  }

  for (const id of [
    'background_color',
    'text_color',
    'button_background_color',
    'button_text_color',
    'button_border_color',
  ]) {
    assert.equal(setting(id)?.type, 'color', `missing color setting: ${id}`);
  }

  for (const id of [
    'text_size',
    'text_size_mobile',
    'button_text_size',
    'button_text_size_mobile',
    'content_gap',
    'content_gap_mobile',
    'padding_top',
    'padding_bottom',
    'padding_inline',
    'padding_inline_mobile',
    'button_padding_block',
    'button_padding_inline',
  ]) {
    assert.equal(setting(id)?.type, 'range', `missing range setting: ${id}`);
    const steps = (setting(id).max - setting(id).min) / setting(id).step;
    assert.ok(steps <= 100, `${id} exceeds Shopify's 101-value range limit`);
    assert.ok((setting(id).unit ?? '').length <= 3, `${id} has a unit longer than three characters`);
  }

  assert.match(source, /class="inline-cta__inner"/);
  assert.match(source, /class="inline-cta__text"/);
  assert.match(source, /class="inline-cta__button"/);
  assert.match(source, /--inline-cta-gap:/);
  assert.match(source, /--inline-cta-gap-mobile:/);
  assert.match(source, /@media screen and \(max-width: 749px\)/);
  assert.match(source, /flex-direction: column;/);
});

