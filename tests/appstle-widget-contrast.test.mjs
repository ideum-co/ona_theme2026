import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const STYLES = 'snippets/appstle-widget-styles.liquid';

/*
 * Measured on the live product page on 2026-10-26, with "Subscribe and save" selected, by
 * computing each element's own colour against the first non-transparent background above it.
 * Appstle paints its text in this theme's *background* token, cream #F4F3E9, so its text was not
 * faint -- it was invisible. The ONA team reported the subscriber reward tiers as unreadable.
 *
 * These are Appstle's class names, including their spelling of "percentage". The ratios are
 * recorded so the next person re-measures rather than guesses, and so a silent Appstle restyle
 * that reintroduces the problem is at least diffed against a number someone wrote down.
 */
const MEASURED = [
  ['appstle_loyalty_title', 1.0],
  ['appstle_tooltip_title', 1.0],
  ['appstle_widget_title', 1.0],
  ['appstle-loyalty-billing-cycle', 1.11],
  ['appstle-loyalty-table-data', 1.11],
  ['appstle-precentage-loyalty', 1.11],
  ['appstle_link', 2.63],
  ['appstle_subcription_link', 2.63],
];

test('every element measured below AA is addressed', () => {
  const styles = read(STYLES);
  const failing = MEASURED.filter(([, ratio]) => ratio < 4.5).map(([cls]) => cls);

  // Not a spot check: if a name is added to the list above without a rule, this fails.
  const unaddressed = failing.filter((cls) => !styles.includes(`.${cls}`));
  assert.deepEqual(unaddressed, [], 'each class measured below 4.5:1 needs a rule');
});

test('the overrides cannot reach the theme\'s own markup', () => {
  const styles = read(STYLES);
  const block = styles.slice(styles.indexOf('{% stylesheet %}'), styles.indexOf('{% endstylesheet %}'));

  const selectors = block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('.appstle'));

  assert.ok(selectors.length > 0, 'expected selectors targeting the widget');
  const unscoped = selectors.filter((s) => !s.startsWith('.appstle_sub_widget '));
  assert.deepEqual(
    unscoped,
    [],
    'every rule must be scoped to .appstle_sub_widget, the widget root, so it cannot style the theme'
  );
});

test('the duplicate heading is hidden outright rather than left invisible by colour', () => {
  const styles = read(STYLES);
  const rule = styles.match(/\.appstle_sub_widget \.appstle_widget_title \{[^}]*\}/);
  assert.ok(rule, 'Appstle renders its own "Purchase options" heading above the theme\'s');
  assert.match(
    rule[0],
    /display:\s*none/,
    'giving the widget its colour back would surface a second "Purchase options" heading'
  );
  assert.ok(
    !/color:/.test(rule[0]),
    'hiding it by colour is what made the rest of the widget unreadable in the first place'
  );
});

test('the widget styles are rendered, not merely written', () => {
  assert.match(
    read('snippets/purchase-options.liquid'),
    /render 'appstle-widget-styles'/,
    'a snippet nothing renders ships no CSS'
  );
});
