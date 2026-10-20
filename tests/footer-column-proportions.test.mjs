import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const section = read('sections/footer.liquid');
const group = JSON.parse(read('sections/footer-group.json').replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));

/*
 * The footer's four columns were equal -- `repeat(4, 1fr)`, 330px each at a
 * 1854px viewport. The design gives them very different weights: measured off
 * the reference at a 1739px frame, the rules under each heading run 142, 139,
 * 557 and 405px, so roughly 1 : 1 : 4 : 2.9.
 *
 * The visible cost of equal columns was the acknowledgement of country, which
 * wrapped to seven lines in a 330px column against five in the design, while
 * the two short link lists sat on wide empty gutters.
 */

test('the footer names its own column weights', () => {
  const ratios = group.sections.footer.settings.column_ratios;
  assert.ok(ratios, 'an empty value falls back to equal columns, which is what this fixes');

  const tracks = ratios.trim().split(/\s+/);
  assert.equal(tracks.length, 4, `four columns, four tracks -- got ${tracks.length}`);

  /*
   * The third column -- acknowledgement of country -- is the paragraph, and the
   * whole point is that it is the widest. Asserting the shape rather than the
   * exact string leaves room to tune without rewriting the test.
   */
  const weights = tracks.map((t) => parseFloat(t));
  assert.ok(weights.every((w) => Number.isFinite(w) && w > 0), `every track needs a weight: ${ratios}`);
  const widest = weights.indexOf(Math.max(...weights));
  assert.equal(widest, 2, 'the acknowledgement column must be the widest');
  assert.ok(weights[3] > weights[0], 'the signup column needs more room than a link list');
  assert.ok(weights[2] > weights[0] * 2, 'and the paragraph needs materially more than a link list');
});

test('the stylesheet still honours the setting', () => {
  /*
   * The hook already existed; it was the value that was missing. If this
   * fallback is ever removed the setting silently stops working.
   */
  assert.match(
    section,
    /grid-template-columns: var\(--footer-column-ratios, repeat\(var\(--grid-columns\), 1fr\)\)/,
    'the desktop grid must read the variable',
  );
  assert.match(
    section,
    /--footer-column-ratios: \{\{ section\.settings\.column_ratios \}\}/,
    'and the section must set it from the setting',
  );
});

test('the weights apply only at desktop', () => {
  /*
   * Below 990px the columns stack or go to two-up; forcing a 1:1:4:3 grid there
   * would squeeze the link lists to nothing.
   */
  const desktop = section.slice(section.indexOf('@media screen and (min-width: 990px)'));
  assert.match(desktop, /--footer-column-ratios/, 'the ratios belong in the desktop block');
});
