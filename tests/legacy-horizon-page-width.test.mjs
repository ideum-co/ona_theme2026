import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const sheet = read('assets/legacy-page-layout.css');
const base = read('assets/base.css');
const variables = read('snippets/theme-styles-variables.liquid');
const layout = read('layout/theme.liquid');
const code = sheet.replace(/\/\*[\s\S]*?\*\//g, ''); // rules only, not the commentary

test('the gutter and measure reference Horizon values rather than restating them', () => {
  /*
   * layout/theme.liquid renders <body class="page-width-{{ settings.page_width }}">,
   * and assets/base.css hangs --page-margin and --page-content-width off those
   * classes. Custom properties inherit, so legacy markup already carries
   * Horizon's live values. Measured on /pages/faq: #MainContent and the legacy
   * .container both resolve --page-margin to 40px and --page-content-width to
   * 90rem.
   *
   * The first pass restated 16px/40px and pinned the measure to
   * --narrow-page-width, believing legacy markup sat outside the .page-width-*
   * element. It does not -- that class is on <body>. Restating duplicated
   * Horizon's 750px breakpoint, and pinning to `narrow` would have stopped
   * matching the moment settings.page_width moved to normal or wide.
   */
  assert.match(
    layout,
    /<body class="page-width-\{\{\s*settings\.page_width/,
    'the body class is what makes the inheritance work; if it goes, so does this approach',
  );
  assert.match(base, /--page-margin:\s*16px/, 'Horizon\'s own margin changed; re-check what this sheet references');
  assert.match(
    variables,
    /:root\s*\{[\s\S]*?--narrow-page-width:/,
    'the fallback token is no longer global',
  );

  assert.match(code, /--legacy-page-gutter:\s*var\(--page-margin/, 'the gutter must reference Horizon\'s --page-margin');
  assert.match(
    code,
    /--legacy-page-measure:\s*var\(--page-content-width/,
    'the measure must follow whichever page width the theme is set to',
  );

  /*
   * And must not re-declare the gutter inside a media query. Horizon already
   * steps --page-margin at 750px; stepping it again here is the duplication
   * that drifts.
   */
  assert.doesNotMatch(
    code,
    /@media[^{]*\{[^}]*--legacy-page-gutter:/,
    'Horizon already steps --page-margin at 750px; do not step it again here',
  );
});

test('the legacy pages have exactly one measure', () => {
  /*
   * The container rule and five others each carried their own literal 1280px.
   * Widening one and not the rest gives a page two competing measures, which
   * reads as sections that nearly line up -- worse than an obvious break.
   */
  const capped = [...code.matchAll(/width:\s*min\(\s*100% - 2 \* var\(--legacy-page-gutter\)\s*,\s*([^;]+)\)\s*;/g)]
    .map((m) => m[1].trim());
  assert.ok(capped.length >= 4, `expected several page-width rules to check, found ${capped.length}`);

  const literals = capped.filter((c) => !c.includes('--legacy-page-measure'));
  assert.deepEqual(literals, [], `these cap the width with a literal instead of --legacy-page-measure: ${literals.join(', ')}`);
});

test('the sheet uses Horizon breakpoints and no bootstrap ones', () => {
  /*
   * Only the media query preludes. An earlier draft scanned the whole sheet for
   * `max-width: <n>px` and so counted ordinary declarations -- the 100px cap on
   * the play-button overlay, the 420px portrait cap -- as breakpoints, and
   * failed against code that was already correct.
   *
   * Scoped to THIS sheet on purpose. Horizon's own base.css uses other widths
   * -- `max-width: 1200px` eight times and one `min-width: 1400px` -- so this
   * is a rule for the legacy page layout, not a theme-wide law.
   */
  const preludes = [...code.matchAll(/@media([^{]+)\{/g)].map((m) => m[1]);
  const bad = preludes
    .flatMap((q) => [...q.matchAll(/(?:max|min)-width:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])))
    .filter((px) => ![749, 750, 989, 990].includes(px));
  assert.deepEqual([...new Set(bad)], [], 'the legacy sheet sticks to 749/750 and 989/990');
});
