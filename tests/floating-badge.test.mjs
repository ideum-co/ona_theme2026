import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'sections/floating-badge.liquid'), 'utf8');
const schemaMatch = source.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);

test('provides an editable fixed rotating badge for the homepage', () => {
  assert.ok(schemaMatch);
  const schema = JSON.parse(schemaMatch[1]);
  const setting = (id) => schema.settings.find((item) => item.id === id);

  assert.deepEqual(schema.enabled_on.templates, ['index']);
  for (const id of ['image', 'link', 'position', 'size', 'size_mobile', 'offset_vertical', 'offset_horizontal', 'animate', 'duration', 'direction']) {
    assert.ok(setting(id), `missing setting ${id}`);
  }
  assert.match(source, /position: fixed;/);
  assert.match(source, /animation: floating-badge-spin[\s\S]*?infinite/);
  assert.match(source, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(source, /@keyframes floating-badge-spin/);
});
