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
  const js = read(SELECT_JS);
  const failure = js.match(/\.catch\(\(error\) => \{[\s\S]*?\n      \}\)/);

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
  assert.match(
    js,
    /this\.#adoptPanelIds\(current, incoming\);\s*\n\s*this\.#morphPreservingFocus\(current, incoming\);/,
    'the identifiers are adopted before the morph, not after it'
  );

  // Read off the element being replaced rather than rebuilt from the block's naming, so this keeps
  // working if `SubscribeForm-` is ever renamed.
  assert.doesNotMatch(adopt[0], /SubscribeForm/, 'the identifiers are read from the panel, not reconstructed');
});

test('the shopper is not dropped out of the control when the plan list changes length', () => {
  const js = read(SELECT_JS);
  const focus = js.match(/#morphPreservingFocus\(current, incoming\)\s*\{[\s\S]*?\n  \}/);

  assert.ok(focus, `${SELECT_JS} should preserve focus across the morph`);
  assert.match(focus[0], /document\.activeElement/, 'it checks where focus was');
  assert.match(focus[0], /\.focus\(\)/, 'it puts focus back');
});
