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

/*
 * The inline head script arms the hidden start state whether or not the engine
 * module ever runs, and a module that 404s, is blocked or fails to parse cannot
 * be caught by the try/catch around that inline script. Without a failsafe, such
 * a failure leaves every opted-in section at opacity 0 permanently -- a worse
 * outcome than no animation at all. These assertions hold the release path.
 */
test('a reveal engine that never runs releases the hidden start state', () => {
  // The inline script arms a timer alongside reveal-ready...
  assert.match(
    scripts,
    /classList\.add\('reveal-ready'\)[\s\S]*?setTimeout\([\s\S]*?classList\.remove\('reveal-ready'\)/,
    'arming the gate also arms a failsafe that strips it',
  );
  // ...and a load error strips it at once rather than waiting out the timer.
  assert.match(
    scripts,
    /reveal-on-scroll\.js[\s\S]*?onerror=[\s\S]*?classList\.remove\('reveal-ready'\)/,
    'a failed module load releases the gate immediately',
  );

  // The engine stands the failsafe down only once init() has actually armed.
  assert.match(
    js,
    /try\s*\{\s*init\(\);\s*window\.clearTimeout\(window\.__revealGateFailsafe\)/,
    'the failsafe is cleared only after init() succeeds',
  );
  // And a throwing init() releases the gate instead of stranding the content.
  assert.match(
    js,
    /catch\s*\([\s\S]*?classList\.remove\('reveal-ready'\)/,
    'an engine that throws releases the gate',
  );

  // The two names must agree, or the handshake silently does nothing.
  const inlineName = scripts.match(/window\.__revealGateFailsafe/g) || [];
  const engineName = js.match(/window\.__revealGateFailsafe/g) || [];
  assert.ok(inlineName.length >= 1, 'the inline script names the failsafe handle');
  assert.ok(engineName.length >= 1, 'the engine clears the same handle');
});

test('the scroll-reveal opt-in is wired on the sections that use it', () => {
  // Both are opt-in (off by default) and neither uses the editorial variant.
  for (const path of ['sections/ona-donation-counter.liquid', 'sections/press-quotes.liquid']) {
    const section = read(path);
    assert.match(section, /"id":\s*"motion_reveal"[\s\S]*?"default":\s*false/, `${path}: reveal is opt-in, off by default`);
    assert.doesNotMatch(section, /reveal--editorial/, `${path}: not the editorial variant`);
  }

  // Donation counter reveals its pieces in a title-led cascade (like the reference):
  // the wrapper is a stagger group, and the heading carries the reveal hook, so the
  // title lifts in first and the counter, subtitle and CTA follow on the stagger.
  const donation = read('sections/ona-donation-counter.liquid');
  assert.match(donation, /motion_reveal\s*%\}data-reveal-group/, 'the wrapper is a stagger group, not a single revealing block');
  assert.match(
    donation,
    /donation-counter__heading"\{% if section\.settings\.motion_reveal %\} data-reveal/,
    'the heading itself reveals, so the title has its own entrance',
  );

  // Press quotes has no heading, so the whole section fades up as one block.
  const press = read('sections/press-quotes.liquid');
  assert.match(press, /settings\.motion_reveal\s*%\}data-reveal(?!-group)/, 'the whole section reveals as one block');
});

test('heading-led sections reveal their title, leaving grids and carousels untouched', () => {
  // These commerce sections carry scroll-snapping grids/carousels, so only the
  // heading opts into the reveal -- the title fades up like the reference while the
  // list below is never wrapped in a transform that could fight its own scrolling.
  const productList = read('sections/product-list.liquid');
  assert.match(productList, /"id":\s*"motion_reveal"[\s\S]*?"default":\s*false/, 'product-list reveal is opt-in, off by default');
  assert.match(productList, /section-resource-list__header"\{% if section\.settings\.motion_reveal %\} data-reveal/, 'product-list reveals its header');

  const carousel = read('sections/collection-carousel.liquid');
  assert.match(carousel, /"id":\s*"motion_reveal"[\s\S]*?"default":\s*false/, 'collection-carousel reveal is opt-in, off by default');
  assert.match(carousel, /\{% if settings\.motion_reveal %\}data-reveal/, 'collection-carousel reveals its heading');
});

test('any text block can opt into the reveal, so every homepage heading can use it', () => {
  // The homepage's section titles (learn_with_ona, raspberry_candy, ...) are `text`
  // blocks, so the opt-in lives on that block -- off by default -- and the data-reveal
  // hook rides inside the element's attribute capture, not behind an if that wraps the
  // element, so the theme editor's click-to-edit link to the text survives.
  const block = read('blocks/text.liquid');
  assert.match(block, /"id":\s*"motion_reveal"[\s\S]*?"default":\s*false/, 'text block reveal is opt-in, off by default');

  const snippet = read('snippets/text.liquid');
  const attrs = snippet.slice(snippet.indexOf('{% capture attributes %}'), snippet.indexOf('{% endcapture %}'));
  assert.match(attrs, /block_settings\.motion_reveal\s*%\}data-reveal/, 'the data-reveal hook is part of the element attributes, not a wrapper');
});
