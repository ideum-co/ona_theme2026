import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

/*
 * Browsers impose their own UA font on <button>, <input>, <select> and
 * <textarea>; those elements do not inherit font-family from their parent. A
 * control the theme styles without saying anything about type therefore renders
 * in Arial, in the middle of a page set in Karla.
 *
 * That is what happened to .variant-select__trigger: measured on the deployed
 * theme on 2026-10-19, every variant dropdown on a product card showed its
 * selected value in Arial 13.333px -- 8 on the home page, more on every
 * collection and search page. The PDP uses a different control and was fine,
 * which is exactly why nobody noticed.
 */
test('the variant dropdown trigger sets its own type', () => {
  const styles = read('snippets/variant-select-styles.liquid');
  const rule = styles.match(/\.variant-select__trigger\s*\{([^}]*)\}/);
  assert.ok(rule, 'the trigger must be styled');
  assert.match(
    rule[1],
    /font-family:\s*inherit/,
    'a <button> takes the UA font unless told otherwise, so the family must be inherited',
  );
  assert.match(rule[1], /font-size:\s*inherit/, 'the trigger must not keep the UA button size');
});

test('the locations view toggle sets its own type', () => {
  /*
   * Same cause, found in the same sweep: the List/Map toggle is a bare
   * <button>, so it rendered in Arial 13.333px on /pages/locations while the
   * rest of the page was Karla. The rule already said `color: inherit` and
   * stopped there, which is what made it easy to miss.
   */
  const section = read('sections/locations-store-finder.liquid');
  const rule = section.match(/\.locations-store-finder__view-toggle button\s*\{([^}]*)\}/);
  assert.ok(rule, 'the view toggle must be styled');
  assert.match(rule[1], /font-family:\s*inherit/, 'the toggle must not take the UA button font');
  assert.match(rule[1], /font-size:\s*inherit/, 'the toggle must not keep the UA button size');
});

test('every button in a ported section states its own font', () => {
  /*
   * The two tests above name one control each. That is the shape of guard
   * that only protects what someone remembered to list -- and it duly failed
   * to notice `.slider-handle`, a <button> added to ona-unique-coffees.liquid
   * long after they were written.
   *
   * So: find every <button> that carries a class in the ported sections, and
   * require a rule somewhere that gives it a font. Browsers impose the UA font
   * on <button> -- on /pages/locations that meant Arial 13.333px in the middle
   * of a Karla page -- and `font: inherit` or `font-family: inherit` is the
   * only thing that stops it.
   */
  const sources = [
    ...readdirSync(resolve(root, 'sections')).filter((f) => f.endsWith('.liquid')).map((f) => `sections/${f}`),
  ];
  const css = [
    read('assets/legacy-page-layout.css'),
    read('assets/base.css'),
  ].join('\n');

  const unstyled = [];
  for (const file of sources) {
    const source = read(file);
    const inlineStyles = [...source.matchAll(/\{%\s*(?:stylesheet|style)\s*%\}([\s\S]*?)\{%\s*end(?:stylesheet|style)\s*%\}/g)]
      .map((m) => m[1])
      .join('\n');
    const all = `${css}\n${inlineStyles}`;

    for (const tag of source.match(/<button[^>]*>/g) ?? []) {
      let classes = tag.match(/class="([^"]*)"/)?.[1];
      if (!classes) continue;
      // Strip Liquid before splitting: a conditional modifier like
      // `class="slider-handle{% if forloop.first %} is-active{% endif %}"`
      // otherwise yields a "class name" of `slider-handle{%`.
      classes = classes.replace(/\{%[\s\S]*?%\}/g, ' ').replace(/\{\{[\s\S]*?\}\}/g, ' ');
      if (!classes.trim()) continue;
      // A class that is purely Horizon's own `button` component is already styled.
      const names = classes.split(/\s+/).filter(Boolean).filter((c) => !c.startsWith('{'));
      if (names.includes('button')) continue;

      const styled = names.some((name) => {
        const rule = new RegExp(`\\.${name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b[^{}]*\\{([^}]*)\\}`, 'g');
        /*
         * Any font declaration, not only `inherit`: product-tabs__tab is
         * deliberately Silk Serif 44px, which is a choice rather than the UA
         * default leaking through. But a FAMILY is required, not just a size:
         * .coffee-quiz__next declares a font-size and still renders Arial 14px,
         * because size alone does not displace the UA family. That is how
         * .locations-store-finder__reset-button ended up Arial 13.333px in the
         * middle of a Karla page.
         */
        return [...all.matchAll(rule)].some((m) => /font-family\s*:|font\s*:/.test(m[1]));
      });
      if (!styled) unstyled.push(`${file}: .${names.join('.')}`);
    }
  }

  /*
   * coffee-quiz is Victor's section (#196, #206), so these are recorded rather
   * than changed from here -- confirmed real against the live DOM, not a
   * false positive: .coffee-quiz__close renders Arial 13.333px and
   * .coffee-quiz__next Arial 14px on a Karla page. Handed to him rather than
   * edited, per the lane split.
   */
  const KNOWN_OUTSIDE_MY_LANE = [
    'sections/coffee-quiz.liquid: .coffee-quiz__action',
    'sections/coffee-quiz.liquid: .coffee-quiz__close',
    'sections/coffee-quiz.liquid: .coffee-quiz__next',
  ];
  assert.deepEqual(
    unstyled.sort(),
    KNOWN_OUTSIDE_MY_LANE,
    `these buttons will render in the UA font:\n${unstyled.join('\n')}`,
  );
});
