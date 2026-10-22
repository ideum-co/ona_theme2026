import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const source = read('snippets/cart-summary.liquid');

/*
 * Horizon's stock cart drawer ships no way back to the full /cart page -- only a checkout
 * button (snippets/cart-summary.liquid, which this theme renders ONLY inside the drawer:
 * snippets/cart-drawer.liquid, never on the standalone cart page, which renders
 * blocks/_cart-summary.liquid instead). Felipe flagged this because /cart is where Grind
 * options for coffee bags/beans need to live, so it has to be reachable from the drawer.
 *
 * The fix reuses the theme's own existing 'content.view_cart' translation string and
 * button-secondary convention -- the same pairing sections/quick-order-list.liquid already
 * uses for its own cart link -- rather than inventing new copy or a new button style.
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

test('the view-cart link sits before the checkout button, inside .cart__ctas', () => {
  const ctasIndex = code.indexOf('class="cart__ctas"');
  assert.ok(ctasIndex > -1, 'cart__ctas wrapper must exist');
  const viewCartIndex = code.indexOf("{{ 'content.view_cart' | t }}");
  const checkoutIndex = code.indexOf('id="checkout"');
  assert.ok(viewCartIndex > ctasIndex, 'the view-cart link must be inside .cart__ctas');
  assert.ok(viewCartIndex < checkoutIndex, 'the view-cart link should read before the primary checkout button, as a secondary action');
});

test('cart-summary.liquid is only ever rendered inside the drawer, never on the standalone cart page', () => {
  // If this ever stops being true, the new link would double up with a page the shopper is
  // already on -- re-check placement (e.g. gate it) rather than assuming it's still drawer-only.
  const renderSites = [
    read('snippets/cart-drawer.liquid'),
  ];
  const otherSectionsAndTemplates = [
    read('sections/main-cart.liquid'),
  ];
  assert.ok(
    renderSites.some((f) => f.includes("render 'cart-summary'")),
    'expected the drawer to still render this snippet'
  );
  assert.ok(
    !otherSectionsAndTemplates.some((f) => f.includes("render 'cart-summary'")),
    'the standalone cart page must not render this snippet (it has its own _cart-summary block) -- otherwise the view-cart link would show on the page the shopper is already on'
  );
});
