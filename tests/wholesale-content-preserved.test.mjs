import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { extract } from './extract-page-content.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(readFileSync(join(root, 'tests/fixtures/wholesale-content.json'), 'utf8'));

/*
 * /pages/wholesale is being rebuilt from 19 legacy ona-* sections into Horizon components. The
 * brief is a redesign with no content change and nothing lost, and "nothing lost" is easy to
 * promise and hard to see: a dropped paragraph in the middle of a 19-section page looks like
 * nothing at all in a diff of a 2,000-line JSON template.
 *
 * So the pre-rebuild page is frozen as a fixture and every rebuild slice is checked against it.
 * The comparison is by VALUE, not by location: the rebuild is meant to move copy between
 * sections, so a heading that lands in a different block still counts as kept. What it cannot
 * do is disappear.
 *
 * Disabled blocks are recorded separately and deliberately not required -- they render nothing
 * today, so dropping them changes no reader's experience -- but they are in the fixture so a
 * decision to drop them is visible rather than accidental.
 */
test('every piece of wholesale copy, media and destination survives the rebuild', () => {
  const now = extract(join(root, 'templates/page.wholesale.json'));
  const present = new Set(now.required.map((item) => item.value));
  for (const item of now.chrome) present.add(item.value);
  for (const item of now.disabled) present.add(item.value);

  const lost = fixture.required.filter((item) => !present.has(item.value));

  assert.deepEqual(
    lost.map((item) => `${item.where} ${item.key}: ${item.value.slice(0, 80)}`),
    [],
    `${lost.length} content values from the pre-rebuild page are no longer anywhere in the template`
  );
});

/*
 * The fixture is the baseline, so the cheapest way to make this suite green is to regenerate it
 * after dropping something. That would delete the protection and leave the test passing, which
 * is worse than not having it. The floor is the count at the freeze; regenerating after a loss
 * drops below it and fails here instead.
 */
test('the wholesale baseline has not been quietly weakened', () => {
  const FROZEN_COUNT = 157;
  assert.ok(
    fixture.required.length >= FROZEN_COUNT,
    `the fixture now holds ${fixture.required.length} required values, down from ${FROZEN_COUNT}; ` +
      'it was regenerated after content left the page. Restore the value or move it to a documented removal.'
  );
  assert.match(fixture.generated_from ?? '', /^[0-9a-f]{40}$/, 'the fixture does not record the commit it was taken from');
  assert.equal(fixture.source, 'templates/page.wholesale.json', 'the fixture was generated from the wrong template');
});
