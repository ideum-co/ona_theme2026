import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const BLOCK = 'blocks/subscribe-button.liquid';
const SNIPPET = 'snippets/purchase-options.liquid';

/*
 * The product card's Subscribe button opens a panel. That panel used to lead with "One time
 * purchase", already selected, above a single button reading "Add to cart" -- so a shopper who
 * pressed Subscribe and then pressed the one button in the panel that appeared bought a one-time
 * item at full price and no subscription was created. Reproduced on the live site on 2026-10-26
 * from a Gateway card: radio 0 checked on open, panel's only button labelled "Add to cart",
 * resulting cart line carried no selling plan. Order #120030 is the same shape -- Aspen 200g at
 * $17.50, the exact one-time price, from a customer who meant to subscribe.
 *
 * The product page is deliberately not covered by these tests: there the one-time option leads,
 * which is correct, and it was working. What is guarded here is that the two callers stay
 * different, because the whole defect was the panel inheriting the product page's default.
 */

test('the subscribe panel asks for the subscription-only list', () => {
  const block = read(BLOCK);
  const call = block.match(/render 'purchase-options'[\s\S]{0,240}?-%\}/);
  assert.ok(call, `${BLOCK} should render the shared purchase options`);
  assert.match(
    call[0],
    /subscription_only:\s*true/,
    'the panel opened by "Subscribe" must not offer the one-time option as its default'
  );
});

test('the product page keeps the one-time option, so the two callers stay different', () => {
  const callers = [...readdirSync(join(root, 'blocks')), ...readdirSync(join(root, 'sections'))]
    .filter((n) => n.endsWith('.liquid'))
    .map((n) => (readdirSync(join(root, 'blocks')).includes(n) ? `blocks/${n}` : `sections/${n}`))
    .filter((p) => read(p).includes("render 'purchase-options'"));

  assert.ok(callers.includes(BLOCK), 'the subscribe button should be one of the callers');

  const subscriptionOnly = callers.filter((p) =>
    /render 'purchase-options'[\s\S]{0,240}?subscription_only:\s*true/.test(read(p))
  );
  assert.deepEqual(
    subscriptionOnly,
    [BLOCK],
    'only the subscribe panel drops the one-time option; everywhere else leads with it'
  );
});

test('the one-time option is withheld only in subscription-only mode', () => {
  const snippet = read(SNIPPET);
  const oneTime = snippet.indexOf("'products.product.one_time_purchase'");
  assert.ok(oneTime > 0, `${SNIPPET} should still offer a one-time option`);

  const before = snippet.slice(0, oneTime);
  const guard = before.lastIndexOf('{% unless subscription_only %}');
  const closed = before.lastIndexOf('{% endunless %}');
  assert.ok(
    guard > closed,
    'the one-time card must sit inside an open `unless subscription_only`, or the panel offers it again'
  );
});

test('exactly one subscription is preselected when there is no one-time option to fall back on', () => {
  const snippet = read(SNIPPET);
  assert.match(
    snippet,
    /if subscription_only and rendered_count == 0/,
    'preselection must be limited to the first card: a product can carry one plan per size, and ' +
      'checking every radio leaves the browser honouring the last rather than the one shown as chosen'
  );
  assert.match(snippet, /assign rendered_count = rendered_count \| plus: 1/, 'the counter must advance');
  assert.match(snippet, /\{% assign rendered_count = 0 %\}/, 'the counter must start at zero per render');
});

test('the panel cannot add a one-time item when the variant has no subscription', () => {
  const block = read(BLOCK);
  assert.match(
    block,
    /assign variant_is_subscribable = false/,
    'a 200g-only plan leaves the 1kg variant with no allocation; submitting then would add a ' +
      'one-time item, which is the defect this panel exists to close'
  );
  const gate = block.match(/if variant\.available and variant_is_subscribable/);
  assert.ok(gate, 'the submit must be gated on the variant actually being subscribable');
  assert.match(
    block,
    /can_add_to_cart:\s*subscribe_can_add/,
    'the add to cart button must read that gate rather than availability alone'
  );
  assert.match(
    read(SNIPPET),
    /subscription_unavailable_for_variant/,
    'and the shopper should be told why, not left with a dead button'
  );
});

test('the panel button carries the verb the shopper pressed', () => {
  const block = read(BLOCK);
  assert.match(
    block,
    /assign subscribe_submit_label = block_settings\.label \| default: 'Subscribe'/,
    'the confirm button should say what the trigger said'
  );

  // Every template stored the old schema default, "Add to cart", against `submit_label` -- all
  // nine identical, so no merchant ever chose it. Removing the setting leaves those stored keys
  // inert rather than rewriting nine editor-owned template files.
  const schema = block.slice(block.indexOf('{% schema %}'));
  assert.ok(
    !schema.includes('"submit_label"'),
    'submit_label should be gone from the schema; its stored values are the wording that caused the bug'
  );
});

test('the unavailable string exists in the default locale', () => {
  const raw = read('locales/en.default.json').replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
  const jsonc = raw
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  const locale = JSON.parse(jsonc);
  assert.equal(
    typeof locale.products.product.subscription_unavailable_for_variant,
    'string',
    'a missing translation key renders as the key itself on the live page'
  );
});
