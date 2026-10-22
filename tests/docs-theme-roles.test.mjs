import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

/*
 * Which theme is published has changed three times, and the docs did not follow it. On
 * 2026-10-22 about fifteen files still called `160815546559` the live store -- true when each
 * was written, and false since the go-live put `154676789439` (`ona_theme2026/main`) back on
 * MAIN. Taken at face value they point a comparison at an unpublished preview, so the live
 * site reads as the healthy side of a diff. An automated reviewer did exactly that on #247 and
 * concluded docs/component-kit.md had the two themes backwards.
 *
 * The fix is not to purge the old id -- it is real history and several documents need it. The
 * invariant is that a reader who meets it anywhere outside the archive also meets the
 * correction in the same file. docs/archive/ is exempt by design: its README carries one
 * correction for everything beneath it.
 */

const LIVE = '154676789439';
const FORMER = '160815546559';
const ARCHIVE = join('docs', 'archive');

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

test('no doc outside the archive leaves the former live theme uncorrected', () => {
  const files = walk(join(root, 'docs'))
    .map((file) => relative(root, file))
    .filter((file) => /\.(md|sh)$/.test(file))
    .filter((file) => !file.startsWith(ARCHIVE));

  assert.ok(files.length > 10, `only ${files.length} docs found; the probe is broken`);

  const uncorrected = files.filter((file) => {
    const body = readFileSync(join(root, file), 'utf8');
    if (!body.includes(FORMER)) return false;
    return !(body.includes(LIVE) && body.includes('MAIN'));
  });

  assert.deepEqual(
    uncorrected,
    [],
    `these name theme ${FORMER} without saying that ${LIVE} is MAIN today, so a reader takes the ` +
      `old id as current: ${uncorrected.join(', ')}`
  );
});

/*
 * compare-themes.sh defaulted LIVE_ID to the former published theme. Run today that default
 * diffs production against an unpublished preview and reports the preview as the baseline --
 * a wrong answer rather than an error, which is the worse failure. It must refuse instead.
 */
test('compare-themes.sh refuses to guess which theme is live', () => {
  const script = readFileSync(join(root, 'docs/tools/compare-themes.sh'), 'utf8');

  assert.doesNotMatch(
    script,
    new RegExp(`LIVE_ID="\\$\\{LIVE_ID:-${FORMER}\\}"`),
    'LIVE_ID defaults to the former published theme again'
  );
  assert.match(script, /LIVE_ID="\$\{LIVE_ID:-\}"/, 'LIVE_ID should have no default at all');
  assert.match(script, /LIVE_ID is not set/, 'the script should say so rather than guess');
  assert.match(script, /LIVE_ID" == "\$NEW_ID/, 'the script should refuse to compare a theme with itself');

  /* NEW_ID cannot keep a default either. The published theme today is the id NEW_ID used to
     default to, so an operator who does what the "not set" message tells them -- set LIVE_ID to
     the published theme -- lands on LIVE_ID == NEW_ID and the script exits with nothing run.
     The two guards have to leave a way through, not close on each other. */
  assert.match(script, /NEW_ID="\$\{NEW_ID:-\}"/, 'NEW_ID defaults again; with LIVE_ID required, a default here makes the documented recovery exit on the equality guard');
  assert.ok(
    !new RegExp(`NEW_ID="\\$\\{NEW_ID:-${LIVE}\\}"`).test(script),
    'NEW_ID defaults to the published theme, which is the one value that cannot be the candidate'
  );
});
