import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'sections/club-benefits.liquid'), 'utf8');
const schemaMatch = source.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);

test('allows the Club benefits button to move without editing a template JSON', () => {
  assert.ok(schemaMatch);
  const schema = JSON.parse(schemaMatch[1]);
  const position = schema.settings.find((setting) => setting.id === 'button_position');

  assert.deepEqual(position.options.map(({ value }) => value), ['after_heading', 'between_content', 'after_testimonials']);
  assert.equal(position.default, 'after_testimonials');
  assert.match(source, /capture button_markup/);
  assert.match(source, /settings\.button_position == 'between_content'/);
});

test('limits Club benefits content independently from its full-width background', () => {
  const schema = JSON.parse(schemaMatch[1]);
  const setting = (id) => schema.settings.find((item) => item.id === id);

  assert.deepEqual(setting('section_width').options.map(({ value }) => value), ['page-width', 'full-width']);
  assert.equal(setting('limit_content_width').type, 'checkbox');
  assert.equal(setting('max_width').visible_if, '{{ section.settings.limit_content_width }}');
  assert.match(source, /class="club-benefits__inner"/);
  assert.match(source, /--club-benefits-max-width:/);
  assert.match(source, /\.club-benefits--limited \.club-benefits__inner/);
});
