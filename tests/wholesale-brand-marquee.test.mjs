import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'sections/ona-wholesale-brands.liquid'), 'utf8');

/*
 * Commentary is stripped before anything is matched, and rules are matched by
 * their whole selector at the start of a line.
 *
 * The first version of this file searched the raw stylesheet with indexOf, so
 * `rule('.brand-track__loop')` found that selector inside the explanatory
 * comment above `.brand-track` -- and that comment happens to contain the words
 * "display: contents". Deleting the real rule outright left the suite green:
 * the guard was reading prose it had written itself. Codex caught it on #269.
 *
 * The lesson generalises past this file: a test that searches a document for a
 * string will find the sentence describing the thing just as happily as the
 * thing.
 */
const styles = (source.match(/{% stylesheet %}([\s\S]*?){% endstylesheet %}/)?.[1] ?? '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const rule = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = styles.match(new RegExp(`^\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  assert.ok(match, `missing rule for ${selector}`);
  return match[1];
};

test('the harness reads CSS, not the prose about it', () => {
  assert.ok(!styles.includes('/*'), 'comments must be stripped before any assertion runs');
  assert.ok(
    source.includes('/*'),
    'the section does carry commentary -- which is exactly why stripping it matters',
  );
});

/*
 * The logo row is a marquee: the blocks render once, then again inside
 * `.brand-track__loop`, and the track animates to `translateX(-50%)` so the
 * copy slides in where the original left off.
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
 * halves are identical and the seam is invisible.
 */
test('the brand marquee spaces items by trailing margin, never by gap on the track', () => {
  assert.match(
    source,
    /class="brand-track__loop"/,
    'the duplicated set is what makes this a loop; without it -50% slides to empty space',
  );
  assert.match(
    rule('#MainContent .wholesale-brands .brand-track__loop'),
    /display:\s*contents/,
    'the loop wrapper must stay display:contents, which is why the gap arithmetic breaks',
  );

  assert.doesNotMatch(
    rule('#MainContent .wholesale-brands .brand-track'),
    /(^|[\s;])gap\s*:/,
    'gap on the track leaves 2N-1 gaps across 2N items and reintroduces the half-gap seam; ' +
      'space the items with margin-inline-end instead',
  );

  assert.match(
    rule('#MainContent .wholesale-brands .brand-item'),
    /margin-inline-end\s*:/,
    'each item must carry its own trailing space so half the track is exactly one set',
  );
});

test('the marquee stops for people who ask for reduced motion', () => {
  const block = styles.match(
    /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n  \}/,
  );
  assert.ok(block, 'the reduced-motion media block must exist');
  assert.match(block[1], /animation:\s*none/, 'the scroll must stop, not merely slow');
});
