import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const themeRoot = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(themeRoot, 'sections/product-recommendations.liquid'), 'utf8');
const schemaMatch = source.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);

assert.ok(schemaMatch, 'Product recommendations schema must exist');
const schema = JSON.parse(schemaMatch[1]);
const setting = schema.settings.find((item) => item.id === 'heading_alignment');

test('allows the Recommended products heading to be aligned from the section', () => {
  assert.deepEqual(
    setting?.options.map(({ value }) => value),
    ['flex-start', 'center', 'flex-end'],
  );
  assert.equal(setting?.default, 'center');
  assert.match(
    source,
    /class="section-resource-list__content"\s+style="--horizontal-alignment: \{\{ section\.settings\.heading_alignment \}\};"/,
  );
});

