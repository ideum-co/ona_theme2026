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
