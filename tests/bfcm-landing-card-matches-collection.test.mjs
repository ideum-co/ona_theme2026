import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const template = (name) =>
  JSON.parse(readFileSync(resolve(root, 'templates', name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));

/* Every block in a template, section settings included, depth-first. */
function* blocksOf(parsed) {
  function* walk(blocks) {
    for (const block of Object.values(blocks ?? {})) {
      yield block;
      yield* walk(block.blocks);
    }
  }
  for (const section of Object.values(parsed.sections ?? {})) yield* walk(section.blocks);
}

const galleryOf = (parsed) => {
  const found = [...blocksOf(parsed)].filter((b) => b.type === '_product-card-gallery');
  assert.equal(found.length, 1, 'expected exactly one _product-card-gallery per template');
  return found[0];
};

const paddingOf = (block) =>
  Object.fromEntries(
    Object.entries(block.settings ?? {})
      .filter(([k]) => k.startsWith('padding-'))
      .sort(([a], [b]) => a.localeCompare(b))
  );

/*
 * The BFCM landing hand-replicates the collection's product card
 * (templates/page.bfcm.json, added in #489) rather than reusing its config, so
 * the two can drift silently. They did: the landing's gallery shipped with 40px
 * padding against the collection's 20px.
 *
 * That is not a cosmetic difference, because of where the promo badge comes
 * from. `.custom_product_tags` is positioned `absolute; top: 10px; left: 10px`
 * by the shop-owned Custom CSS in settings_data.json, and its offset parent is
 * the CARD, not the image. So the gallery's padding is exactly the distance
 * between the badge and the image it is supposed to sit on:
 *
 *   collection, padding 20 -> badge 10px above the image top   (measured)
 *   landing,    padding 40 -> badge 30px above the image top   (measured)
 *
 * The expectation is derived from collection.json rather than hard-coded, so
 * changing the collection card moves this test with it instead of leaving a
 * stale literal behind.
 */
test('the BFCM landing gallery padding matches the collection card', () => {
  const landing = paddingOf(galleryOf(template('page.bfcm.json')));
  const collection = paddingOf(galleryOf(template('collection.json')));

  assert.ok(Object.keys(collection).length >= 4, 'collection.json should set the gallery padding');
  assert.deepEqual(
    landing,
    collection,
    'the landing gallery padding must equal the collection card, or the promo badge sits off the image'
  );
});
