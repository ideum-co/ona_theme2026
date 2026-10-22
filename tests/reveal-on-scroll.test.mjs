import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

const js = read('assets/reveal-on-scroll.js');
const scripts = read('snippets/scripts.liquid');
const baseCss = read('assets/base.css');

/*
 * The whole point of the scroll-reveal foundation is that it adds polish without
 * ever costing a visitor the content. If the hidden start state could apply
 * without JS or under reduced motion, a failed script or a motion-off visit would
 * leave headings and buttons invisible. These assertions hold that contract.
 */

test('the engine reveals on intersection and only runs the motion path when motion is allowed', () => {
  assert.match(js, /new IntersectionObserver/, 'reveals are observed, not timed');
  assert.match(js, /\[data-reveal\]/, 'it targets [data-reveal]');
  assert.match(js, /classList\.add\(REVEALED\)|classList\.add\('is-revealed'\)/, 'and adds is-revealed');
  assert.match(js, /unobserve/, 'each element reveals once');
  // Reduced motion / no IntersectionObserver: reveal everything at once, no animation.
  assert.match(
    js,
    /prefers-reduced-motion: reduce[\s\S]*?items\.forEach\([\s\S]*?is-revealed|prefersReduced\(\)[\s\S]*?forEach/,
    'reduced motion reveals everything immediately',
  );
  assert.match(js, /shopify:section:load/, 're-arms after a section re-renders in the editor');
});

test('the start state is armed before paint, only with JS and motion allowed', () => {
  // Inline head gate: adds reveal-ready only under no-preference, in a try/catch.
  assert.match(
    scripts,
    /prefers-reduced-motion: no-preference[\s\S]*?classList\.add\('reveal-ready'\)/,
    'reveal-ready is set only when motion is allowed',
  );
  assert.match(scripts, /reveal-on-scroll\.js' \| asset_url/, 'the engine is loaded');
  assert.match(scripts, /reveal-on-scroll[\s\S]*?fetchpriority="low"/, 'and loaded deferred, off the critical path');
});

test('no [data-reveal] content is ever hidden without JS or under reduced motion', () => {
  // The hidden state must be gated on BOTH .reveal-ready (JS ran) and the
  // reduced-motion media query. Either gate alone could strand content.
  const rule = baseCss.match(/\.reveal-ready \[data-reveal\] \{[\s\S]*?\}/);
  assert.ok(rule, 'the hidden start state exists and is scoped to .reveal-ready');
  assert.match(rule[0], /opacity: 0/, 'it hides until revealed');

  // That rule must sit inside a prefers-reduced-motion: no-preference block.
  const guarded = baseCss.match(
    /@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\.reveal-ready \[data-reveal\] \{/,
  );
  assert.ok(guarded, 'the hidden state is also gated on prefers-reduced-motion: no-preference');

  // Every [data-reveal] rule that hides must carry the .reveal-ready prefix; a bare
  // `[data-reveal] { opacity: 0 }` would strand content without JS.
  const hideRules = [...baseCss.matchAll(/([.#\w-]*)\s*\[data-reveal\][^{]*\{[^}]*opacity:\s*0/g)];
  assert.ok(hideRules.length >= 1, 'the hidden start state must exist');
  for (const m of hideRules) {
    assert.match(m[1], /reveal-ready/, `a [data-reveal] hidden rule is not gated on .reveal-ready: "${m[1]}"`);
  }
});

test('the editorial variant staggers its children and never hides its own wrapper', () => {
  // The editorial wrapper carries [data-reveal] only so the engine observes it; it
  // must be reset to visible, or the plain rule above would fade the whole section
  // instead of staggering the media and content inside it.
  const resetRule = baseCss.match(
    /\.reveal-ready \[data-reveal\]\.reveal--editorial \{[^}]*\}/,
  );
  assert.ok(resetRule, 'the editorial wrapper is reset');
  assert.match(resetRule[0], /opacity:\s*1/, 'the editorial wrapper itself stays visible');

  // Its children (media frame + content) are what animate, and both are gated on
  // .reveal-ready + prefers-reduced-motion like everything else.
  assert.match(
    baseCss,
    /\.reveal-ready \[data-reveal\]\.reveal--editorial \.media-block[\s\S]*?opacity:\s*0/,
    'the media frame has a hidden start state',
  );
  assert.match(
    baseCss,
    /\.reveal-ready \[data-reveal\]\.reveal--editorial \.media-with-content__content[\s\S]*?transition-delay/,
    'the content follows the media on a delay (stagger)',
  );

  // The media opt-in is per section (default off) and wires the class + attribute.
  const section = read('sections/media-with-content.liquid');
  assert.match(section, /"id":\s*"motion_reveal"[\s\S]*?"default":\s*false/, 'the reveal is opt-in, off by default');
  assert.match(section, /section\.settings\.motion_reveal[\s\S]*?reveal--editorial/, 'the opt-in adds the editorial class');
  assert.match(section, /section\.settings\.motion_reveal\s*%\}data-reveal/, 'the opt-in adds the data-reveal hook');
});
