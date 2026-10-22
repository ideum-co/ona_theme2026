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
  const live = [...now.required, ...now.chrome, ...now.disabled];

  /* Atomic values -- an image ref, a video url, an anchor, a short heading -- are tokens. They
     move intact or not at all, so they are matched exactly. */
  const atoms = new Set(live.map((item) => item.value));

  /* Prose does not survive as a whole field value, and should not have to. The rebuild splits
     one legacy `content` into separate text blocks and merges others, both of which are the
     point of the exercise. What must not happen is words going missing, so prose is checked
     against the page's whole word count: every word of the original, as many times as it
     appeared. A dropped sentence takes its words with it and fails here; a sentence moved to
     another block does not. */
  const words = (text) => text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
  const budget = new Map();
  for (const item of live) {
    for (const word of words(item.value)) budget.set(word, (budget.get(word) ?? 0) + 1);
  }

  const isAtomic = (item) =>
    /^(shopify:\/\/|https?:\/\/|#|mailto:|\/)/.test(item.value) ||
    item.key.endsWith('@href') ||
    item.key === 'id' ||
    words(item.value).length <= 6;

  const lost = [];
  const spent = new Map();
  for (const item of fixture.required) {
    if (isAtomic(item)) {
      if (!atoms.has(item.value)) lost.push(`${item.where} ${item.key}: ${item.value.slice(0, 80)}`);
      continue;
    }
    const missing = [];
    for (const word of words(item.value)) {
      const used = (spent.get(word) ?? 0) + 1;
      spent.set(word, used);
      if (used > (budget.get(word) ?? 0)) missing.push(word);
    }
    if (missing.length) {
      lost.push(`${item.where} ${item.key}: ${missing.length} words gone (${missing.slice(0, 8).join(' ')})`);
    }
  }

  assert.deepEqual(lost, [], `${lost.length} content values from the pre-rebuild page are no longer on it`);
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
