import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const blockSource = readFileSync(resolve(root, 'blocks/pdp-product-summary.liquid'), 'utf8');
const schemaMatch = blockSource.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);

test('organizes PDP summary content before variants with manual and metafield fallbacks', () => {
  assert.ok(schemaMatch);
  const schema = JSON.parse(schemaMatch[1]);
  const setting = (id) => schema.settings.find((item) => item.id === id);

  for (const id of ['badge_1', 'badge_2', 'description', 'rating_value', 'rating_count', 'namespace', 'description_key']) {
    assert.ok(setting(id), `missing setting ${id}`);
  }

  assert.match(blockSource, /<product-price[\s\S]*?data-product-id=/);
  assert.match(blockSource, /metafields\[namespace\]/);
  assert.match(blockSource, /product-summary__commerce/);

});
