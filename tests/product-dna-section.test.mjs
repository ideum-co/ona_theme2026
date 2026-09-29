import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const themeRoot = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(themeRoot, 'sections/product-dna.liquid'), 'utf8');
const schemaMatch = source.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);

test('ships an editable product DNA section backed by a product metaobject', () => {
  assert.ok(schemaMatch, 'Product DNA schema must exist');
  const schema = JSON.parse(schemaMatch[1]);
  const setting = (id) => schema.settings.find((item) => item.id === id);

  assert.deepEqual(schema.enabled_on?.templates, ['product']);
  assert.equal(setting('metaobject_namespace')?.default, 'custom');
  assert.equal(setting('metaobject_key')?.default, 'product_dna');
  assert.equal(setting('background_color_key')?.default, 'pdp_background_color');
  assert.equal(setting('text_color_key')?.default, 'pdp_text_color');
  assert.ok(setting('content_max_width'));
  assert.ok(setting('items_gap'));
  assert.ok(setting('image_aspect_ratio'));
  assert.ok(setting('image_fit'));
  assert.ok(setting('item_content_gap'));
  assert.ok(setting('heading_size'));
  assert.ok(setting('description_size'));
  assert.equal(schema.blocks[0]?.type, 'item');
  assert.equal(schema.max_blocks, 8);

  assert.match(source, /product_resource\.metafields\[namespace\]\[metaobject_key\]\.value/);
  assert.match(source, /product_resource\.metafields\[namespace\]\[background_key\]\.value/);
  assert.match(source, /dna_reference\[settings\.metaobject_items_field\]\.value/);
  assert.match(source, /section\.blocks/);
});
