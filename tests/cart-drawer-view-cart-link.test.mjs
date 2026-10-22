import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const source = read('snippets/cart-summary.liquid');

/*
 * Horizon's stock cart drawer ships no way back to the full /cart page -- only a checkout
 * button. Felipe flagged this because /cart is where Grind options for coffee bags/beans need
 * to live, so it has to be reachable from the drawer.
 *
 * The fix reuses the theme's own existing 'content.view_cart' translation string and
 * button-secondary convention -- the same pairing sections/quick-order-list.liquid already uses
 * for its own cart link -- rather than inventing new copy or a new button style.
 *
 * snippets/cart-summary.liquid is NOT drawer-only: it's also rendered by
 * blocks/_cart-summary.liquid, which backs the standalone /cart page itself
 * (templates/cart.json -> sections/main-cart.liquid). An independent review of the first version
 * of this change caught that the link had no gate and would show on /cart too, pointing at the
 * page the shopper is already on. The fix threads a `context: 'drawer'` param from
 * snippets/cart-drawer.liquid (the only caller that should show the link) and gates the link on
 * it, the same pattern this file already uses for accelerated_checkout_buttons_layout/section_id.
 */
const code = source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');

test('the drawer links back to the full cart page, reusing the theme\'s existing view_cart string', () => {
  assert.ok(
    code.includes("{{ 'content.view_cart' | t }}"),
    'must reuse the theme\'s own view_cart translation key (already used by sections/quick-order-list.liquid), not new copy'
  );
  assert.ok(
    code.includes('href="{{ routes.cart_url }}"'),
    'the link must point at routes.cart_url, not a hardcoded /cart path'
  );
  assert.ok(
    /class="button-secondary[^"]*"/.test(code),
    'must use the theme\'s existing button-secondary convention, matching quick-order-list\'s own cart link'
  );
});

test('the view-cart link is gated on context == \'drawer\' and sits before the checkout button', () => {
  const gateIndex = code.indexOf("if context == 'drawer'");
  assert.ok(gateIndex > -1, 'the link must be gated on context == \'drawer\' -- without it, the link also renders on the standalone /cart page via blocks/_cart-summary.liquid');

  const ctasIndex = code.indexOf('class="cart__ctas"');
  const viewCartIndex = code.indexOf("{{ 'content.view_cart' | t }}");
  const checkoutIndex = code.indexOf('id="checkout"');
  assert.ok(viewCartIndex > ctasIndex, 'the view-cart link must be inside .cart__ctas');
  assert.ok(viewCartIndex > gateIndex, 'the view-cart link markup must sit inside the context == \'drawer\' gate, not before it');
  assert.ok(viewCartIndex < checkoutIndex, 'the view-cart link should read before the primary checkout button, as a secondary action');
});

test('only snippets/cart-drawer.liquid passes context: \'drawer\' -- blocks/_cart-summary.liquid (the standalone /cart page) must not', () => {
  // The render graph for the standalone /cart page: templates/cart.json's main-cart section ->
  // sections/main-cart.liquid -> content_for 'block', type: '_cart-summary' ->
  // blocks/_cart-summary.liquid -> render 'cart-summary'. An earlier version of this test only
  // checked sections/main-cart.liquid for the literal string "render 'cart-summary'" -- true,
  // but a false negative, since the actual render happens one hop downstream in
  // blocks/_cart-summary.liquid, which that version never read. Trace the real chain instead.
  const cartDrawer = read('snippets/cart-drawer.liquid');
  const cartSummaryBlock = read('blocks/_cart-summary.liquid');
  const mainCart = read('sections/main-cart.liquid');
  const cartTemplate = read('templates/cart.json');

  assert.ok(
    cartDrawer.includes("render 'cart-summary'") && cartDrawer.includes("context: 'drawer'"),
    'the drawer must render cart-summary with context: \'drawer\' so the view-cart link shows there'
  );
  assert.ok(
    cartSummaryBlock.includes("render 'cart-summary'"),
    'blocks/_cart-summary.liquid is expected to still render this snippet (it needs the totals/checkout UI too) -- if this ever changes, re-check the rest of this test'
  );
  assert.ok(
    !cartSummaryBlock.includes("context: 'drawer'"),
    'blocks/_cart-summary.liquid (the standalone /cart page\'s own summary block) must NOT pass context: \'drawer\' -- otherwise the view-cart link shows on the page the shopper is already on'
  );
  assert.ok(
    mainCart.includes("type: '_cart-summary'") && cartTemplate.includes('"type": "_cart-summary"'),
    'confirms blocks/_cart-summary.liquid is actually the block the standalone /cart page uses -- if this type name ever changes, re-check this whole render-graph trace'
  );
});
