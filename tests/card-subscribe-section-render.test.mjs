import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const SELECT_JS = 'assets/variant-select.js';
const OPTIONS_JS = 'assets/purchase-options.js';
const SNIPPET = 'snippets/purchase-options.liquid';
const SECTION = 'sections/section-rendering-subscribe-panel.liquid';
const SCRIPTS = 'snippets/scripts.liquid';
const PRODUCT_FORM_JS = 'assets/product-form.js';

/*
 * The card's Subscribe panel renders its plan radios in Liquid for one variant - whichever was
 * current when the card rendered - and nothing used to re-render them when the card's variant
 * dropdown moved. Measured on live 2026-10-26 against each product's storefront JSON:
 *
 *   subscribable products                                     6
 *   single-variant (nothing to switch, so safe)               0
 *   multi-variant whose variants share NO selling plan id     6   <- all of them
 *
 * Maple 200g allocates 6128042175,6128074943,6128107711; 1kg allocates
 * 6128140479,6128173247,6128206015 - disjoint. So on every subscribable product, choosing the
 * second size left a checked plan that variant cannot be bought on.
 *
 * #409 removed the control; this is the implementation that earns it back. The panel now asks the
 * server for the picked variant's plans, which is the same answer the product page gives, instead
 * of keeping a second copy of the allocation rule in JavaScript.
 */

/** Strip the auto-generated banner Shopify writes above a template's JSON. */
const parseTemplate = (file) =>
  JSON.parse(read(`templates/${file}`).replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));

/** The `{% schema %}` of a block or section file, parsed. */
const schemaOf = (path) => {
  const match = read(path).match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);

  return match ? JSON.parse(match[1]) : null;
};

/*
 * Codex caught the enumerating version of this: the Subscribe entry was taken out of
 * `_product-card` while `_product-card-group` still allowed it, `_product-card` allows that group,
 * the group allows itself, and every live card places its buttons in such a group. A guard naming
 * one file passed with the hole open. So ask the question structurally instead - for whatever a
 * template actually places, is the container willing to hold it - which stays true however the
 * card is restructured and whatever block is involved.
 */
test('every block a template places is allowed by the block that contains it', () => {
  const templates = readdirSync(join(root, 'templates')).filter((f) => f.endsWith('.json'));
  const violations = [];
  let placements = 0;

  for (const file of templates) {
    const template = parseTemplate(file);

    const walk = (blocks, parentType, path) => {
      for (const [key, block] of Object.entries(blocks ?? {})) {
        const here = [...path, key];

        // Only block parents are checked. A section's accepted blocks can also come from a preset
        // or from `@theme`, which is not a question this file can answer from the schema alone.
        if (parentType?.startsWith('_')) {
          const parentFile = `blocks/${parentType}.liquid`;

          if (existsSync(join(root, parentFile))) {
            placements += 1;

            const parent = read(parentFile);

            // A static block is not offered through the allow-list at all: the parent renders it
            // by name with `{% content_for 'block', id: '<key>' %}`, and the template key is that
            // id. Exempt - but only where the parent is shown to render that exact id, so nothing
            // can claim the exemption without the Liquid to back it.
            const rendersStatically = new RegExp(
              `content_for\\s+'block',[\\s\\S]{0,160}?id:\\s*'${key.replace(/[^\w-]/g, '')}'`
            ).test(parent);

            if (!rendersStatically) {
              const allowed = (schemaOf(parentFile)?.blocks ?? []).map((entry) => entry.type);

              // `@theme` is a wildcard over theme blocks; `@app` admits app blocks only, and is
              // on every card schema here - reading it as "anything goes" is what let the first
              // version of this guard pass with the hole open.
              const isAppBlock = block.type.startsWith('shopify://apps/');
              const accepted =
                allowed.includes(block.type) ||
                (allowed.includes('@theme') && !isAppBlock) ||
                (allowed.includes('@app') && isAppBlock);

              if (!accepted) {
                violations.push(`${file}: ${parentType} does not allow "${block.type}" at ${here.join(' > ')}`);
              }
            }
          }
        }

        walk(block.blocks, block.type, here);
      }
    };

    for (const [sectionKey, section] of Object.entries(template.sections ?? {})) {
      walk(section.blocks, section.type, [sectionKey]);
    }
  }

  assert.ok(placements > 20, `sanity: expected to check many placements, checked ${placements}`);
  assert.deepEqual(violations, [], `blocks placed in a container that does not allow them:\n${violations.join('\n')}`);
});

test('the panel asks the server for the picked variant rather than recomputing plans', () => {
  const js = read(SELECT_JS);
  const request = js.match(/const url = `[^`]+`/);

  assert.ok(request, `${SELECT_JS} should build a section-rendering URL for the subscribe panel`);
  assert.match(request[0], /section_id=section-rendering-subscribe-panel/, 'the request should name the panel section');
  assert.match(request[0], /variant=\$\{encodeURIComponent\(/, 'the request should be scoped to the picked variant');
});

/*
 * `section-rendering-product-card` is the obvious thing to reach for and it cannot serve this: it
 * renders a stripped card - variant JSON, swatches, price, sku - and no blocks at all, so the
 * subscribe panel is never in its output. Fetching it would return 200 with nothing to morph.
 */
test('the section it requests is one that actually renders purchase options', () => {
  const section = read(SECTION);

  assert.match(section, /render 'purchase-options'/, `${SECTION} should render the shared purchase options`);
  assert.match(section, /subscription_only:\s*true/, 'the card panel is subscription-only');
  assert.doesNotMatch(
    read(SELECT_JS),
    /section-rendering-product-card/,
    'the card panel must not be fetched from the product-card section, which renders no blocks'
  );
});

test('the product page does not acquire a redundant request', () => {
  const js = read(SELECT_JS);
  const refresh = js.match(/#refreshPlans\(input\)\s*\{[\s\S]*?\n  \}/);

  assert.ok(refresh, `${SELECT_JS} should define the refresh`);
  assert.match(
    refresh[0],
    /subscriptionOnly !== 'true'\) return/,
    'a dropdown that is not subscription-only has no plans to refresh'
  );
  assert.match(
    refresh[0],
    /closest\('subscribe-popover-component'\)/,
    'only a subscribe panel in a card refreshes; the product page re-renders its own section'
  );
});

/*
 * The window between picking a size and the answer arriving is the dangerous one: every plan on
 * screen still belongs to the previous size. `#missingPlanFor` catches most of it, but a plan that
 * two sizes happened to share would pass that check while the price and frequency shown were still
 * the other size's.
 */
test('nothing can be bought while the panel is still fetching', () => {
  const js = read(SELECT_JS);
  const pending = js.match(/#setPlansPending\(panel, pending\)\s*\{[\s\S]*?\n  \}/);

  assert.ok(pending, `${SELECT_JS} should define the pending state`);
  assert.match(pending[0], /submit\.disabled = true/, 'the submit is shut while a render is in flight');
  assert.match(
    js,
    /this\.#setPlansPending\(panel, true\);[\s\S]{0,400}?fetch\(url/,
    'the pending state is set before the request goes out, not after it returns'
  );

  assert.match(read(SNIPPET), /\[data-plans-pending\] \.purchase-options/, 'the stale panel is visibly marked');
});

test('a superseded response cannot touch the panel', () => {
  const js = read(SELECT_JS);

  assert.match(js, /this\.#plansController\?\.abort\(\);/, 'the previous request is aborted');
  assert.equal(
    (js.match(/if \(signal\.aborted\) return;/g) ?? []).length,
    2,
    'both the success and the failure path drop a response whose request was superseded'
  );
});

test('a failed render leaves the refusal in place', () => {
  // Scoped to the refresh: other handlers have their own catch blocks.
  const refresh = read(SELECT_JS).match(/#refreshPlans\(input\)\s*\{[\s\S]*?\n  \}/);

  assert.ok(refresh, `${SELECT_JS} should define the refresh`);

  const failure = refresh[0].match(/\.catch\(\(error\) => \{[\s\S]*?\n      \}\)/);

  assert.ok(failure, `${SELECT_JS} should handle a failed render`);
  assert.match(failure[0], /this\.#pointFormAtVariant\(input\)/, 'the gate is re-run so the backstop decides');
  assert.doesNotMatch(failure[0], /disabled = false/, 'a failure must never open the button itself');
});

/*
 * Markup inserted by a morph never runs its scripts. While `purchase-options` carried a
 * per-instance IIFE, a refreshed panel came back with dead controls: picking a frequency would not
 * rewrite the radio that gets posted, so the panel would submit whichever plan the server rendered
 * first regardless of what the shopper chose.
 */
test('the purchase options carry no inline script, and their behaviour is loaded as a module', () => {
  assert.doesNotMatch(read(SNIPPET), /<script/, `${SNIPPET} must not re-introduce a per-instance script`);

  const scripts = read(SCRIPTS);

  assert.match(scripts, /"@theme\/purchase-options":/, 'the module is in the import map');
  assert.match(scripts, /src="\{\{ 'purchase-options\.js' \| asset_url \}\}"/, 'the module is loaded');
});

/*
 * Both modules listen for `change` on the document. `variant-select.js` decides whether the picked
 * variant can be bought on the checked plan, and reads that plan off the radio's value - which is
 * what `purchase-options.js` rewrites when the shopper changes frequency. In bubble phase the
 * order would depend on which module happened to load first, and the gate would judge the previous
 * frequency half the time.
 */
test('the plan a frequency sets is written before the gate reads it', () => {
  assert.match(
    read(OPTIONS_JS),
    /document\.addEventListener\('change', handleChange, true\);/,
    `${OPTIONS_JS} should listen in capture phase so it lands ahead of the gate`
  );
});

/*
 * A section rendered through the Section Rendering API cannot be told the calling block's id, so
 * it renders placeholders. `form` is what reaches the add to cart form from outside it: left as
 * the placeholder, the radios would belong to no form and the panel would post a variant with no
 * plan - the exact shape of the live order that started all of this.
 */
test('the fetched markup takes on the live panel own identifiers before it is morphed in', () => {
  const js = read(SELECT_JS);
  const adopt = js.match(/#adoptPanelIds\(current, incoming\)\s*\{[\s\S]*?\n  \}/);

  assert.ok(adopt, `${SELECT_JS} should re-point the fetched markup`);
  assert.match(adopt[0], /getAttribute\('data-purchase-options-id'\)/, 'the scope marker is carried over');
  assert.match(adopt[0], /setAttribute\('form', formId\)/, 'the form association is carried over');

  const adoptIndex = js.indexOf('this.#adoptPanelIds(current, incoming)');
  const morphIndex = js.indexOf('this.#morphPreservingFocus(current, incoming)');

  assert.ok(adoptIndex > 0 && morphIndex > adoptIndex, 'the identifiers are adopted before the morph, not after it');

  // Not rebuilt from the block's naming, so this keeps working if `SubscribeForm-` is renamed.
  assert.doesNotMatch(adopt[0], /SubscribeForm/, 'the form id is resolved, not reconstructed');
});

/*
 * Found by Codex on #413. A variant with no selling plan allocations renders no radios, and every
 * `[form]` in the panel is on a radio or its frequency select - so that panel contains none at
 * all. Reading the form id off the markup being replaced therefore came back empty the next time
 * the shopper picked a size that does subscribe, leaving the new radios owned by the section's
 * placeholder form; with no `[form]` left to read, every later change failed the same way. The
 * panel would show valid plans above a button that could never open again.
 */
test('the form id survives a variant that has no plans at all', () => {
  const js = read(SELECT_JS);
  const adopt = js.match(/#adoptPanelIds\(current, incoming\)\s*\{[\s\S]*?\n  \}/);

  assert.ok(adopt, `${SELECT_JS} should re-point the fetched markup`);
  assert.match(
    adopt[0],
    /document\.getElementById\(this\.dataset\.formId \?\? ''\)/,
    'the form is resolved through the form component, which is there whatever the variant renders'
  );
  assert.doesNotMatch(
    adopt[0],
    /current\.querySelector\('\[form\]'\)/,
    'it must not be read off the markup being replaced, which a plan-less variant leaves without one'
  );
  assert.match(adopt[0], /if \(!formId\) return false;/, 'an unresolvable form refuses the morph');
  assert.match(
    js,
    /if \(!this\.#adoptPanelIds\(current, incoming\)\) \{/,
    'and the caller acts on that refusal rather than morphing placeholder-owned radios in'
  );
});

test('the shopper is not dropped out of the control when the plan list changes length', () => {
  const js = read(SELECT_JS);
  const focus = js.match(/#morphPreservingFocus\(current, incoming\)\s*\{[\s\S]*?\n  \}/);

  assert.ok(focus, `${SELECT_JS} should preserve focus across the morph`);
  assert.match(focus[0], /document\.activeElement/, 'it checks where focus was');
  assert.match(focus[0], /\.focus\(\)/, 'it puts focus back');
});

/*
 * Found by Codex on #413, and a second door into the defect this PR exists to close.
 *
 * The card places its own `variant-picker` beside the subscribe block, both inside one
 * `<product-card>` (see `buy_group` in templates/collection.json). `ProductFormComponent` binds to
 * `this.closest('.shopify-section, dialog, product-card')`, so the panel's form received the card
 * picker's `productSelect` too: `#onProductSelect` wrote the new variant id into it and called
 * `enable()` on its button, while the panel's plan radios stayed on the old size. Opening
 * Subscribe then posted the new variant with the previous one's plan - which, allocations being
 * disjoint on every subscribable product here, is a pairing the cart will not take.
 *
 * Isolation alone would leave the panel stale against the card; synchronisation alone would race
 * `#onProductSelect`'s own enable, since both hang off the same promise and listener order is not
 * guaranteed. Both are needed.
 */
test('the card picker does not drive the subscribe form', () => {
  const js = read(PRODUCT_FORM_JS);
  const handler = js.match(/#onProductSelect = async \(event\) => \{[\s\S]*?\n  \};/);

  assert.ok(handler, `${PRODUCT_FORM_JS} should handle product select`);

  const guard = handler[0].indexOf("this.closest('subscribe-popover-component')");
  const writesVariant = handler[0].indexOf('variantId.value =');

  assert.ok(guard > 0, 'a subscribe panel form must be skipped');
  assert.ok(
    writesVariant > guard,
    'and skipped before the variant id is written, or the panel is left pointing at a size whose plans it is not showing'
  );
});

test('the subscribe panel follows the card picker instead', () => {
  const js = read(SELECT_JS);

  assert.match(
    js,
    /closest\('product-card'\)\?\.addEventListener\(StandardEvents\.productSelect/,
    `${SELECT_JS} should follow the card's own picker`
  );
  assert.match(
    js,
    /closest\('product-card'\)\?\.removeEventListener\(StandardEvents\.productSelect/,
    'and let go of it when the panel is removed'
  );

  const handler = js.match(/#handleCardSelect = \(event\) => \{[\s\S]*?\n  \};/);

  assert.ok(handler, 'the card-select handler should exist');
  assert.match(handler[0], /this\.#setPlansPending\(panel, true\)/, 'the panel is shut before the answer arrives');
  assert.match(handler[0], /this\.#applySelection\(input\)/, 'a size picked on the card goes through the same path as one picked here');
  assert.match(
    handler[0],
    /if \(!\(input instanceof HTMLInputElement\)\) return;/,
    'a variant this dropdown does not list leaves the panel refusing rather than offering the old size'
  );

  /*
   * Position is the whole point: an abort that waits for `event.promise` leaves the previous
   * size's request free to land first, clear the pending state and point the form back at the
   * variant the shopper just left. It has to be dropped as the selection starts.
   */
  const abortAt = handler[0].indexOf('this.#plansController?.abort()');
  const promiseAt = handler[0].indexOf('event.promise');

  assert.notEqual(abortAt, -1, 'the card picker drops any refresh already in flight');
  assert.ok(
    abortAt < promiseAt,
    'the in-flight refresh is aborted when the selection starts, not once its answer arrives'
  );

  /*
   * Aborting the fetch does not cancel this callback, so the card's answer has to be able to tell
   * it has been superseded. The dropdown stays interactive while plans are pending - the pending
   * style covers `.purchase-options`, not the picker - so a shopper can pick a size in it and have
   * the older card answer overwrite that choice.
   */
  const captureAt = handler[0].indexOf('++this.#selectionGeneration');
  const compareAt = handler[0].indexOf('generation !== this.#selectionGeneration');
  const applyAt = handler[0].indexOf('this.#applySelection(input)');

  assert.notEqual(captureAt, -1, 'the card handler records which selection it is answering');
  assert.notEqual(compareAt, -1, 'a superseded card answer is dropped');
  assert.ok(captureAt < promiseAt, 'the generation is taken before the answer is awaited');
  assert.ok(compareAt < applyAt, 'the check runs before the stale size is applied');
});

/*
 * The counter is only worth anything if a dropdown pick advances it. Were it advanced solely by
 * the card handler, a size chosen in the dropdown mid-flight would still lose to the older card
 * answer - which is the defect it exists to prevent.
 */
test('a selection applied here supersedes an answer still in flight', () => {
  const js = read(SELECT_JS);
  const apply = js.match(/#applySelection\(input\)\s*\{[\s\S]*?\n  \}/);

  assert.ok(apply, `${SELECT_JS} should share one selection path`);
  assert.match(
    apply[0],
    /this\.#selectionGeneration \+= 1/,
    'every applied selection advances the generation, whichever picker it came from'
  );
});

/*
 * The two entry points must not drift: a fix applied to one and not the other is how this defect
 * keeps coming back. Both go through `#applySelection`, which is the only place that updates the
 * label, points the form, runs the gate and refreshes the plans.
 */
test('both ways of picking a variant run the same work', () => {
  const js = read(SELECT_JS);
  const apply = js.match(/#applySelection\(input\)\s*\{[\s\S]*?\n  \}/);

  assert.ok(apply, `${SELECT_JS} should share one selection path`);
  assert.match(apply[0], /this\.#pointFormAtVariant\(input\)/, 'it points the form and runs the gate');
  assert.match(apply[0], /this\.#refreshPlans\(input\)/, 'it refreshes the plans');

  assert.equal(
    (js.match(/this\.#applySelection\(input\)/g) ?? []).length,
    2,
    'exactly the dropdown and the card picker call it'
  );
});

/*
 * Found by Codex on #413. The pending state was a one-time write when the request went out, and
 * `[data-plans-pending] .purchase-options { pointer-events: none }` stops pointers and nothing
 * else - so a keyboard user whose focus was already in a frequency select could change it
 * mid-flight. That fires `change`, which reaches `#handlePlanChange` and so `#pointFormAtVariant`,
 * which rewrote `submit.disabled` from availability and allocation alone. Where the new variant
 * happened to share the checked plan id the button came back enabled while the panel still showed
 * the previous size's price and frequency - the one case the pending state existed to cover.
 *
 * So pending belongs in the gate, where every path that re-evaluates the button has to pass it.
 */
test('the pending state is part of the gate, not a one-time write', () => {
  const js = read(SELECT_JS);
  const gate = js.match(/#pointFormAtVariant\(input\)\s*\{[\s\S]*?\n  \}/);

  assert.ok(gate, `${SELECT_JS} should write the submit state in one place`);
  // Other writers are allowed only in the shutting direction. `#setPlansPending` needs one,
  // because the gate runs before pending is set and would otherwise leave the button open over
  // the stale plans for that moment. Anything that can *open* it must go through the gate.
  const writes = [...js.matchAll(/submit\.disabled = ([^;]+);/g)].map((m) => m[1].trim());

  assert.ok(writes.length > 0, 'the submit state should be written somewhere');

  const opening = writes.filter((expression) => expression !== 'true');

  assert.deepEqual(
    opening,
    ['unavailable || this.#plansPending() || this.#missingPlanFor(input, form)'],
    'only the gate may enable the button; every other write may only shut it'
  );
  assert.match(
    gate[0],
    /submit\.disabled =[\s\S]{0,120}?this\.#plansPending\(\)/,
    'every re-evaluation of the button must respect a panel that is still loading'
  );
  assert.match(
    js,
    /#plansPending\(\)\s*\{[\s\S]*?hasAttribute\('data-plans-pending'\)/,
    'and it should read the state the panel actually carries'
  );
});

test('a panel that failed to load stays pending rather than trusting the stale plans', () => {
  const refresh = read(SELECT_JS).match(/#refreshPlans\(input\)\s*\{[\s\S]*?\n  \}/);

  assert.ok(refresh, `${SELECT_JS} should define the refresh`);

  const failure = refresh[0].match(/\.catch\(\(error\) => \{[\s\S]*?\n      \}\)/);

  assert.ok(failure, 'the refresh should handle failure');
  assert.doesNotMatch(
    failure[0],
    /#setPlansPending\(panel, false\)/,
    'clearing it would fall back on the allocation check alone, which passes a plan the two sizes share'
  );

  // The success path must still clear it, or the button could never open again.
  const success = refresh[0].slice(0, refresh[0].indexOf('.catch('));

  assert.match(success, /this\.#setPlansPending\(panel, false\)/, 'a successful render clears it');
  assert.ok(
    success.indexOf('#setPlansPending(panel, false)') < success.lastIndexOf('#pointFormAtVariant(input)'),
    'and clears it before re-running the gate, or the gate would shut the button on fresh plans'
  );
});

/*
 * Found on the preview theme, after three rounds of review had passed over it.
 *
 * Every Shopify product form carries an `<input name="id">` for the variant, and a form's named
 * controls shadow its own properties - so `form.id` returns that input element, not the form's id
 * string. Written into the `form` attribute it stringified to "[object HTMLInputElement]": the
 * morphed radios belonged to no form at all, `radio.form` was null, nothing would have been
 * posted, and the gate found no checked plan and shut the button permanently. Measured in the
 * browser - the submit went from enabled to disabled-for-good after the first variant change.
 *
 * The same shadowing is recorded against the original diagnosis of this bug. Reading cannot catch
 * it, because `form.id` is correct-looking JavaScript; only running the page shows it.
 */
test('the form id is read as an attribute, never off the shadowed property', () => {
  const js = read(SELECT_JS);

  assert.doesNotMatch(
    js,
    /querySelector\('form'\)\?\.id\b/,
    "`form.id` is the <input name=\"id\"> control, not the id string - use getAttribute('id')"
  );
  assert.match(
    js,
    /querySelector\('form'\)\?\.getAttribute\('id'\)/,
    'the form id should be read as an attribute'
  );
});
