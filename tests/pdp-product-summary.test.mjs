import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
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

  for (const id of ['description', 'rating_value', 'rating_count', 'badge_namespace', 'badge_key', 'namespace', 'description_key']) {
    assert.ok(setting(id), `missing setting ${id}`);
  }

  // Badges are driven by a product metafield (default filters.brew_method): every
  // value renders as its own badge, and an unset metafield renders none.
  assert.equal(setting('badge_namespace').default, 'filters');
  assert.equal(setting('badge_key').default, 'brew_method');
  assert.match(blockSource, /metafields\[badge_namespace\]\[badge_key\]/);
  assert.match(blockSource, /badges_mf\.value/);

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

/*
 * The badge metafield is named by two settings. Until 2026-10-21 the Liquid
 * coalesced a blank namespace or key back to filters.brew_method, so a
 * template that simply left them unset -- product.merch.json did -- silently
 * pointed every t-shirt, tote, grinder and dripper at the COFFEE brew-method
 * metafield. Nothing rendered only because no merch product had that metafield
 * set; setting it, as the tag/metafield reconciliation intends to, would have
 * put brew methods on apparel with no code change.
 *
 * The fix is structural: blank now means "no badges". These assertions hold
 * both halves of it -- the Liquid must not reintroduce a default, and every
 * template carrying this block must state its choice explicitly rather than
 * rely on absence, because the theme editor can repopulate an ABSENT setting
 * from the schema default on any save.
 */
test('every template states its badge metafield explicitly, and blank means no badges', () => {
  assert.doesNotMatch(
    blockSource,
    /if badge_namespace == blank|if badge_key == blank/,
    'a blank badge namespace or key must stay blank, not fall back to the coffee metafield',
  );

  const templates = readdirSync(resolve(root, 'templates')).filter((name) => name.endsWith('.json'));
  const carriers = [];

  const walk = (node, template, path) => {
    for (const [id, child] of Object.entries(node.blocks ?? {})) {
      if (child.type === 'pdp-product-summary') {
        carriers.push({ template, where: `${path}/${id}`, settings: child.settings ?? {} });
      }
      walk(child, template, `${path}/${id}`);
    }
  };

  for (const name of templates) {
    const parsed = JSON.parse(
      readFileSync(resolve(root, 'templates', name), 'utf8').replace(/^\/\*[\s\S]*?\*\//, ''),
    );
    for (const [sectionId, section] of Object.entries(parsed.sections ?? {})) {
      walk(section, name, sectionId);
    }
  }

  assert.ok(carriers.length >= 2, 'expected the coffee and merch templates to carry this block');

  for (const { template, where, settings } of carriers) {
    for (const id of ['badge_namespace', 'badge_key']) {
      assert.ok(
        Object.hasOwn(settings, id),
        `${template} ${where}: ${id} must be set explicitly -- "" for no badges, "filters"/"brew_method" for coffee. ` +
          'Leaving it absent lets the theme editor refill it from the schema default.',
      );
    }
  }

  const merch = carriers.find((entry) => entry.template === 'product.merch.json');
  assert.equal(merch.settings.badge_namespace, '', 'merch shows no badges');
  assert.equal(merch.settings.badge_key, '', 'merch shows no badges');
});
