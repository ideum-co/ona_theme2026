import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const blockSource = readFileSync(resolve(root, 'blocks/pdp-product-summary.liquid'), 'utf8');
const template = JSON.parse(readFileSync(resolve(root, 'templates/product.json'), 'utf8').replace(/^\/\*[\s\S]*?\*\//, ''));
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

  const details = template.sections.main.blocks['product-details'];
  assert.equal(details.block_order[0], 'pdp_product_summary');
  assert.ok(details.block_order.indexOf('pdp_product_summary') < details.block_order.indexOf('variant_picker_R3rGDr'));
  assert.deepEqual(
    Object.keys(details.blocks).filter((id) => !details.block_order.includes(id)),
    [],
    'every saved block must remain in block_order for Shopify template validation',
  );
  for (const id of ['group_icgrde', 'divider_VJhene', 'best_for_pdp', 'tastes_like_pdp']) {
    assert.equal(details.blocks[id].disabled, true, `${id} must remain preserved but disabled`);
  }
});
