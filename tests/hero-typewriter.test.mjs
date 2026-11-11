import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

const js = read('assets/hero-typewriter.js');
const hero = read('sections/hero.liquid');

/*
 * The hero heading is above the fold and SEO-critical, so the typewriter may only ever replace
 * text it has already read, and only when it is safe to animate. Every other path keeps the real
 * heading exactly as authored.
 */

test('the typed heading is opt-in and wired through the hero', () => {
  const schema = JSON.parse(hero.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/)[1]);
  const setting = schema.settings.find((s) => s.id === 'type_heading');
  assert.ok(setting, 'the hero exposes a type_heading setting');
  assert.equal(setting.default, false, 'off by default');
  assert.match(hero, /settings\.type_heading %\} hero--type-heading/, 'the setting adds the hero--type-heading hook');
  assert.match(hero, /hero-typewriter\.js' \| asset_url/, 'and the engine is loaded');
});

test('it never leaves the heading empty: reads first, bails on anything risky', () => {
  // The engine only runs when motion is allowed...
  assert.match(js, /prefersReduced\(\)/, 'reduced motion is checked');
  assert.match(js, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/, 'against the reduce query');
  // ...targets the hero's first text block...
  assert.match(js, /\.hero__content-wrapper > \.text-block:first-child/, 'targets the hero title');
  // ...bails on a rich/multi-node heading and on empty text, BEFORE clearing anything...
  const body = js.slice(js.indexOf('function typeHeading'), js.indexOf('try {'));
  const bailRich = body.indexOf('children.length > 0');
  const bailEmpty = body.indexOf('if (!text) return');
  const clear = body.indexOf("title.textContent = ''");
  assert.ok(bailRich > 0 && bailRich < clear, 'a multi-node heading is left untouched, before any clear');
  assert.ok(bailEmpty > 0 && bailEmpty < clear, 'empty text bails before any clear');
  // ...and the whole thing is wrapped so a throw leaves the DOM as it was.
  assert.match(js, /catch \(error\) \{[\s\S]*?Leave the real heading/, 'any error leaves the real heading in place');
});

test('the title does not also fade, and the layout is reserved so nothing shifts', () => {
  // The fade/rise entrance is turned off for a typed title (the typing is the entrance).
  assert.match(
    hero,
    /\.hero--type-heading \.hero__content-wrapper > \.text-block:first-child \{[\s\S]*?animation: none/,
    'a typed title does not also run the content-reveal fade',
  );
  // A hidden full-text ghost reserves the final box; the live text overlays it absolutely.
  assert.match(js, /hero-typing__ghost/, 'a ghost copy is created');
  assert.match(hero, /\.hero-typing__ghost \{\s*visibility: hidden/, 'the ghost reserves space but is hidden');
  assert.match(hero, /\.hero-typing__live \{[\s\S]*?position: absolute/, 'the live text overlays the ghost');
});

test('the scroll cue is opt-in and its chevron only bobs when motion is allowed', () => {
  const schema = JSON.parse(hero.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/)[1]);
  const setting = schema.settings.find((s) => s.id === 'show_scroll_cue');
  assert.ok(setting, 'the hero exposes a show_scroll_cue setting');
  assert.equal(setting.default, false, 'off by default');
  assert.match(hero, /settings\.show_scroll_cue -%\}\s*<div class="hero__scroll-cue"/, 'the setting gates the cue markup');
  assert.match(
    hero,
    /@media \(prefers-reduced-motion: no-preference\) \{\s*\.hero__scroll-cue-arrow \{\s*animation: hero-scroll-bob/,
    'the chevron bob is gated on prefers-reduced-motion',
  );
});

test('the typed heading uses a written cadence, not a flat metronome', () => {
  assert.match(js, /PAUSE_AFTER/, 'punctuation/space pauses are defined');
  assert.match(js, /setTimeout\(tick, delayAfter\(text\[i - 1\]\)\)/, 'each character waits the cadence for the one just typed');
});
