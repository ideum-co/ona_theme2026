import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const stripBanner = (s) => s.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
const settings = () => JSON.parse(stripBanner(read('config/settings_data.json')));

/* The shop-side rule that hides the native plan selector. It is one string in an
   array a merchant edits through Shopify's own Custom CSS box, so it is reachable
   without a PR -- which is exactly why it needs a guard rather than a comment.
   `platform_customizations` sits at the ROOT of settings_data.json, beside
   `current` and `presets`, not inside `current`; reading it off `current` finds
   nothing and would pass this guard vacuously. */
const customCss = () => {
  const list = settings().platform_customizations?.custom_css;
  assert.ok(Array.isArray(list), 'platform_customizations.custom_css is missing; the probe is broken');
  return list;
};
const hidingRules = () =>
  customCss().filter((rule) => /\.purchase-options\b/.test(rule) && /display\s*:\s*none/.test(rule));

/*
 * ONA hides Horizon's native purchase-options on the PRODUCT PAGE, because
 * subscriptions are sold there through Appstle instead. The rule was written
 * unscoped -- `.purchase-options__list,.purchase-options {display: none;}` --
 * and `.purchase-options` is not a product-page-only class. It renders in three
 * places, and only one of them is inside `.product-information`:
 *
 *   1. blocks/purchase-options.liquid          -- the PDP block  (hide: intended)
 *   2. blocks/subscribe-button.liquid          -- the product-CARD panel
 *   3. sections/section-rendering-subscribe-panel.liquid -- the same panel, fetched
 *
 * So the unscoped rule also hid the plan selector inside the card Subscribe
 * panel, which is enabled on ten templates. The panel still opened, still
 * carried its variant dropdown and its add-to-cart button -- and offered no
 * frequency to subscribe at. A whole feature, with two dedicated test files
 * behind it, was invisible because of one line in a settings file.
 *
 * Scoping the selector to `.product-information` keeps the PDP exactly as it
 * was and gives the card panel its control back.
 */
test('the purchase-options hiding rule is scoped to the product page', () => {
  const rules = hidingRules();
  assert.equal(rules.length, 1, `expected exactly one rule hiding .purchase-options, found ${rules.length}`);

  const [rule] = rules;
  for (const selector of rule.split('{')[0].split(',')) {
    assert.match(
      selector.trim(),
      /^\.product-information\s+\./,
      'every selector that hides .purchase-options must be scoped to .product-information, ' +
        'or it also hides the plan selector inside the product-card Subscribe panel',
    );
  }
});

/*
 * The scope is only correct while `.product-information` really is the PDP
 * wrapper and really does NOT wrap the card panel. Both halves are asserted
 * from the source, because a rename on either side would leave the rule
 * syntactically fine and semantically wrong -- hiding nothing, or hiding the
 * card panel again.
 */
test('.product-information wraps the PDP and not the card subscribe panel', () => {
  assert.match(
    read('snippets/product-information-content.liquid'),
    /class="product-information section/,
    'the PDP wrapper class moved; the scoped rule would stop hiding the PDP selector',
  );

  const panel = read('blocks/subscribe-button.liquid');
  assert.match(panel, /render 'purchase-options'/, 'the card panel no longer renders purchase-options; this guard is stale');
  assert.doesNotMatch(
    panel,
    /product-information/,
    'the card panel must not sit inside .product-information, or scoping the rule changes nothing',
  );
});

/*
 * The card panel is the thing the unscoped rule broke, so the guard is worth
 * little without evidence the panel is actually in use. Derived from the
 * templates rather than listed, so a template that adds or drops one counts.
 */
test('the card subscribe panel is live on the storefront', () => {
  const enabled = [];
  const walk = (node, path, file) => {
    for (const [id, child] of Object.entries(node.blocks ?? {})) {
      const here = `${path}.${id}`;
      if (String(child.type).endsWith('subscribe-button') && child.disabled !== true) {
        enabled.push(`${file}:${here}`);
      }
      walk(child, here, file);
    }
  };

  for (const file of readdirSync(join(root, 'templates')).filter((f) => f.endsWith('.json'))) {
    const parsed = JSON.parse(stripBanner(read(`templates/${file}`)));
    for (const [id, section] of Object.entries(parsed.sections ?? {})) walk(section, id, file);
  }

  assert.ok(
    enabled.length >= 5,
    `only ${enabled.length} enabled subscribe-button blocks found; the panel may have been retired, ` +
      'in which case the scoping above is no longer load-bearing',
  );
});
