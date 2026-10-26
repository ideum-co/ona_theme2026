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
