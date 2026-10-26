import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const SNIPPET = 'snippets/appstle-widget-styles.liquid';
const CALLER = 'snippets/purchase-options.liquid';

/*
 * Measured on the live product page on 2026-10-26, each element's own colour against the first
 * painted background above it. The first attempt at this fix asserted only that a rule existed
 * for every failing class -- which was true, and meaningless, because none of the rules won. One
 * of them made contrast worse. So these assert the mechanism that was measured to work, not the
 * presence of a declaration.
 *
 *   element                          before   after
 *   appstle_loyalty_title              1.00   14.27
 *   appstle_tooltip_title              1.00   14.27
 *   appstle-loyalty-table-data         1.11   14.27
 *   appstle-loyalty-billing-cycle      1.11   14.27
 *   appstle-precentage-loyalty         1.11   14.27
 *   appstle_link                       2.63   14.27
 *   appstle_subcription_link           2.63   14.27
 *
 * 14.27 is the ratio the add to cart button and the prices on that page already achieve.
 * Appstle's own class spelling is kept as shipped, misspelling included.
 */
const MEASURED = [
  'appstle_loyalty_title',
  'appstle_tooltip_title',
  'appstle-loyalty-table-data',
  'appstle-loyalty-billing-cycle',
  'appstle-precentage-loyalty',
  'appstle_link',
  'appstle_subcription_link',
];

test('the pair is captured at :root, which is the whole reason this works anywhere', () => {
  const css = read(SNIPPET);
  assert.match(
    css,
    /:root\s*\{[^}]*--ona-panel-surface:\s*var\(--color-background\);[^}]*--ona-panel-ink:\s*var\(--color-foreground\);[^}]*\}/,
    [
      'Declared anywhere below :root these resolve against whatever that section set, and inside',
      'product-information those tokens are inverted to a cream-on-tan pair measuring 3.64. The',
      'capture is what keeps the page pair, so it is the thing to guard.',
    ].join(' ')
  );

  const rootBlock = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
  assert.ok(
    !/\.appstle/.test(rootBlock),
    'the capture must stay on :root itself, not be scoped to the widget'
  );
});

test('the widget paints its own surface, so no page ground can swallow it', () => {
  const css = read(SNIPPET);
  const surface = css.match(/\.appstle_sub_widget,[\s\S]*?\{([\s\S]*?)\}/);
  assert.ok(surface, 'the widget should still have a surface rule');
  assert.match(
    surface[1],
    /background-color:\s*var\(--ona-panel-surface\)\s*!important/,
    'without painting a background the text keeps landing on the page cream at 1.00'
  );
  assert.match(surface[1], /color:\s*var\(--ona-panel-ink\)\s*!important/, 'and the ink has to come with it');
  assert.match(
    css,
    /\.appstle_sub_widget \.appstle_loyalty_text/,
    'appstle_loyalty_text paints itself white, so the surface rule has to name it too or the\nreward rows stay at 1.11 inside an otherwise fixed widget'
  );
});

test('every class that was measured failing is addressed, and inside the widget', () => {
  const css = read(SNIPPET);
  for (const cls of MEASURED) {
    assert.ok(css.includes(`.${cls}`), `${cls} measured below AA and needs a rule`);
  }

  const selectors = [...css.matchAll(/^\s*(\.[a-zA-Z_][\w-]*(?:\s+\.[\w-]+)*),?$/gm)].map((m) => m[1].trim());
  const escaped = selectors.filter((s) => s.startsWith('.') && !s.startsWith('.appstle_sub_widget'));
  assert.deepEqual(escaped, [], 'every rule must stay scoped inside .appstle_sub_widget');
});

test('the pills invert the pair rather than tinting one half of it', () => {
  const css = read(SNIPPET);
  const pill = css.match(/\.appstle_sub_widget \.appstle_link,[\s\S]*?\{([\s\S]*?)\}/);
  assert.ok(pill, 'the links should still be styled');
  assert.match(pill[1], /background-color:\s*var\(--ona-panel-ink\)\s*!important/, 'ink ground');
  assert.match(pill[1], /color:\s*var\(--ona-panel-surface\)\s*!important/, [
    'and surface text. Repainting only the ground while the text keeps Appstle white is what took',
    'these two from 2.63 to 1.11 in the first attempt -- a contrast fix that made contrast worse.',
  ].join(' '));

  assert.match(
    css,
    /\.appstle_tooltip_appstle\s*\{[^}]*background-color:\s*transparent\s*!important/,
    "Appstle's brand-blue strip sits behind the pills and belongs to no scheme here"
  );
});

test('!important is kept, because Appstle injects its CSS after the theme bundle', () => {
  const css = read(SNIPPET);
  const decls = [...css.matchAll(/^\s{4}(background-color|color):\s*var\(--ona-panel-[a-z]+\);?$/gm)];
  assert.deepEqual(
    decls.map((d) => d[0].trim()),
    [],
    [
      'a colour declaration on the widget without !important loses: the app embed injects its',
      'stylesheet at runtime, so it is later in document order and wins at equal specificity.',
      'Verified live -- the first attempt lost even with !important absent and the same selectors.',
    ].join(' ')
  );
});

test('the styles are actually rendered', () => {
  assert.match(
    read(CALLER),
    /\{%-?\s*render 'appstle-widget-styles'\s*-?%\}/,
    'a stylesheet nothing renders is a stylesheet that does nothing'
  );
});
