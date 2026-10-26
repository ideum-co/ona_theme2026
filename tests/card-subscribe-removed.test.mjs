import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * The grid Subscribe panel is gone; subscriptions are a product-page decision.
 *
 * Why it went, measured on live 2026-10-26 from each product's storefront JSON - the same
 * `selling_plan_allocations` Liquid reads:
 *
 *   subscribable products                                     6
 *   single-variant (nothing to switch, so safe)               0
 *   multi-variant whose variants share NO selling plan id     6   <- all of them
 *
 * Maple 200g allocates 6128042175,6128074943,6128107711; 1kg allocates
 * 6128140479,6128173247,6128206015 - disjoint. `purchase-options` renders its plan radios in
 * Liquid for `product.selected_or_first_available_variant` only, and nothing re-renders them
 * when the card's variant dropdown moves. So on every subscribable product, choosing the second
 * size left a checked plan the variant cannot buy; `variant-select.js` correctly disabled the
 * button, with no message. The second size was silently unbuyable from the grid.
 *
 * The previous theme never offered this: in `onacoffee_theme` every `selling_plan` reference is
 * in a product template or the cart, and the card's add-to-cart was one-time only. Removing it
 * returns the store to that behaviour rather than regressing it.
 *
 * Horizon already ships the fix we would need: `variant-picker.js` re-renders through the
 * Section Rendering API into `sections/section-rendering-product-card.liquid`, which is how
 * quick-add and swatches stay correct. ONA's bespoke `variant-select.js` bypasses that path.
 * Until the card's variant change goes through section rendering, the panel cannot track the
 * selected variant, and a card-level Subscribe button is a promise the grid cannot keep.
 */

const templates = readdirSync('templates').filter((f) => f.endsWith('.json'));

/** Strip the auto-generated banner Shopify writes above the JSON. */
const parse = (file) => {
  const raw = readFileSync(`templates/${file}`, 'utf8');
  return JSON.parse(raw.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));
};

/** Every block in the tree, at any depth. */
function* blocksOf(node) {
  if (Array.isArray(node)) {
    for (const child of node) yield* blocksOf(child);
  } else if (node && typeof node === 'object') {
    if (node.blocks && typeof node.blocks === 'object') {
      for (const [key, block] of Object.entries(node.blocks)) yield { key, block, parent: node };
    }
    for (const value of Object.values(node)) yield* blocksOf(value);
  }
}

test('no template places a Subscribe button on a product card', () => {
  const offenders = [];

  for (const file of templates) {
    for (const { key, block } of blocksOf(parse(file))) {
      if (block?.type === 'subscribe-button') offenders.push(`${file} -> blocks.${key}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `A card-level Subscribe button is back. It cannot track the variant dropdown, so on every ` +
      `subscribable product the second size is silently unbuyable. Route the card's variant ` +
      `change through section-rendering-product-card before re-adding it.\n  ${offenders.join('\n  ')}`
  );
});

test('a removed card key is never left dangling in its block_order', () => {
  for (const file of templates) {
    for (const { parent } of blocksOf(parse(file))) {
      if (!Array.isArray(parent.block_order)) continue;
      const known = Object.keys(parent.blocks ?? {});
      const dangling = parent.block_order.filter((key) => !known.includes(key));
      assert.deepEqual(dangling, [], `${file}: block_order names blocks that do not exist: ${dangling}`);
    }
  }
});

test('the product page keeps its own purchase options, which is where subscribing now happens', () => {
  // Also the only remaining render path for `appstle-widget-styles`, so if this block ever goes
  // the Appstle widget loses its contrast fix along with it.
  const withPanel = templates.filter((file) =>
    [...blocksOf(parse(file))].some(({ block }) => block?.type === 'purchase-options')
  );

  assert.deepEqual(
    withPanel.sort(),
    ['product.equipment.json', 'product.json', 'product.merch.json', 'product.non-coffee.json'],
    'the product templates must keep their purchase-options block'
  );
});

test('no block or section schema offers the Subscribe block while #411 is open', () => {
  // Scanned, never enumerated. The first version of this guard checked only
  // blocks/_product-card.liquid and passed while blocks/_product-card-group.liquid still listed
  // subscribe-button - and _product-card allows that group, the group allows itself, and live
  // templates already contain one (buy_group in collection.json). So the editor path this was
  // meant to close stayed open behind a green test. Walk every schema instead; a new container
  // block is then covered the day it is added, without anyone remembering to update this list.
  //
  // blocks/subscribe-button.liquid itself is deliberately kept - this only removes it from the
  // allowed-child lists. Restoring those entries is the last step of #411, once the card's
  // variant change re-renders through section-rendering-product-card.
  const files = [
    ...readdirSync('blocks').map((f) => `blocks/${f}`),
    ...readdirSync('sections').map((f) => `sections/${f}`),
  ].filter((f) => f.endsWith('.liquid'));

  const offenders = [];
  let scanned = 0;

  for (const file of files) {
    const match = readFileSync(file, 'utf8').match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
    if (!match) continue;

    let schema;
    try {
      schema = JSON.parse(match[1]);
    } catch {
      continue; // schemas carrying Liquid are not ours to parse here
    }
    scanned += 1;

    for (const block of schema.blocks ?? []) {
      if (block?.type === 'subscribe-button') offenders.push(file);
    }
  }

  assert.ok(scanned > 20, `sanity: expected to parse many schemas, parsed ${scanned}`);
  assert.deepEqual(
    offenders,
    [],
    `These schemas still let the theme editor add a card Subscribe control, which cannot follow ` +
      `the variant dropdown:\n  ${offenders.join('\n  ')}`
  );
});
