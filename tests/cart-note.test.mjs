import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const stripBanner = (text) => text.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');

/*
 * The cart note is where ONA customers have always written grind requests -- it was the order
 * comments field on the previous theme, and it is how a grind instruction reaches the store
 * today. Horizon ships it behind `settings.show_cart_note`, off by default.
 *
 * These guard the plumbing, not the switch. Whether the note is on is ONA's decision and they
 * can change it in the theme editor without touching this repository, so asserting the value
 * would fail unrelated PRs the first time somebody toggles it in the admin. What must not break
 * silently is everything the switch turns on.
 */
test('the cart note is wired to the Shopify order note', () => {
  const summary = read('snippets/cart-summary.liquid');

  assert.match(
    summary,
    /\{%\s*if\s+settings\.show_cart_note\s*%\}/,
    'cart-summary.liquid no longer gates the note on settings.show_cart_note'
  );

  /* `name="note"` is the whole integration: it is what makes Shopify store the text as the
     order note rather than as an ignored form field. */
  const textarea = summary.match(/<textarea[\s\S]*?>/);
  assert.ok(textarea, 'the cart note textarea is gone');
  assert.match(textarea[0], /name="note"/, 'the textarea is not named `note`, so Shopify will not store it as the order note');
  assert.match(textarea[0], /form="cart-form"/, 'the textarea is outside cart-form, so its value is never submitted');
  assert.match(summary, /\{\{\s*cart\.note\s*\}\}/, 'the textarea does not render the existing cart.note, so a saved note disappears on reload');

  assert.ok(existsSync(join(root, 'assets/cart-note.js')), 'assets/cart-note.js is missing; the note would not persist as it is typed');
  assert.match(summary, /cart-note\.js/, 'cart-summary.liquid no longer loads cart-note.js');
});

test('the note setting exists and reaches both the drawer and the cart page', () => {
  const schema = JSON.parse(stripBanner(read('config/settings_schema.json')));
  const setting = schema
    .flatMap((group) => group.settings ?? [])
    .find((entry) => entry.id === 'show_cart_note');
  assert.ok(setting, 'config/settings_schema.json no longer declares show_cart_note');
  assert.equal(setting.type, 'checkbox', 'show_cart_note is not a checkbox');

  /* ONA runs `cart_type: "drawer"`, so the drawer is the path most customers take -- but the
     /cart page has to carry the note too, or the instruction depends on which one they opened. */
  assert.match(read('snippets/cart-drawer.liquid'), /render\s+'cart-summary'/, 'the drawer no longer renders cart-summary, so the note is missing from it');
  assert.match(
    read('sections/main-cart.liquid'),
    /content_for\s+'block',\s*id:\s*'cart-page-summary',\s*type:\s*'_cart-summary'/,
    'the cart page no longer renders the summary block, so the note is missing from /cart'
  );
});
