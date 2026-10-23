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
const FROZEN_DIGEST = 'd5e27c84d85264628b7aa581b8b93f5e9d10e571a9aff7ffbac93e912a985150';

const stripBanner = (text) => text.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');

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
     merged into another block and still pass; a sentence may not lose its tail.

     And whole means CONTIGUOUS, IN ONE VALUE. A third attempt pooled every five-word shingle
     of the page into one set and asked whether a sentence's shingles were all present. That
     reads as strict and is not: two differently-truncated copies of the same copy jointly
     supply every shingle of a sentence that survives in neither. On this page, dropping "Join"
     from the partnership copy and "and support" from the duplicate `ona-gust-r` literal passed.
     So the haystack is a token STREAM, not a set, and the sentence is matched as a substring of
     it. Values are joined with a NUL token that no sentence can contain, which is what stops a
     match from running off the end of one value and into the next. */
  const words = (text) => text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];

  const haystackWords = live.map((item) => words(item.value));
  /* Padded both sides so the match is on token boundaries, not characters: without it "Hey
     there!" survives a change to "Whey there!", because the stream still holds `hey there`. */
  const haystackPadded = ` ${haystackWords.map((list) => list.join(' ')).join(' \u0000 ')} `;

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
      if (!haystackPadded.includes(` ${list.join(' ')} `)) {
        lost.push(`${item.where} ${item.key}: lost "${sentence.slice(0, 90)}"`);
      }
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
  /* 177 at the first freeze, 175 after two removals, 176 now. The two that left were never on
     the page: a `video_url` on an `ona-supported` block whose `media_type` is `image`, and the
     uploaded `.mov` on a partnership section set to `embed`. Both are absent from the live
     HTML, which is the test applied before lowering this -- a floor may only come down for a
     value the page never rendered, never for one that stopped rendering. The one that arrived
     was always on the page and the extractor could not see it: `ona-gust-r`'s promo is a
     hardcoded `<iframe src="https://www.youtube.com/embed/42flR1Iwun4">`, and the attribute
     pass read only `href` and `action`. */
  const FROZEN_COUNT = 176;
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

/*
 * Some of what the page shows is not in any setting.
 *
 * `templates/page.wholesale.json` leaves `sr_heading`'s `text` blank, and
 * `sections/ona-sr-heading.liquid:5` renders `page.title` instead -- so the page's only H1 is
 * produced at render time and exists nowhere in the stored content. The fixture is built from
 * stored content, so deleting that section outright left all 176 required values intact and
 * both tests above green, while the page lost its heading. Found by Codex on #283.
 *
 * This is the behaviour, not the bytes: whatever replaces the section has to keep an H1 on the
 * page, and has to keep deriving it from the page title while the setting stays blank. A
 * `page-header` with a literal heading would pass the first half and fail the second, which is
 * right -- `templates/page.bookings.json` shares its suffix across three differently titled
 * pages, so a literal is wrong there and the habit is worth catching here.
 */
test('the page keeps the heading it derives at render time', () => {
  const parsed = JSON.parse(stripBanner(readFileSync(join(root, 'templates/page.wholesale.json'), 'utf8')));
  const order = parsed.order ?? Object.keys(parsed.sections ?? {});

  const headings = [];
  for (const key of order) {
    const section = (parsed.sections ?? {})[key];
    if (!section || section.disabled) continue;
    let source;
    try {
      source = readFileSync(join(root, 'sections', `${section.type}.liquid`), 'utf8');
    } catch {
      continue;
    }
    for (const match of source.matchAll(/<h1\b[\s\S]*?<\/h1>/g)) {
      headings.push({ key, type: section.type, markup: match[0], settings: section.settings ?? {} });
    }
  }

  assert.ok(
    headings.length >= 1,
    'no live section on /pages/wholesale emits an <h1>; the page has lost its heading, and no stored value would show it'
  );

  /* And the fallback, for every heading whose own setting the template leaves blank. */
  const literal = [];
  for (const heading of headings) {
    const keys = [...heading.markup.matchAll(/section\.settings\.([\w-]+)/g)].map((match) => match[1]);
    const filled = keys.some((name) => String(heading.settings[name] ?? '').trim() !== '');
    if (filled) continue;
    if (!/page\.title|shop\.name/.test(heading.markup)) {
      literal.push(`${heading.key}(${heading.type}): heading setting is blank and the markup falls back to nothing`);
    }
  }
  assert.deepEqual(
    literal,
    [],
    'the H1 is blank in the template and the section does not fall back to the page title, so the page renders an empty heading'
  );
});
