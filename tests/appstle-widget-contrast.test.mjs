import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const snippet = read('snippets/appstle-widget-styles.liquid');
const css = snippet.split('{% stylesheet %}')[1]?.split('{% endstylesheet %}')[0];

test('the Appstle styles load through the theme stylesheet collector', () => {
  assert.ok(css);
  assert.match(read('snippets/purchase-options.liquid'), /render 'appstle-widget-styles'/);
});

test('the widget paints the product section colour pair instead of the root page pair', () => {
  assert.doesNotMatch(css, /:root\s*\{/);
  assert.match(css, /\.product-information \.appstle_sub_widget\s*\{[^}]*--ona-widget-surface:\s*var\(--color-background,\s*#f4f3e9\)/);
  assert.match(css, /\.product-information \.appstle_sub_widget\s*\{[^}]*--ona-widget-ink:\s*var\(--color-foreground,\s*#470a12\)/);
  assert.match(css, /background-color:\s*var\(--ona-widget-surface\)\s*!important/);
  assert.match(css, /color:\s*var\(--ona-widget-ink\)\s*!important/);
});

test('Appstle text, prices, and selection controls remain readable on dark product colours', () => {
  for (const name of [
    'appstle_loyalty_text',
    'appstle_loyalty_title',
    'appstle_tooltip_title',
    'appstle-loyalty-table-data',
    'appstle-loyalty-billing-cycle',
    'appstle-precentage-loyalty',
    'appstle_one_time_text',
    'appstle_subscribe_save_text',
    'appstle_subscription_amount',
    'appstle_subscription_compare_amount',
    'appstle_select_label',
    'appstle_dot',
  ]) {
    assert.ok(css.includes(`.${name}`), `${name} needs the product colour pair`);
  }
  const selectors = css.split('}').map((rule) => rule.split('{')[0]).flatMap((head) => head.split(',')).map((selector) => selector.trim()).filter(Boolean);
  assert.ok(selectors.every((selector) => selector.startsWith('.product-information .appstle_sub_widget')));
});

test('badges and links invert both colours together', () => {
  const inverted = css.match(/\.appstle-save-badge,[\s\S]*?\{([^}]*)\}/)?.[1];
  assert.ok(inverted);
  assert.match(inverted, /background-color:\s*var\(--ona-widget-ink\)\s*!important/);
  assert.match(inverted, /color:\s*var\(--ona-widget-surface\)\s*!important/);
  assert.match(css, /\.appstle_tooltip_appstle\s*\{[^}]*background-color:\s*transparent\s*!important/);
});

test('Appstle cannot override any colour drawn from the product pair', () => {
  // Its stylesheet is injected after the theme bundle. A declaration without !important can
  // look correct in source while losing to the runtime stylesheet on the storefront.
  const declarations = [...css.matchAll(/(?:background-color|border-color|color)\s*:\s*var\(--ona-widget-(?:surface|ink)\)([^;]*);/g)];
  assert.ok(declarations.length >= 10, 'the scan must cover the widget, controls and badge');
  assert.deepEqual(
    declarations.filter((match) => !/!important/.test(match[1])).map((match) => match[0]),
    [],
    'each widget colour must win over Appstle’s later CSS'
  );
});

test('the stylesheet render stays at the purchase-options body level', () => {
  const caller = read('snippets/purchase-options.liquid');
  const renderTag = /\{%-?\s*render 'appstle-widget-styles'\s*-?%\}/g;
  const matches = [...caller.matchAll(renderTag)];
  assert.equal(matches.length, 1, 'render the widget stylesheet exactly once');

  const before = caller.slice(0, matches[0].index);
  const opened = (before.match(/\{%-?\s*(?:if|unless|case)\s/g) ?? []).length;
  const closed = (before.match(/\{%-?\s*(?:endif|endunless|endcase)\s*-?%\}/g) ?? []).length;
  assert.equal(opened - closed, 1, 'the product/plan guard is the only condition around the render');
});

test('fallback colours track the configured store palette', () => {
  const settings = JSON.parse(read('config/settings_data.json').replace(/^\s*\/\*[\s\S]*?\*\//, ''));
  const palette = settings.current.color_palette;
  assert.ok(palette.background && palette.foreground);
  assert.match(css, new RegExp(`--ona-widget-surface:\\s*var\\(--color-background,\\s*${palette.background}\\)`, 'i'));
  assert.match(css, new RegExp(`--ona-widget-ink:\\s*var\\(--color-foreground,\\s*${palette.foreground}\\)`, 'i'));
});
