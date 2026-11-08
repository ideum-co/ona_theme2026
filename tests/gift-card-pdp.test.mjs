import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const readJson = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8').replace(/^\/\*[\s\S]*?\*\/\s*/, ''));
const read = (p) => readFileSync(resolve(root, p), 'utf8');

const summaryOf = (template) =>
  template.sections.main.blocks['product-details'].blocks.pdp_product_summary.settings;

/*
 * Six Digital Gift Cards are ACTIVE on the default product template, and that
 * template is the coffee baseline. Everything a coffee page shows from a
 * product metafield FALLS BACK to a placeholder when the metafield is missing,
 * and a gift card is missing all of them -- so the live pages advertised
 * "Caramel, biscuits, nuts and spices" (which is Maple's real tasting note,
 * sitting in the block schema as a default) and a "5.0 (0)" star rating for a
 * product Judge.me has never scored.
 *
 * templates/product.gift-card.json turns each of those off EXPLICITLY rather
 * than relying on an absent setting, because Shopify serialises schema
 * defaults back into editor-owned templates -- an omitted key does not stay
 * omitted.
 */
test('the gift-card template advertises nothing it cannot back up', () => {
  const t = readJson('templates/product.gift-card.json');
  const s = summaryOf(t);

  assert.doesNotMatch(
    JSON.stringify(t),
    /Caramel, biscuits, nuts and spices/,
    "Maple's tasting note must not reach a gift card"
  );
  assert.doesNotMatch(
    JSON.stringify(t),
    /TASTES LIKE/,
    'a gift card has no flavour; the panel heading must not claim one'
  );

  assert.equal(s.namespace, '', 'a blank namespace is what switches the tasting-note metafield override off');
  assert.equal(s.description_key, '');
  assert.equal(s.badge_namespace, '', 'brew-method badges belong on coffee, not on a gift card');
  assert.equal(s.badge_key, '');
  assert.equal(s.show_rating, false, 'the gift cards have no reviews, so there is no rating to show');
  assert.ok(s.description.length > 0, 'the summary still needs copy of its own, or it inherits one');
});

test('the gift-card template is a valid, minimal product template', () => {
  const t = readJson('templates/product.gift-card.json');
  const count = Object.keys(t.sections).length;
  assert.ok(count <= 25, `Shopify refuses a template over 25 sections; this has ${count}`);
  assert.deepEqual(
    [...t.order].sort(),
    Object.keys(t.sections).sort(),
    'every section must appear in order exactly once, or Shopify rejects the template'
  );
  assert.ok(t.sections.main, 'the product form has to be on the page');
  assert.equal(t.sections.main.type, 'product-information');
});

/*
 * The two fallbacks above are defined in the block, so the block is where they
 * have to stop being hazards -- otherwise the next template that leaves either
 * setting alone inherits them again.
 */
test('the product summary block invents neither a tasting note nor a rating', () => {
  const block = read('blocks/pdp-product-summary.liquid');

  assert.doesNotMatch(
    block,
    /Caramel, biscuits, nuts and spices/,
    "the schema default was one coffee's real tasting note, served to every product that had none of its own"
  );

  assert.match(
    block,
    /rating_count_number\s*>\s*0/,
    'the rating must be gated on a real review count, not rendered from the fallback'
  );
  assert.doesNotMatch(
    block,
    /\{%-\s*if block_settings\.show_rating and rating != blank\s*-%\}/,
    'the ungated rating render is what shipped "5.0 (0)" on products with no reviews'
  );
});

/*
 * Removing the schema default is not the whole fix. Shopify had already
 * serialised that default into two editor-owned templates, so `product.json`
 * and `product.non-coffee.json` each held Maple's tasting note as a literal
 * value -- which is why the Milk-Blend Bundle, a coffee-template product with
 * no `accentuate.tastes_like` of its own, read as caramel and biscuits too.
 * A template value outlives the schema it came from; both have to be blank.
 *
 * `""` is a legal VALUE here even though `"default": ""` is silently rejected
 * in a schema: product.equipment.json and product.merch.json already carry it,
 * and the block renders nothing at all when the description is blank.
 */
test('no product template carries a literal tasting note', () => {
  const templates = readdirSync(resolve(root, 'templates')).filter((f) => f.startsWith('product.'));
  assert.ok(templates.length >= 5, `only ${templates.length} product templates found; the probe is broken`);

  for (const name of templates) {
    const t = readJson(`templates/${name}`);
    assert.doesNotMatch(
      JSON.stringify(t),
      /Caramel, biscuits, nuts and spices/,
      `${name} states one coffee's tasting note as the fallback for every product on it`
    );

    const summary = t.sections?.main?.blocks?.['product-details']?.blocks?.pdp_product_summary;
    if (!summary) continue;
    const { description, namespace, description_key: key } = summary.settings;
    if (namespace && key) {
      assert.equal(
        description,
        '',
        `${name} reads the tasting note from ${namespace}.${key}; its fallback must be blank, ` +
          'because a product without that metafield would otherwise print whatever is stored here',
      );
    }
  }
});
