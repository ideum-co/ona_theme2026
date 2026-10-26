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
const OPTIONS_JS = 'assets/purchase-options.js';
const PANEL_SECTION = 'sections/section-rendering-subscribe-panel.liquid';

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
 * resulting cart line carried no selling plan. A live order had already arrived in that shape: a
 * blend at the one-time price with no plan on it.
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
  // The section is the subscribe panel's own re-render: `variant-select.js` fetches it when the
  // card's variant changes and morphs the result into that same panel, so it has to drop the
  // one-time option for exactly the reason the block does. It is the panel, not another caller.
  assert.deepEqual(
    [...subscriptionOnly].sort(),
    [BLOCK, PANEL_SECTION].sort(),
    'only the subscribe panel and its own re-render drop the one-time option; everywhere else leads with it'
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

  // Reading the right variable is worth nothing if something reassigns it in between. Counted
  // rather than pattern-matched: a third assignment anywhere, in any wording, is the mutation.
  const canAddWrites = block.match(/assign subscribe_can_add/g) ?? [];
  assert.equal(
    canAddWrites.length,
    2,
    [
      'subscribe_can_add should be written exactly twice -- false, then true inside the gate.',
      'A third write after the gate silently re-opens the button on a variant with no plan.',
    ].join(' ')
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

/*
 * The guards below follow the value, not the vocabulary. The round before this one asserted that
 * `variant_is_subscribable` existed and that one line of JS was present verbatim; both survived
 * swapping the per-variant allocation test for a product-level one, and both survived deleting
 * the branch that reads the attribute. Each of those restores a defect this change was written to
 * remove. So each assertion here names the expression that has to be on the other side of the
 * assignment.
 */

test('subscribability is asked of the variant, never of the product', () => {
  const block = read(BLOCK);
  assert.match(
    block,
    /assign variant_is_subscribable = false\s+if variant\.selling_plan_allocations\.size > 0/,
    [
      'product.selling_plan_groups answers a different question: a 200g-only plan leaves 1kg with',
      'no allocation while the product still reports a group, so the gate opens on a variant that',
      'cannot be subscribed to and Subscribe sells a full-price one-off.',
    ].join(' ')
  );

  const dropdown = read(DROPDOWN);
  assert.match(
    dropdown,
    /data-variant-plans="\{% for allocation in variant\.selling_plan_allocations %\}\{\{ allocation\.selling_plan\.id \}\}/,
    'each row must list the plan ids this variant is actually allocated, not a product-level boolean'
  );
});

test('the client gate reads the variant it was given and the plan that is checked', () => {
  const js = read(SELECT_JS);
  const body = js.slice(js.indexOf('#missingPlanFor(input, form)'));
  assert.ok(body, 'the gate should still exist');

  assert.match(
    js,
    /submit\.disabled = unavailable \|\| this\.#missingPlanFor\(input, form\)/,
    'variant-select.js rewrites submit.disabled on every dropdown change; the gate has to be in it'
  );
  assert.match(
    body,
    /element\.name === 'selling_plan' && element\.checked && element\.value/,
    [
      'the checked plan has to be found by its checked state. elements.namedItem returns the input',
      'itself when only one control shares the name - the common one-group shape here - and a lone',
      'input reports its value whether or not it is checked, so the gate would wave through a panel',
      'with nothing selected.',
    ].join(' ')
  );
  assert.match(
    body,
    /input\.dataset\.variantPlans/,
    'dropping the attribute read leaves the gate blind to which variant was picked'
  );
  assert.match(
    body,
    /return !allocated\.includes\(checked\.value\)/,
    [
      'a variant can have allocations and still not have one for the plan that is checked -',
      'two groups split across two sizes. Asking only whether the variant subscribes at all posts',
      'a pairing the cart will not take.',
    ].join(' ')
  );
  assert.match(
    body,
    /if \(!checked\) return true;/,
    'nothing checked must close the button, not open it'
  );
  assert.match(
    js,
    /if \(this\.dataset\.subscriptionOnly !== 'true'\) return false;/,
    'the product page must stay ungated: there, no plan checked is the one-time purchase'
  );
});

test('only the subscribe panel turns the client gate on', () => {
  const dropdown = read(DROPDOWN);
  assert.match(
    dropdown,
    /\{% if subscription_only %\}\s*data-subscription-only="true"\s*\{% endif %\}/,
    [
      'unconditional, the gate reaches every caller of this dropdown. product-highlight renders no',
      'selling_plan input at all, so nothing is ever checked and its add to cart button would be',
      'permanently disabled.',
    ].join(' ')
  );

  const callers = [...readdirSync(join(root, 'blocks')), ...readdirSync(join(root, 'sections'))]
    .filter((n) => n.endsWith('.liquid'))
    .map((n) => (readdirSync(join(root, 'blocks')).includes(n) ? `blocks/${n}` : `sections/${n}`))
    .filter((p) => read(p).includes("render 'variant-select-dropdown'"));

  assert.ok(callers.length > 1, 'this dropdown should still have more than one caller to protect');

  const gated = callers.filter((p) =>
    /render 'variant-select-dropdown'[\s\S]{0,240}?subscription_only:\s*true/.test(read(p))
  );
  assert.deepEqual(gated, [BLOCK], 'only the subscribe panel may switch the gate on');
});

test('the frequency list offers only plans this variant is allocated', () => {
  const snippet = read(SNIPPET);
  const option = snippet.indexOf('<option');
  const guard = snippet.lastIndexOf('{% unless plan_allocation == blank %}', option);
  assert.ok(
    guard > 0 && guard < option,
    [
      'a group can hold a plan this variant was never allocated. Offered, it renders a blank price',
      'and writes an unallocated plan id onto the radio when picked - reachable on a single-variant',
      'product with no dropdown involved, and the panel is subscription-only now, so it is the only',
      'path through it.',
    ].join(' ')
  );
});

test('the unavailable message is announceable and sits outside the empty radiogroup', () => {
  const snippet = read(SNIPPET);
  const listClose = snippet.indexOf('</div>', snippet.indexOf('role="radiogroup"'));
  const message = snippet.indexOf('purchase-options__unavailable');
  assert.ok(
    message > listClose,
    'in the one state where it renders the radiogroup holds no radios, and non-radio content inside\n' +
      'role="radiogroup" is not reliably announced -- the one shopper facing a dead button would be\n' +
      'the one not told why'
  );
  assert.match(
    snippet,
    /<p class="purchase-options__unavailable" role="status">/,
    'it replaces content that was there a moment ago, so it has to announce itself'
  );
});

/*
 * M-A through M-F: six more mutations that left the suite green after the round above. The worst,
 * M-A, is a single word -- `assign preselect = true` becomes `false` -- and it restores the exact
 * defect this whole change is named after: nothing checked, no one-time radio either because the
 * panel is subscription-only, button still enabled, Subscribe posts no selling plan. The earlier
 * guards asserted the `if` condition, the counter and the `{% if preselect %} checked` markup, all
 * of which stay true while `preselect` is never once true. Assert the assignment.
 */

test('the preselect branch actually assigns true', () => {
  const snippet = read(SNIPPET);
  assert.match(
    snippet,
    /if subscription_only and rendered_count == 0\s+assign preselect = true/,
    [
      'the branch has to set preselect, not merely exist. Flipped to false, nothing is checked,',
      'there is no one-time radio to fall back on, the button stays enabled, and Subscribe posts',
      'no selling plan -- the defect this change exists to remove.',
    ].join(' ')
  );
});

test('preselect is reset on every iteration, so only one card can claim it', () => {
  const snippet = read(SNIPPET);
  const reset = snippet.indexOf('assign preselect = false');
  const branch = snippet.indexOf('if subscription_only and rendered_count == 0');
  assert.ok(reset > 0 && reset < branch, [
    'Liquid variables persist across for iterations, so without the reset every card after the',
    'first renders checked and is-selected: several read as chosen while the browser honours the',
    'last one.',
  ].join(' '));
});

test('the plan ids are separated, or the list is one unmatchable token', () => {
  const dropdown = read(DROPDOWN);
  assert.match(
    dropdown,
    /data-variant-plans="\{% for allocation in variant\.selling_plan_allocations %\}\{\{ allocation\.selling_plan\.id \}\}\{% unless forloop\.last %\},\{% endunless %\}\{% endfor %\}"/,
    [
      'without the separator the ids concatenate into a single token, includes() never matches,',
      'and Subscribe is permanently disabled on every variant with two or more allocations.',
      'The previous regex stopped before the separator, so dropping it changed nothing here.',
    ].join(' ')
  );
});

const sliceBetween = (text, from, to) => {
  const a = text.indexOf(from);
  if (a < 0) return '';
  const b = to ? text.indexOf(to, a) : -1;
  return text.slice(a, b < 0 ? undefined : b);
};

/*
 * This behaviour used to live in an IIFE printed inside the snippet. It moved to a module when the
 * card panel started replacing its purchase options with server-rendered markup: HTML inserted by
 * a morph never runs its scripts, so a refreshed panel came back with every control dead. Same two
 * assertions, followed to where the code now is.
 */
test('changing the frequency rewrites the posted plan and marks it chosen', () => {
  const handler = sliceBetween(read(OPTIONS_JS), 'target instanceof HTMLSelectElement', 'syncCardState(root);');

  assert.match(handler, /radio\.value = target\.value;/, [
    'without this the radio keeps the default plan id: the shopper picks a cadence, is shown it',
    'as selected, and is subscribed to a different one.',
  ].join(' '));

  assert.match(handler, /radio\.checked = true;/, [
    'and without THIS, on the product page the one-time radio stays the checked one while the',
    'subscription card shows the chosen frequency and price. Add to cart then posts no selling',
    'plan -- this PR\'s defect, re-created on the surface that was working.',
  ].join(' '));
});

test('the plan-change listener is actually reachable and does the work', () => {
  const js = read(SELECT_JS);

  // The listener registration, and the condition it hangs off. Asserting the addEventListener
  // line alone passed while the branch around it was changed to one that never matches.
  const connect = sliceBetween(js, 'connectedCallback() {', 'disconnectedCallback()');
  const condition = connect.indexOf("this.dataset.subscriptionOnly === 'true'");
  const register = connect.indexOf("document.addEventListener('change', this.#handlePlanChange)");
  assert.ok(condition > 0, 'the listener must hang off the subscription-only flag');
  assert.ok(register > condition, 'and be registered inside that branch, in that order');

  assert.match(
    sliceBetween(js, 'disconnectedCallback() {', '#showSelectedValue'),
    /document\.removeEventListener\('change', this\.#handlePlanChange\)/,
    'it has to come off again, or every disconnected card keeps listening'
  );

  // The handler body: an early return for other panels' controls, then the actual re-run.
  const handler = sliceBetween(js, '#handlePlanChange = (event) => {', '#ownsPlanControl(target) {');
  assert.match(
    handler,
    /if \(!this\.#ownsPlanControl\(target\)\) return;/,
    'dropping the negation makes the gate re-run for every other panel and never for its own'
  );
  assert.match(
    handler,
    /this\.#pointFormAtVariant\(variant\)/,
    'and without this call the handler is an ownership test that does nothing'
  );
});

test('plan-control ownership is decided per instance, from this dropdown own form', () => {
  const owns = sliceBetween(read(SELECT_JS), '#ownsPlanControl(target) {', '/**\n   * Points a standalone');

  assert.match(
    owns,
    /document\.getElementById\(this\.dataset\.formId \?\? ''\)/,
    [
      'the form has to be resolved from this instance own data-form-id. Resolved any other way --',
      'document.querySelector(\'form\'), say -- every panel on a collection page shares one form',
      'and the gate answers for the wrong card, while `target.form === formElement` still reads',
      'correct in the source.',
    ].join(' ')
  );
  assert.match(owns, /target\.form === formElement/, 'ownership by form association, not position');
  assert.match(
    owns,
    /target\.name === 'selling_plan'/,
    [
      'the radio branch keys off the control name. Broken, clicking a second subscription card',
      'changes the posted plan without re-running the gate -- route 2 reopening through the radio',
      'rather than the select.',
    ].join(' ')
  );
});

test('the gate still reads variant availability, from both sides', () => {
  assert.match(
    read(SELECT_JS),
    /const unavailable = input\.dataset\.variantAvailable === 'false';/,
    'hard-coded false leaves a sold-out variant with an enabled submit'
  );
  assert.match(
    read(DROPDOWN),
    /data-variant-available="\{\{ variant\.available \}\}"/,
    'and the Liquid has to report it honestly; a literal "true" has the same effect'
  );
});

test('subscribable_count actually counts', () => {
  assert.match(
    read(SNIPPET),
    /assign subscribable_count = subscribable_count \| plus: 1/,
    [
      'stuck at zero, every subscription-only panel renders "Not available as a subscription in',
      'this size" under a working Subscribe button.',
    ].join(' ')
  );
});
