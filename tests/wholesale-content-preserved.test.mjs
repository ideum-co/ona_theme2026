import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { extract } from './extract-page-content.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/* sha256 of the frozen fixture's content, pinned here so regenerating the fixture cannot
   silently move the baseline. See the note in the baseline test below. */
const FROZEN_DIGEST = 'b293c344441c8ad7046911da6962fa24583b8a5b58491bfb0785eb231cc2b7ba';

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

  /* Only what Shopify still RENDERS counts as kept. `extract` sorts values a merchant disabled
     into their own bucket, and an earlier version added that bucket back into the haystack --
     which meant marking a live section `disabled`, the easiest mistake to make while moving
     sections around, read as "nothing lost" while the page showed none of it. */
  const live = [...now.required, ...now.chrome];

  /* Atomic values -- an image ref, a video url, an anchor, a short heading -- are tokens. They
     move intact or not at all, so they are matched exactly. */
  const atoms = new Set(live.map((item) => item.value));

  /* Prose does not survive as a whole field value, and should not have to: the rebuild splits
     one legacy `content` into separate text blocks and merges others, which is the point of the
     exercise. Two earlier attempts were both too slack and both were caught by a control:
     counting words let a whole sentence go, because every section on a wholesale page says
     "wholesale", "coffee" and "support"; a 90% shingle floor then let an 18-word sentence go
     from a long enough paragraph, which is exactly the loss this file exists to catch.

     So the unit is the SENTENCE, with no allowance. Every sentence of the frozen page must
     survive whole, somewhere on the page. A paragraph may be split between its sentences or
     merged into another block and still pass; a sentence may not lose its tail. */
  const SHINGLE = 5;
  const words = (text) => text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
  const shingles = (list) =>
    list.length < SHINGLE
      ? []
      : Array.from({ length: list.length - SHINGLE + 1 }, (_, i) => list.slice(i, i + SHINGLE).join(' '));

  const haystackWords = live.map((item) => words(item.value));
  const haystack = new Set(haystackWords.flatMap(shingles));
  const haystackText = haystackWords.map((list) => list.join(' ')).join(' \u0000 ');
  /* Padded so a short sentence can be matched on token boundaries rather than as a substring. */
  const haystackPadded = ` ${haystackText} `;

  /* Split on structural boundaries as well as terminal punctuation. `normalise` turns the end
     of a list item or paragraph into a newline, because bullets usually carry no full stop:
     without this, `exclusive_access.content`'s four bullets are one sentence, and moving each
     into its own Horizon block fails for wanting a shingle that spans two of them -- a loss
     reported where nothing was lost. */
  const sentences = (text) =>
    text
      .split(/\n+|(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

  const isAtomic = (item) =>
    /^(shopify:\/\/|https?:\/\/|#|mailto:|\/)/.test(item.value) ||
    item.key.endsWith('@href') ||
    item.key === 'id' ||
    words(item.value).length <= 6;

  const lost = [];
  for (const item of fixture.required) {
    if (isAtomic(item)) {
      if (!atoms.has(item.value)) lost.push(`${item.where} ${item.key}: ${item.value.slice(0, 80)}`);
      continue;
    }
    for (const sentence of sentences(item.value)) {
      const list = words(sentence);
      if (!list.length) continue;
      /* A raw substring match finds the token sequence inside a longer word: "Hey there!"
         survives a change to "Whey there!" because the haystack still contains the characters
         `hey there`. The haystack is a space-joined token stream, so padding both sides turns
         the check into a token-boundary one without needing a regex per sentence. */
      const gone =
        list.length < SHINGLE
          ? !haystackPadded.includes(` ${list.join(' ')} `)
          : shingles(list).some((shingle) => !haystack.has(shingle));
      if (gone) lost.push(`${item.where} ${item.key}: lost "${sentence.slice(0, 90)}"`);
    }
  }

  assert.deepEqual(lost, [], `${lost.length} sentences or values from the pre-rebuild page are no longer on it`);
});

/*
 * The fixture is the baseline, so the cheapest way to make this suite green is to regenerate it
 * after dropping something. That would delete the protection and leave the test passing, which
 * is worse than not having it. The floor is the count at the freeze; regenerating after a loss
 * drops below it and fails here instead.
 */
test('the wholesale baseline has not been quietly weakened', () => {
  const FROZEN_COUNT = 177;
  assert.ok(
    fixture.required.length >= FROZEN_COUNT,
    `the fixture now holds ${fixture.required.length} required values, down from ${FROZEN_COUNT}; ` +
      'it was regenerated after content left the page. Restore the value or move it to a documented removal.'
  );
  assert.match(fixture.generated_from ?? '', /^[0-9a-f]{40}$/, 'the fixture does not record the commit it was taken from');
  assert.equal(fixture.source, 'templates/page.wholesale.json', 'the fixture was generated from the wrong template');

  /* The count and the sha shape are both survivable. Delete a paragraph from inside an existing
     setting and regenerate: the entry count is unchanged, the new sha is still forty hex
     characters, both checks above pass, and the primary test then compares the page against the
     weakened fixture and finds nothing missing. So the baseline is pinned by its CONTENT. This
     digest lives in the test, not in the fixture, so regenerating cannot update it -- changing
     it is a deliberate edit to this file, in the PR that justifies it. */
  const digest = createHash('sha256')
    .update(JSON.stringify(['required', 'chrome', 'disabled'].map((bucket) => (fixture[bucket] ?? []).map((item) => `${item.where}\u0000${item.key}\u0000${item.value}`))))
    .digest('hex');
  assert.equal(
    digest,
    FROZEN_DIGEST,
    'the fixture content no longer matches the frozen baseline. If the page genuinely lost or gained ' +
      'content, say so in the PR and update FROZEN_DIGEST deliberately -- do not regenerate to go green.'
  );
});
