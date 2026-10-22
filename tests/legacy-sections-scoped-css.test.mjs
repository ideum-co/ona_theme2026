import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const doc = readFileSync(join(root, 'docs/legacy-sections-unstyled-2026-10-20.md'), 'utf8');

/*
 * docs/legacy-sections-unstyled-2026-10-20.md is a dated measurement that doubles as a work
 * list, and the two roles pull against each other: the measurement is only honest frozen, the
 * work list is only useful current. It said "forty sections carry no scoped CSS" and listed
 * them by name; by the time anyone read it ten had been scoped -- including four it named as
 * examples -- so following it meant redoing shipped work. Freezing the prose and deriving the
 * count is the way to have both.
 */
const SCOPED = /\{%-?\s*(stylesheet|style)\s*%\}/;

const sections = readdirSync(join(root, 'sections'))
  .filter((file) => file.startsWith('ona-') && file.endsWith('.liquid'))
  .map((file) => file.slice(0, -'.liquid'.length))
  .sort();

const unscoped = sections.filter(
  (name) => !SCOPED.test(readFileSync(join(root, 'sections', `${name}.liquid`), 'utf8'))
);

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four',
  'twenty-five', 'twenty-six', 'twenty-seven', 'twenty-eight', 'twenty-nine', 'thirty'];

test('the probe finds sections on both sides of the line', () => {
  assert.ok(sections.length > 40, `only ${sections.length} ona-* sections found; the probe is broken`);
  assert.ok(unscoped.length > 0, 'every section is scoped, which would be news -- check the probe');
  assert.ok(unscoped.length < sections.length, 'no section is scoped, so the regex is not matching');
});

test('the stated unscoped count is what the sections hold', () => {
  const word = NUMBER_WORDS[unscoped.length];
  assert.ok(word, `no word for ${unscoped.length}; extend NUMBER_WORDS`);

  const capitalised = word[0].toUpperCase() + word.slice(1);
  assert.match(
    doc,
    new RegExp(`\\*\\*${capitalised} of the theme's ${sections.length} legacy`),
    `the doc does not say ${word} of ${sections.length} sections are unscoped`
  );
  assert.match(
    doc,
    new RegExp(`not to write ${word}\\s+new ones`),
    `the closing line does not say ${word}`
  );
});

/*
 * The names matter more than the total: the list is what someone works through, and a section
 * that has been scoped since must not still be on it.
 */
test('the listed sections are exactly the unscoped ones', () => {
  /* The document opens with a fenced block of upscale measurements, so "the first fence"
     is the wrong one. Pick the fence whose every token is a section name. */
  const fences = [...doc.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((match) => match[1]);
  const lists = fences
    .map((body) => body.split(/\s+/).filter(Boolean))
    .filter((tokens) => tokens.length > 0 && tokens.every((token) => token.startsWith('ona-')));

  assert.equal(lists.length, 1, 'expected exactly one fenced block listing section names');

  const listed = lists[0].slice().sort();
  assert.deepEqual(listed, unscoped, 'the listed sections are not the ones lacking scoped CSS');
});

/*
 * The four the document named as examples are the ones a reader is most likely to act on, and
 * all four were scoped while the prose still cited them as unstyled. Name them so the sentence
 * that now says "scoped since" cannot quietly become wrong in the other direction.
 */
test('the sections named as scoped-since really are scoped', () => {
  for (const name of ['ona-awards', 'ona-cafe-testimonial', 'ona-faq-lists', 'ona-wholesale-testimonial']) {
    assert.ok(sections.includes(name), `${name} is no longer a section`);
    assert.ok(!unscoped.includes(name), `${name} is cited as scoped since, but carries no scoped CSS`);
  }
});
