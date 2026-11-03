import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const banner = () => read('sections/bf-countdown-banner.liquid');
const bannerJs = () => read('assets/bf-banner-countdown.js');
const landing = () => read('sections/bfcm-landing.liquid');
const landingJs = () => read('assets/bfcm-countdown.js');
const wfg = () => read('sections/ona-donation-counter.liquid');

/*
 * The Black Friday countdown banner (Macarena's brief, 4 November 2026) reuses the
 * Water For Good counter's design as a COPY. Three failure modes are worth guarding,
 * and all three are silent -- nothing throws, the page just renders wrong:
 *
 *   1. The countdown contract. bf-banner-countdown.js bails out of connectedCallback
 *      and renders NOTHING if any one of its six required hooks is missing, or if a
 *      date lacks an explicit UTC offset. Drop `data-countdown-seconds` in a refactor
 *      and the clock quietly never starts. Liquid has no types to catch it.
 *
 *   2. Cross-contamination with WFG. WFG is coming back and the BFCM landing page has
 *      to keep rendering as it does today, so the brief was explicit: copy, do not
 *      edit. If someone later "deduplicates" by pointing the banner at the shared
 *      bfcm-countdown element, the landing page inherits the banner's wording.
 *
 *   3. One list, two surfaces. The homepage banner and the landing page both tag
 *      sign-ups so the list is usable afterwards. Two different tags means two half
 *      lists and a segment that silently misses people.
 */

test('the banner satisfies every hook bf-banner-countdown.js requires', () => {
  const src = banner();

  // Mirror the selectors the script actually queries rather than a hand-kept list,
  // so the test tracks the script instead of drifting from it.
  const js = bannerJs();
  const required = [...js.matchAll(/\[data-countdown-([a-z-]+)\]/g)].map((m) => m[1]);
  const templated = [...js.matchAll(/data-countdown-\$\{unit\}/g)].length > 0;
  const units = templated ? ['days', 'hours', 'minutes', 'seconds'] : [];

  assert.ok(required.length >= 3, 'expected the script to query status, clock and fallback');
  for (const hook of [...new Set([...required, ...units])]) {
    assert.match(
      src,
      new RegExp(`data-countdown-${hook}\\b`),
      `the section is missing data-countdown-${hook}, so the countdown renders nothing at all`
    );
  }

  assert.match(src, /<bf-banner-countdown\b/, 'the custom element wrapper is gone');
  assert.match(src, /data-start-at=/, 'data-start-at is required by connectedCallback');
  assert.match(src, /data-end-at=/, 'data-end-at is required by connectedCallback');
  assert.match(
    src,
    /bf-banner-countdown\.js/,
    'the section never loads its script, so the element is never defined'
  );
});

test('both countdown dates carry an explicit offset, or the clock refuses to start', () => {
  const src = banner();
  const offset = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/;

  for (const id of ['countdown_start_at', 'countdown_end_at']) {
    const match = src.match(new RegExp(`"id":\\s*"${id}"[^}]*?"default":\\s*"([^"]*)"`, 's'));
    assert.ok(match, `${id} has no default in the schema`);
    assert.match(
      match[1],
      offset,
      `${id} default "${match[1]}" has no UTC offset; hasExplicitOffset() rejects it and the banner shows no clock`
    );
  }
});

test('the countdown window is ordered and inside ONA\'s 21-27 November dates', () => {
  const src = banner();
  const pick = (id) =>
    src.match(new RegExp(`"id":\\s*"${id}"[^}]*?"default":\\s*"([^"]*)"`, 's'))[1];

  const start = Date.parse(pick('countdown_start_at'));
  const end = Date.parse(pick('countdown_end_at'));
  assert.ok(Number.isFinite(start) && Number.isFinite(end), 'a default date does not parse');
  assert.ok(end > start, 'countdown_end_at must be after countdown_start_at or update() never runs');

  // Sale is 21-27 Nov 2026 inclusive; early access on the 20th is the countdown target.
  // Both are Sydney (+11:00) in November.
  assert.ok(
    start >= Date.parse('2026-11-19T00:00:00+11:00') && start <= Date.parse('2026-11-21T23:59:59+11:00'),
    'the countdown target sits outside the early-access / sale-open window'
  );
  assert.ok(
    end > Date.parse('2026-11-27T00:00:00+11:00') && end <= Date.parse('2026-11-28T23:59:59+11:00'),
    'the countdown end does not match a sale that closes on Friday 27 November'
  );
});

test('the WFG counter and the landing page countdown are untouched by the copy', () => {
  // The banner must not reach into either shared asset. Scoped to real code --
  // the section's comment names bfcm-countdown.js precisely to record that it is
  // left alone, and an assertion over prose would fail on its own explanation.
  assert.doesNotMatch(
    banner(),
    /<bfcm-countdown\b|<\/bfcm-countdown>/,
    'the banner renders the landing page countdown element; it must use its own copy so WFG and BFCM stay independent'
  );
  assert.doesNotMatch(
    banner(),
    /'bfcm-countdown\.js'\s*\|\s*asset_url/,
    'the banner loads the landing page countdown script; it must load its own copy'
  );
  assert.doesNotMatch(
    wfg(),
    /countdown/i,
    'the Water For Good counter has grown countdown logic; it was meant to stay exactly as it is for reuse'
  );

  // Each element keeps its own custom-element name, so registering one cannot shadow the other.
  assert.match(landingJs(), /customElements\.define\('bfcm-countdown'/, 'the landing page element was renamed');
  assert.match(bannerJs(), /customElements\.define\('bf-banner-countdown'/, 'the banner element was renamed');
  assert.notEqual(
    landingJs().match(/customElements\.define\('([^']+)'/)[1],
    bannerJs().match(/customElements\.define\('([^']+)'/)[1],
    'both scripts define the same element name; whichever loads second is ignored'
  );
});

test('the banner and the landing page build one list, not two', () => {
  const tagOf = (src) => src.match(/name="contact\[tags\]"\s+value="([^"]+)"/);

  const landingTag = tagOf(landing());
  assert.ok(landingTag, 'the landing page sign-up no longer tags customers');

  const bannerDefault = banner().match(/"id":\s*"signup_tag"[^}]*?"default":\s*"([^"]*)"/s);
  assert.ok(bannerDefault, 'the banner has no signup_tag default');
  assert.equal(
    bannerDefault[1],
    landingTag[1],
    `the banner tags "${bannerDefault[1]}" but the landing page tags "${landingTag[1]}", so the campaign builds two partial lists`
  );
});

test('the banner collects email only, and says why SMS is absent', () => {
  const src = banner();
  assert.match(src, /name="contact\[email\]"/, 'the email field is gone');
  // form 'customer' creates an email subscriber; it does not establish SMS consent.
  // A phone field here would silently drop the number, which is worse than none.
  assert.doesNotMatch(
    src,
    /name="contact\[phone\]"/,
    'a phone field was added to a newsletter form: form \'customer\' does not record SMS consent, so the number is silently dropped'
  );
  assert.match(src, /SMS is NOT collected here/, 'the reason SMS is missing was removed from the comment');
});
