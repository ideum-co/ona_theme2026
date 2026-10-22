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

/*
 * The accelerated checkout buttons (Shop Pay and friends) are rendered by Shopify into
 * `content_for_additional_checkout_buttons`, outside `cart-form` and with no `form` attribute.
 * They do not submit the textarea: they leave with whatever note the server already holds.
 * Typing is only written after a 200 ms debounce plus an async cart update, so a shopper who
 * types a grind request and goes straight to Shop Pay can lose it. Two things close that
 * window -- a flush on blur, and a pending flag that holds the buttons until the write lands.
 */
test('a pending note write cannot be outrun by accelerated checkout', () => {
  const summary = read('snippets/cart-summary.liquid');
  const script = read('assets/cart-note.js');

  const textarea = summary.match(/<textarea[\s\S]*?>/);
  assert.ok(textarea, 'the cart note textarea is gone');
  assert.match(
    textarea[0],
    /on:blur="\/flushCartNote"/,
    'the textarea no longer flushes on blur, so the 200 ms debounce can swallow the last keystrokes'
  );
  assert.match(
    script,
    /flushCartNote\s*=/,
    'cart-note.js no longer defines flushCartNote, so the on:blur binding resolves to nothing'
  );
  assert.match(
    script,
    /updateCartNote\.cancel\(\)/,
    'flushCartNote no longer cancels the debounced write, so the flush can be overwritten by a stale one'
  );

  /* Both paths must go through the same writer, or one of them drifts. */
  assert.equal(
    (script.match(/Theme\.routes\.cart_update_url/g) ?? []).length,
    1,
    'cart-note.js writes the note from more than one place; the debounced and flush paths should share one writer'
  );

  /* The hold has two halves, and CSS is only one of them. `pointer-events: none` suppresses
     pointer hit-testing and nothing else, so a keyboard user could tab to Shop Pay and press
     Enter on the stale note. `inert` takes the subtree out of focus, activation and the
     accessibility tree. The flag on <html> drives the visual half; <cart-note> is not an
     ancestor of the buttons, so neither can be scoped to it. */
  assert.match(
    script,
    /const PENDING = 'data-cart-note-pending'[\s\S]*?documentElement\.toggleAttribute\(PENDING, pending\)/,
    'cart-note.js no longer marks a write as pending'
  );
  assert.match(
    script,
    /querySelectorAll\('\.additional-checkout-buttons'\)[\s\S]{0,160}?toggleAttribute\('inert'/,
    'the accelerated checkout buttons are not made inert while a write is in flight; CSS alone leaves them focusable and activatable by keyboard'
  );

  /* And `inert` alone is not enough either. It is set at runtime on markup Shopify renders,
     and assets/morph.js reconciles attributes against the server's copy -- so a cart mutation
     finishing mid-write strips it. The listener that actually holds the buttons is on the
     document, where no morph reaches, and it reads the same flag the CSS reads. */
  assert.match(
    script,
    /document\.addEventListener\([\s\S]{0,400}?noteIsPending\(\)[\s\S]{0,400}?closest\('\.additional-checkout-buttons'\)[\s\S]{0,400}?preventDefault\(\)/,
    'nothing stops activation at the document level, so a cart morph that strips inert reopens the race'
  );
  assert.match(
    script,
    /\{ capture: true \}/,
    'the activation guard is not registered in the capture phase, so the control handles the event first'
  );
  assert.match(
    script,
    /closest\('\.additional-checkout-buttons'\)[\s\S]{0,400}?toggleAttribute\('inert', true\)/,
    'the guard does not put inert back after a morph has removed it'
  );
  assert.match(
    script,
    /for \(const type of \['click', 'keydown'\]\)/,
    'the guard no longer covers both activation routes; Enter on a link does not always arrive as a click first'
  );
  assert.match(
    summary,
    /:root\[data-cart-note-pending\][^{]*\.additional-checkout-buttons\s*\{[^}]*pointer-events:\s*none/,
    'nothing holds back the accelerated checkout buttons while a note write is in flight'
  );
  assert.match(
    script,
    /finally\s*\{[\s\S]*?#hold\(false\)/,
    'the hold is not released in a finally block, so a failed write would leave checkout stuck'
  );
  /* And never indefinitely: being unable to check out at all is worse than losing the note. */
  assert.match(script, /setTimeout\(\(\) => this\.#hold\(false\)/, 'nothing releases the hold if the write never settles');

  /* A value recorded as written before the server took it is a note the shopper believes is
     saved and is not: the next blur of an unchanged textarea would skip the retry and let them
     leave with the previous server-side note. So the record happens after the response, which
     is checked by position because it cannot be checked by name. */
  const accepted = script.indexOf('this.#accepted = note');
  const awaited = script.indexOf('await fetch(');
  assert.ok(accepted > 0 && awaited > 0, 'cart-note.js no longer records an accepted note, or no longer fetches');
  assert.ok(
    accepted > awaited,
    'the note is recorded as accepted before the fetch resolves; a failed write would then be treated as saved and never retried'
  );

  /* A resolved fetch is not an accepted note. A 429 or a 5xx with a JSON body resolves both
     the request and `response.json()`, so the status has to be read before the note is
     recorded -- otherwise a rejected update is treated as saved and never retried. */
  const ok = script.indexOf('response.ok');
  assert.ok(ok > awaited && ok < accepted, 'cart-note.js does not reject a non-2xx response before recording the note as accepted');
  assert.match(
    script,
    /if \(!response\.ok\) throw/,
    'a non-2xx response no longer takes the failure path, so a rejected update would release checkout as if it had worked'
  );
});

/*
 * The hold released on failure, and nothing retried.
 *
 * A write that fails leaves the server holding the previous note. The hold is released in
 * `finally`, so the buttons come back -- and focus left the textarea on the first checkout
 * attempt, so no further blur ever fires. The shopper's second Shop Pay click then sailed
 * through the document guard and checked out with the old note, which on this store means the
 * grind request is gone. Codex, #292.
 */
test('a note the server rejected is retried by the next checkout attempt', () => {
  const source = read('assets/cart-note.js');

  assert.match(
    source,
    /const UNSAVED = 'data-cart-note-unsaved'/,
    'there is no unsaved state, so a failed write is indistinguishable from a saved one'
  );

  /* The guard has to act on both states, and act differently: in flight means wait, unsaved
     means retry. One condition covering both would either never retry or never hold. */
  const listener = source.slice(source.indexOf("for (const type of ['click'"), source.indexOf('class CartNote'));
  assert.match(listener, /noteIsPending\(\)/, 'the document guard no longer checks for a write in flight');
  assert.match(listener, /noteIsUnsaved\(\)/, 'the document guard ignores a note the server rejected');
  assert.match(listener, /retryOnce\(\)/, 'the guard intercepts an unsaved note without retrying it');
  assert.match(
    listener,
    /if \(pending\) \{[\s\S]*?return;/,
    'the in-flight branch must return before the retry branch, or a write in flight is retried on top of itself'
  );

  /* Bounded. A note that keeps failing must cost one retry, not block checkout on every click:
     being unable to check out at all is worse than checking out with a stale note, and the
     failure already raises a CartErrorEvent so the shopper is told. */
  assert.match(
    source,
    /#retried/,
    'nothing records that a value has already been retried, so a failing note blocks every click'
  );
  assert.match(
    source,
    /textarea\.value === this\.#accepted \|\| textarea\.value === this\.#retried/,
    'retryOnce does not stand aside once it has retried a value'
  );

  /* Set on failure, cleared on success -- in that order, and both through refreshUnsaved, since
     the flag is on <html> and the state is per instance. */
  const [, failure] = source.split("error.name !== 'AbortError'");
  assert.match(failure, /this\.#unsaved = true;[\s\S]{0,120}refreshUnsaved\(\)/, 'a failed write does not flag the note unsaved');
  assert.match(
    source,
    /this\.#accepted = note;[\s\S]{0,160}this\.#unsaved = false;[\s\S]{0,160}refreshUnsaved\(\)/,
    'a successful write does not clear the unsaved flag, so the note is retried forever'
  );
});

/*
 * The visual half of the hold must NOT widen to the unsaved state, however natural that looks.
 * `pointer-events: none` stops the click reaching the buttons at all -- and the document
 * listener finds its target with `event.target.closest('.additional-checkout-buttons')`, so a
 * click that never lands on them is a click the retry never sees. Greying the buttons out would
 * silently disable the fix above.
 */
test('the unsaved state does not take the checkout buttons out of hit-testing', () => {
  const summary = read('snippets/cart-summary.liquid');
  const styles = summary.match(/\{%\s*stylesheet\s*%\}([\s\S]*?)\{%\s*endstylesheet\s*%\}/);
  assert.ok(styles, 'cart-summary.liquid has no stylesheet block');

  for (const rule of styles[1].split('}')) {
    if (!/pointer-events\s*:\s*none/.test(rule)) continue;
    assert.doesNotMatch(
      rule,
      /data-cart-note-unsaved/,
      'the unsaved state suppresses pointer hit-testing, so the click that should retry the ' +
        'note never reaches the listener that retries it'
    );
  }
});
