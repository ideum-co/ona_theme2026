import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'sections/ona-wholesale-brands.liquid'), 'utf8');
const styles = source.match(/{% stylesheet %}([\s\S]*?){% endstylesheet %}/)?.[1] ?? '';
const rule = (selector) => {
  const i = styles.indexOf(selector);
  assert.notEqual(i, -1, `missing rule for ${selector}`);
  return styles.slice(i, styles.indexOf('}', i));
};

/*
 * The logo row is a marquee: the blocks are rendered once, then a second time
 * inside `.brand-track__loop`, and the track is animated to `translateX(-50%)`
 * so the copy slides in exactly where the original left.
 *
 * That arithmetic only holds if half the track is exactly one set. Because the
 * loop wrapper is `display: contents`, its children ARE direct flex children of
 * the track -- 2N items. Spacing them with `gap` puts 2N-1 gaps in the track,
 * so -50% moves N*item + (N-0.5)*gap while the real stride from one set to the
 * next is N*item + N*gap. The row snapped back half a gap every cycle.
 *
 * Measured on the live page before the fix: gap 61.44px, track width 553px,
 * -50% = 276px against an actual stride of 307px -- a 31px jump every 26s.
 *
 * A trailing margin on each item makes every item occupy item+gap, so the two
 * halves are identical and the seam is invisible. These assertions hold that
 * shape: the moment someone "tidies" the margin back into a `gap`, the seam
 * returns silently, because nothing about it throws.
 */
test('the brand marquee spaces items by trailing margin, never by gap on the track', () => {
  assert.match(
    source,
    /class="brand-track__loop"/,
    'the duplicated set is what makes this a loop; without it -50% slides to empty space',
  );
  assert.match(
    rule('.brand-track__loop'),
    /display:\s*contents/,
    'the loop wrapper must stay display:contents, which is why the gap arithmetic breaks',
  );

  const track = rule('#MainContent .wholesale-brands .brand-track {');
  assert.doesNotMatch(
    track,
    /(^|[\s;{])gap\s*:/,
    'gap on the track leaves 2N-1 gaps across 2N items and reintroduces the half-gap seam; ' +
      'space the items with margin-inline-end instead',
  );

  assert.match(
    rule('#MainContent .wholesale-brands .brand-item {'),
    /margin-inline-end\s*:/,
    'each item must carry its own trailing space so half the track is exactly one set',
  );

  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation:\s*none/,
    'the marquee must stop for people who ask for reduced motion',
  );
});
