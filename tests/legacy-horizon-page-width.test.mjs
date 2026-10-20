import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const sheet = readFileSync(resolve(root, 'assets/legacy-page-layout.css'), 'utf8');
const base = readFileSync(resolve(root, 'assets/base.css'), 'utf8');
const variables = readFileSync(resolve(root, 'snippets/theme-styles-variables.liquid'), 'utf8');
const code = sheet.replace(/\/\*[\s\S]*?\*\//g, ''); // rules only, not the commentary

test('the legacy gutter is Horizon\'s --page-margin, at Horizon\'s breakpoint', () => {
  /*
   * Horizon sets --page-margin to 16px, and 40px from 750px up. Legacy sections
   * are not inside a .page-width-* element, so they never inherit it and the
   * value has to be restated -- but it has to be restated as the SAME numbers,
   * or a legacy section and a Horizon section on one page sit on different
   * left edges. /pages/faq measured left=70 against left=40 before this.
   */
  const horizonSmall = /--page-margin:\s*16px/.test(base);
  const horizonLarge = /min-width:\s*750px[\s\S]{0,400}?--page-margin:\s*40px/.test(base);
  assert.ok(horizonSmall && horizonLarge, 'Horizon\'s own margins changed; re-check what this sheet mirrors');

  assert.match(code, /--legacy-page-gutter:\s*16px/, 'the small-screen gutter must match Horizon\'s 16px');
  assert.match(
    code,
    /min-width:\s*750px\s*\)\s*\{[\s\S]{0,200}?--legacy-page-gutter:\s*40px/,
    'the gutter must step to 40px at Horizon\'s 750px breakpoint',
  );
});

test('the legacy pages have exactly one measure', () => {
  /*
   * The container rule and five others each carried their own literal 1280px.
   * Widening one and not the rest gives a page two competing measures, which
   * reads as sections that nearly line up -- worse than an obvious break.
   * Every capped width must come from the shared variable.
   */
  const capped = [...code.matchAll(/width:\s*min\(\s*100% - 2 \* var\(--legacy-page-gutter\)\s*,\s*([^)]+)\)/g)]
    .map((m) => m[1].trim());
  assert.ok(capped.length >= 4, 'expected several page-width rules to check');

  const literals = capped.filter((c) => !c.includes('--legacy-page-measure'));
  assert.deepEqual(literals, [], `these cap the width with a literal instead of --legacy-page-measure: ${literals.join(', ')}`);
});

test('the measure references Horizon\'s token rather than copying its value', () => {
  /*
   * --page-margin is only declared on .page-width-* elements, so legacy markup
   * cannot inherit it and its values have to be restated. --narrow-page-width
   * is different: it is on :root in snippets/theme-styles-variables.liquid, so
   * it is in scope everywhere and must be referenced. Copying `90rem` would
   * leave these pages on the old measure the first time a theme update moved
   * the token -- silently, and defeating the alignment this sheet exists for.
   */
  assert.match(
    variables,
    /:root\s*\{[\s\S]*?--narrow-page-width:/,
    'the token is no longer global; if it moved, the measure cannot reference it',
  );
  assert.match(
    code,
    /--legacy-page-measure:\s*var\(--narrow-page-width/,
    'reference the Horizon token, do not copy its value',
  );
});

test('the sheet uses Horizon\'s breakpoints and no bootstrap ones', () => {
  /*
   * Only the media query preludes. The first draft of this test scanned the
   * whole sheet for `max-width: <n>px` and so counted ordinary declarations --
   * the 100px cap on the play-button overlay, the 420px portrait cap -- as if
   * they were breakpoints, and failed on code that was already correct.
   */
  const preludes = [...code.matchAll(/@media([^{]+)\{/g)].map((m) => m[1]);
  const bad = preludes
    .flatMap((q) => [...q.matchAll(/(?:max|min)-width:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])))
    .filter((px) => ![749, 750, 989, 990].includes(px));
  /*
   * Scoped to THIS sheet on purpose. Horizon's own base.css does use other
   * widths -- `max-width: 1200px` eight times and one `min-width: 1400px` --
   * so this is not a theme-wide law. It is a rule for the legacy page layout,
   * where an invented boundary only misbehaves in the band between Horizon's
   * two real breakpoints.
   */
  assert.deepEqual([...new Set(bad)], [], 'the legacy sheet sticks to 749/750 and 989/990');
});
