import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const BLOCK = 'blocks/subscribe-button.liquid';
const SNIPPET = 'snippets/purchase-options.liquid';
const PAGE_BLOCK = 'blocks/purchase-options.liquid';
const DROPDOWN = 'snippets/variant-select-dropdown.liquid';
const SELECT_JS = 'assets/variant-select.js';

/*
 * The one-time card is also a `name="selling_plan"` radio -- with an empty value, and earlier in
 * the file -- so matching on the name alone picks the wrong one. The subscription radio is the one
 * that carries an allocation's plan id.
 */
const planRadio = (snippet) =>
  snippet.match(/<input\s+type="radio"\s+name="selling_plan"\s+value="\{\{ allocation\.selling_plan\.id \}\}"[\s\S]*?>/);

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
  assert.ok(
    callers.includes(PAGE_BLOCK),
    `${PAGE_BLOCK} must still render the purchase options: asserting only that nobody else asks
     for subscription_only stays true when the product page stops rendering them at all`
  );

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

/*
 * The four tests below guard the rendered markup rather than the Liquid that computes it. Every
 * assertion above this point reads a computation -- `assign preselect`, `if subscription_only` --
 * and a computation can be perfectly correct while nothing is emitted from it. Deleting the
 * `checked` attribute left all of them green: the card still carried `is-selected`, so the panel
 * looked exactly right and posted no selling plan. That is the shipped defect, restored, wearing
 * the same face. So: assert the output.
 */

test('the preselected card both checks its radio and shows as chosen', () => {
  const snippet = read(SNIPPET);
  const radio = planRadio(snippet);
  assert.ok(radio, 'the subscription radio should still be there');
  assert.match(
    radio[0],
    /\{%\s*if preselect\s*%\}\s*checked\s*\{%\s*endif\s*%\}/,
    'without the checked attribute the panel looks selected and posts no plan -- the original bug'
  );
  assert.match(
    snippet,
    /class="purchase-options__card\{%\s*if preselect\s*%\} is-selected\{%\s*endif\s*%\}"/,
    'the card the radio checks must be the card that reads as chosen'
  );
});

test('the plan radios stay bound to the form they are posted with', () => {
  const snippet = read(SNIPPET);
  const radios = [...snippet.matchAll(/<input\s+type="radio"\s+name="selling_plan"[\s\S]*?>/g)].map((m) => m[0]);

  // Both of them: the one-time radio and the subscription radio. Counting first, because an
  // assertion that walks a list protects only the entries the list happens to hold.
  assert.equal(radios.length, 2, 'the snippet should still render a one-time radio and a plan radio');

  for (const radio of radios) {
    assert.match(
      radio,
      /form="\{\{ form_id \}\}"/,
      [
        'the radios sit outside the form and reach it only through this attribute.',
        'Drop it from the plan radio and every subscription silently becomes a one-time purchase;',
        'drop it from the one-time radio and the product page can no longer clear a chosen plan.',
      ].join(' ')
    );
  }
});

test('a group with no allocation for this variant does not consume the preselect slot', () => {
  const snippet = read(SNIPPET);
  const guard = snippet.indexOf('{% unless allocation == blank %}');
  const bump = snippet.indexOf('assign rendered_count = rendered_count | plus: 1');
  assert.ok(guard > 0 && bump > guard, [
    'the counter must advance inside the allocation guard, not before it.',
    'Advanced outside, a product whose first group has no allocation for the current variant',
    'burns the only preselect slot on a card that was never rendered, so nothing is checked',
    'and Subscribe posts no plan.',
  ].join(' '));
});

test('the panel keeps its submit shut when the picked variant carries no plan', () => {
  const dropdown = read(DROPDOWN);
  assert.match(
    dropdown,
    /data-variant-subscribable="\{%\s*if variant\.selling_plan_allocations\.size > 0\s*%\}true\{%\s*else\s*%\}false\{%\s*endif\s*%\}"/,
    'each variant row has to say whether it can be subscribed to at all'
  );
  assert.match(dropdown, /data-subscription-only="true"/, 'and the dropdown has to know it is in a subscribe panel');

  const block = read(BLOCK);
  const call = block.match(/render 'variant-select-dropdown'[\s\S]{0,240}?-%\}/);
  assert.ok(call, `${BLOCK} should render the variant dropdown`);
  assert.match(call[0], /subscription_only:\s*true/, 'the subscribe panel must switch that gate on');

  const js = read(SELECT_JS);
  assert.match(
    js,
    /submit\.disabled = unavailable \|\| this\.#missingPlanFor\(input, form\)/,
    [
      'variant-select.js writes submit.disabled on every dropdown change from variant availability.',
      'Without the plan gate it reopens the button on a variant with no allocation -- or with no',
      'plan radios rendered at all -- and Subscribe sells a full-price one-off, which is the bug',
      'this whole change exists to remove.',
    ].join(' ')
  );
  assert.match(js, /if \(this\.dataset\.subscriptionOnly !== 'true'\) return false;/, 'the product page must stay ungated');
});
