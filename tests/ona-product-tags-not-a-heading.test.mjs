import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

/*
 * A promo badge is a label, not a section heading. Rendered as a bare <h5> it
 * put an h5 into the document outline with no h2-h4 above it, which axe
 * reports as `heading-order` -- Lighthouse saw it on the homepage with the
 * badge text as the offending node.
 *
 * The obvious fix -- swap <h5> for <span> -- is NOT safe here. The badge's gold
 * background, padding and cream text come from hand-written Custom CSS in the
 * live theme's `platform_customizations.custom_css`, keyed on `h5`:
 *
 *   .product-card .ona-pdp-tags .custom_product_tags h5,
 *   .ona-pdp-tags .custom_product_tags h5 { color: #f5f4ec !important; }
 *
 * That CSS is shop-owned and not in this repo, so renaming the element would
 * stop it matching and expose the raw metafield colour on the gold chip.
 * Measured on the live PDP, the span swap moved the badge from 16.8px to
 * 22.4px tall and flipped the text from cream to red.
 *
 * `role="presentation"` drops only the heading semantics -- the text stays in
 * the accessibility tree as plain text, every CSS selector still matches, and
 * the computed style is byte-identical (verified in-page). Keep the element,
 * keep the role.
 */
test('promo badges are labels, not headings', () => {
  const snippet = read('snippets/ona-product-tags.liquid');
  const block = read('blocks/ona-product-tags.liquid');

  for (const [name, source] of [['snippet', snippet], ['block', block]]) {
    const openers = source.match(/<h5[^>]*>/g) ?? [];
    assert.ok(openers.length > 0, `${name}: expected the badge to still be an h5 element`);
    for (const tag of openers) {
      assert.match(tag, /role="presentation"/, `${name}: every badge h5 must drop its heading role -- ${tag}`);
    }
  }

  // The element itself must NOT change: the live Custom CSS keys off `h5`.
  assert.doesNotMatch(
    snippet,
    /<span class="custom_product_tags__label"/,
    'do not rename the element -- shop-owned Custom CSS targets h5'
  );

  // The badge CSS in the block must keep targeting h5, for the same reason.
  assert.match(block, /\.ona-pdp-tags \.custom_product_tags h5 \{/, 'scoped badge CSS must still target h5');
});
