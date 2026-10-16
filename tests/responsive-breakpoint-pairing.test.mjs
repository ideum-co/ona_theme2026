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
 */
const bannerSwitchBreakpoint = () => {
  const css = read('assets/legacy-page-layout.css');
  const blocks = [...css.matchAll(/@media\s*\(\s*max-width\s*:\s*(\d+)px\s*\)\s*\{([\s\S]*?)\n\}/g)];
  const owning = blocks.filter(([, , body]) => /\.banner-detail-top\s+\.pc-show\s*\{[^}]*display\s*:\s*none/.test(body));
  assert.equal(owning.length, 1, 'expected exactly one media block to hide the banner\'s desktop image');
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
  const preloads = [...source.matchAll(/<link rel="preload"[\s\S]*?media="\((max|min)-width:\s*([\d.]+)px\)"/g)]
    .map(([, kind, px]) => [kind, px]);

  assert.deepEqual(
    preloads,
    [['max', String(breakpoint)], ['min', String(breakpoint + 1)]],
    `preload boundaries must bracket the CSS switch at ${breakpoint}px, leaving no viewport that preloads one image and paints the other`,
  );

  // And each preload must point at the width the matching element actually uses.
  assert.match(source, /href="\{\{ section\.settings\.image \| img_url: '800x' \}\}"\s*\n\s*media="\(max-width/);
  assert.match(source, /href="\{\{ section\.settings\.image \| img_url: '1920x' \}\}"\s*\n\s*media="\(min-width/);
  assert.match(source, /img-bg mobile-show[^>]*img_url: '800x'/);
  assert.match(source, /img-bg pc-show[^>]*img_url: '1920x'/);
});
