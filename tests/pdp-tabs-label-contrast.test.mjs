import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tabs = readFileSync(join(root, 'sections/product-tabs.liquid'), 'utf8');
const template = readFileSync(join(root, 'templates/product.json'), 'utf8');

/*
 * product-tabs paints itself with a per-product background. The text colour that has to sit on
 * that background was, for a long time, a single stored value, so a light coffee and a cream
 * label were paired by whoever happened to fill the metafield. Every other coloured surface in
 * the theme avoids this by rendering snippets/contrast-override.liquid; this section was the one
 * that did not, and an earlier fix answered that by copying the snippet's rule inline.
 *
 * It no longer does: the section renders the snippet. These tests guard that delegation, because
 * the inline copy is the thing that can silently drift from the original.
 */
test('the section delegates contrast to the theme-wide system instead of re-deriving it', () => {
  assert.match(
    tabs,
    /\{%-?\s*render\s+'contrast-override'/,
    'product-tabs no longer renders the shared contrast system as a tag'
  );
  for (const filter of ['color_contrast', 'color_brightness']) {
    assert.doesNotMatch(
      tabs,
      new RegExp(`\\|\\s*${filter}`),
      `product-tabs measures contrast itself again -- a second copy of the rule is how the two surfaces drift apart`
    );
  }
});

/*
 * The snippet writes its tokens under .color-custom-<section_id>. Passing the id but leaving the
 * class off the element is the failure that looks like nothing happening at all: the stylesheet
 * is emitted correctly and matches no element on the page.
 */
test('the snippet is scoped to the element it is meant to colour', () => {
  assert.match(tabs, /section_id:\s*section\.id/, 'the snippet is rendered without a scope id');
  const openingTag = tabs.slice(tabs.indexOf('<product-tabs-component'), tabs.indexOf('style="'));
  assert.match(
    openingTag,
    /class="[^"]*color-custom-\{\{\s*section\.id\s*\}\}/,
    'the component does not carry the class the snippet scopes its tokens to'
  );
});

/*
 * "Explicit text_color wins" is the snippet's first precedence rule, and the section's own text
 * setting would satisfy it -- one stored colour against 37 product backgrounds, which is the
 * original defect handed straight back. Only a colour chosen for this one product may count.
 */
test('only a per-product text colour counts as an explicit choice', () => {
  assert.match(
    tabs,
    /text_color:\s*explicit_text_color/,
    'the snippet is handed something other than the per-product colour'
  );
  const productBranch = tabs.slice(tabs.indexOf("if settings.color_source == 'product'"));
  const reset = productBranch.indexOf("assign explicit_text_color = ''");
  const lookup = productBranch.indexOf('[text_key]');
  assert.ok(reset !== -1, "the section's own text colour is still passed through as explicit");
  assert.ok(
    reset < lookup && lookup !== -1,
    'the per-product lookup must come after the reset, or it is discarded'
  );
});

/*
 * A custom property may hold an empty value, so `--product-tabs-background: ;` was accepted and
 * then quietly invalidated the `background` that read it. That is how ~54 products -- everything
 * without a colour metafield -- ended up with cream text on the cream page: measured at 1.01
 * against the page on /products/hario-v60-dripper-clear-plastic.
 */
test('a product with no colour emits no background rather than an empty one', () => {
  const style = tabs.slice(tabs.indexOf('style="'), tabs.indexOf('{{ section.shopify_attributes }}'));
  const declaration = style.indexOf('--product-tabs-background:');
  const guard = style.indexOf('if background_color != blank');
  assert.ok(guard !== -1 && guard < declaration, 'the background is emitted without checking it exists');
  assert.match(
    tabs,
    /var\(--product-tabs-background,\s*transparent\)/,
    'the background has no fallback, so an undefined value invalidates the declaration'
  );
  assert.doesNotMatch(
    tabs,
    /--product-tabs-color/,
    'a colour custom property nothing defines would read as a second source of truth'
  );
});

/*
 * The section can only colour what it is allowed to reach. A block that sets its own text colour
 * writes `--color` inline, and an inline custom property beats the snippet's stylesheet rule --
 * so three panel blocks storing the cream palette value kept the panels unreadable even after the
 * tab strip was fixed. Walked rather than listed by id: the next block added to a panel is
 * exactly the one a hard-coded list would miss.
 */
test('no block inside the live tabs section hard-codes its text colour', () => {
  const sections = JSON.parse(template.replace(/^\s*\/\*.*?\*\/\s*/s, '')).sections;
  const live = Object.entries(sections).filter(
    ([, section]) => section.type === 'product-tabs' && !section.disabled
  );
  assert.equal(live.length, 1, 'expected exactly one enabled product-tabs section on the product template');

  const offenders = [];
  const walk = (node, path) => {
    for (const [id, block] of Object.entries(node.blocks ?? {})) {
      const value = block.settings?.text_color;
      if (value) offenders.push(`${path}/${id} (${block.type}) = ${value}`);
      walk(block, `${path}/${id}`);
    }
  };
  walk(live[0][1], live[0][0]);
  assert.deepEqual(
    offenders,
    [],
    `these blocks override the contrasted colour with a stored one:\n  ${offenders.join('\n  ')}`
  );
});
