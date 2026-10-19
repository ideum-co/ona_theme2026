import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

/*
 * Horizon has two breakpoints and the whole theme is built on them: 749/750 for
 * mobile, 989/990 for the tablet band. 261 `min-width: 750px` and 154
 * `max-width: 749px` queries across the theme, against single digits for
 * anything else. A migrated page that invents its own boundary does not look
 * broken in the editor -- it only misbehaves in the band between the two.
 */
const MOBILE_MAX = 749;

/**
 * The breakpoint at which `assets/legacy-page-layout.css` swaps the banner's
 * desktop background for its mobile one. Read from the stylesheet rather than
 * hardcoded, so this test tracks the CSS instead of a copy of it.
 *
 * It requires the owning media block to carry BOTH halves of the swap. Keying
 * only on the rule that hides `.pc-show` was not enough: delete the
 * `.mobile-show` rule, or move it to another block, and this helper would still
 * return 749 and every preload assertion below would still pass -- while the
 * banner rendered blank on a phone, or painted the mobile image over the
 * preloaded desktop one. Codex, PR #180.
 */
const bannerSwitchBreakpoint = () => {
  const css = read('assets/legacy-page-layout.css');

  // Outside any media query the mobile image must be hidden, or both paint.
  assert.match(
    css,
    /^#MainContent \.banner-detail-top \.mobile-show \{[^}]*display\s*:\s*none/m,
    'the banner\'s mobile image must be hidden by default',
  );

  const blocks = [...css.matchAll(/@media\s*\(\s*max-width\s*:\s*(\d+)px\s*\)\s*\{([\s\S]*?)\n\}/g)];
  const owning = blocks.filter(([, , body]) =>
    /\.banner-detail-top\s+\.pc-show\s*\{[^}]*display\s*:\s*none/.test(body) &&
    /\.banner-detail-top\s+\.mobile-show\s*\{[^}]*display\s*:\s*block/.test(body));

  assert.equal(
    owning.length,
    1,
    'exactly one media block must perform the whole swap: hide .pc-show AND show .mobile-show',
  );
  return Number(owning[0][1]);
};

test('the legacy stylesheets stay on Horizon\'s breakpoints', () => {
  for (const asset of ['assets/legacy-page-layout.css', 'assets/home-mobile-overflow.css']) {
    for (const [query, kind, px] of read(asset).matchAll(/@media[^{]*?\(\s*(max|min)-width\s*:\s*(\d+)px/g)) {
      const allowed = kind === 'max' ? [749, 989] : [750, 990];
      assert.ok(
        allowed.includes(Number(px)),
        `${asset}: "${query.trim()}" uses ${px}px; this theme's ${kind}-width boundaries are ${allowed.join(' and ')}`,
      );
    }
  }
});

test('the training banner preloads the image its CSS will actually paint', () => {
  // The section carries its own note: "Single-width preload per media query
  // strictly matches the inline url in pc-show/mobile-show to avoid the R27/#36
  // double-fetch." It was written for the production theme, where the two
  // classes swapped at 992px. In this theme they swap at Horizon's 750px, so the
  // preloads shipped by #171/#172 were a band apart from the CSS: between 750px
  // and 991px a tablet preloaded the 800px image at high priority, then painted
  // the 1920px one. Both downloads, and the LCP image un-preloaded.
  const breakpoint = bannerSwitchBreakpoint();
  assert.equal(breakpoint, MOBILE_MAX, 'the banner should swap at Horizon\'s mobile breakpoint');

  const source = read('sections/ona-training-banner.liquid');
  const preloads = [...source.matchAll(/<link rel="preload"[\s\S]*?media="([^"]+)"/g)].map(([, query]) => query);

  // The desktop hint is the CSS condition negated, not `min-width: breakpoint+1`.
  // Those differ: a 749.5px layout viewport satisfies neither `max-width: 749px`
  // nor `min-width: 750px`, so the LCP image would go unpreloaded exactly where
  // the CSS has already switched to it. Codex, PR #180.
  const mobile = `(max-width: ${breakpoint}px)`;
  assert.deepEqual(
    preloads,
    [mobile, `not all and ${mobile}`],
    `the two preloads must partition every viewport width at the CSS switch (${breakpoint}px), leaving none that preloads one image and paints the other`,
  );

  // And each preload must point at the width the matching element actually uses.
  assert.match(source, /href="\{\{ section\.settings\.image \| img_url: '800x' \}\}"\s*\n\s*media="\(max-width/);
  assert.match(source, /href="\{\{ section\.settings\.image \| img_url: '1920x' \}\}"\s*\n\s*media="not all and/);
  assert.match(source, /img-bg mobile-show[^>]*img_url: '800x'/);
  assert.match(source, /img-bg pc-show[^>]*img_url: '1920x'/);
});
