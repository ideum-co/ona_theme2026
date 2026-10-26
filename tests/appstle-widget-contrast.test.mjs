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

const cssOf = (file) => {
  const open = file.indexOf('{% stylesheet %}');
  const close = file.indexOf('{% endstylesheet %}');
  return open >= 0 && close > open ? file.slice(open + '{% stylesheet %}'.length, close) : null;
};

test('the CSS is inside a stylesheet tag, not emitted as text into the page', () => {
  assert.ok(cssOf(read(SNIPPET)), `${SNIPPET} must wrap its rules in {% stylesheet %}`);
});

test('the pair is captured at :root, which is the whole reason this works anywhere', () => {
  const css = cssOf(read(SNIPPET));

  // Declared anywhere below :root these resolve against whatever that section set, and inside
  // product-information the tokens are inverted to a pair measuring 3.64. The capture is the fix.
  assert.match(
    css,
    /:root\s*\{[\s\S]*?--ona-panel-surface:\s*var\(--color-background,\s*#[0-9a-fA-F]{3,8}\);/,
    'the surface must be captured at :root, with a literal fallback'
  );
  assert.match(
    css,
    /:root\s*\{[\s\S]*?--ona-panel-ink:\s*var\(--color-foreground,\s*#[0-9a-fA-F]{3,8}\);/,
    [
      'the ink must be captured at :root, with a literal fallback. Without the fallback, moving',
      'these tokens onto a scheme class makes the var() invalid at computed-value time: both',
      'properties resolve to unset and the widget returns to cream on cream with no error.',
    ].join(' ')
  );

  // Declared twice, the second one re-resolves the pair wherever it sits -- inside the inverted
  // section, that is the exact state this snippet exists to escape.
  for (const prop of ['--ona-panel-surface', '--ona-panel-ink']) {
    const declarations = css.match(new RegExp(`${prop}\\s*:`, 'g')) ?? [];
    assert.equal(
      declarations.length,
      1,
      `${prop} must be declared exactly once. A second declaration lower down re-resolves it\n` +
        'against whatever scheme is in force there, which is what the capture is avoiding.'
    );
  }

  // Wrapped in an at-rule the capture simply does not apply on screen. Comments are stripped
  // first: the prose above the rule says ":root" too, and matching that instead put the whole
  // check before any at-rule could appear, which is how @media print slipped past it.
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const beforeRoot = bare.slice(0, bare.indexOf(':root'));
  assert.ok(bare.includes(':root'), 'the capture rule itself must survive comment stripping');
  assert.equal(
    (beforeRoot.match(/@[a-z-]+[^;{]*\{/g) ?? []).length,
    (beforeRoot.match(/\}/g) ?? []).length,
    'the :root capture must not sit inside an at-rule; wrapped in @media it never applies'
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
  const css = cssOf(read(SNIPPET));
  for (const cls of MEASURED) {
    assert.ok(css.includes(`.${cls}`), `${cls} measured below AA and needs a rule`);
  }

  // Every selector, including the one that ends each list and therefore carries the brace. The
  // previous version only matched selectors ending in a comma, so the last of each group could
  // escape the widget scope unnoticed.
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = withoutComments
    .split('}')
    .map((chunk) => chunk.slice(0, chunk.indexOf('{')))
    .filter((head) => head.includes('.appstle'))
    .flatMap((head) => head.split(','))
    .map((sel) => sel.trim())
    .filter(Boolean);

  assert.ok(selectors.length >= 7, 'the scan should be finding the widget selectors');
  const escaped = selectors.filter((sel) => !sel.startsWith('.appstle_sub_widget'));
  assert.deepEqual(escaped, [], 'every rule touching Appstle must stay scoped inside .appstle_sub_widget');
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
  const css = cssOf(read(SNIPPET));

  // Indentation-agnostic: every colour declaration spending one of the captured properties has
  // to carry !important. Appstle's stylesheet is injected at runtime by the app embed, so it
  // lands after the theme bundle and takes equal-specificity ties.
  const spends = [...css.matchAll(/(background-color|color)\s*:\s*var\(--ona-panel-[a-z]+\)([^;]*);/g)];
  assert.ok(spends.length >= 5, 'the snippet should still be spending the captured pair');

  const weak = spends.filter((m) => !/!important/.test(m[2])).map((m) => m[0]);
  assert.deepEqual(weak, [], 'these declarations would lose to Appstle at runtime');
});

test('the styles are actually rendered, and not behind a condition', () => {
  const caller = read(CALLER);
  const render = caller.search(/\{%-?\s*render 'appstle-widget-styles'\s*-?%\}/);
  assert.ok(render > 0, 'a stylesheet nothing renders is a stylesheet that does nothing');

  // Count the conditional tags still open where the render sits. The snippet body already runs
  // inside one `unless`, so that is the baseline; anything more is a new gate on the fix.
  const before = caller.slice(0, render);
  const opened = (before.match(/\{%-?\s*(if|unless|case)\s/g) ?? []).length;
  const closed = (before.match(/\{%-?\s*(endif|endunless|endcase)\s*-?%\}/g) ?? []).length;
  assert.equal(
    opened - closed,
    1,
    'the render should sit at the snippet body level; wrapping it in a condition silently\n' +
      'disables the contrast fix while every other assertion here still passes'
  );
});

test('the fallback literals are the palette they claim to mirror', () => {
  const css = cssOf(read(SNIPPET));
  const raw = read('config/settings_data.json').replace(/^\s*\/\*[\s\S]*?\*\//, '');
  const palette = JSON.parse(raw).current?.color_palette ?? {};

  assert.ok(palette.foreground && palette.background, 'settings_data should still carry a palette');

  // A fallback that is merely "some hex" is not a fallback, it is a second, silent source of
  // truth. These only ever apply in the scenario they exist for, so a drifted value would never
  // be seen until it mattered.
  assert.match(
    css,
    new RegExp(`--ona-panel-ink:\\s*var\\(--color-foreground,\\s*${palette.foreground}\\)`, 'i'),
    `the ink fallback must be the palette foreground (${palette.foreground})`
  );
  assert.match(
    css,
    new RegExp(`--ona-panel-surface:\\s*var\\(--color-background,\\s*${palette.background}\\)`, 'i'),
    `the surface fallback must be the palette background (${palette.background})`
  );
});
