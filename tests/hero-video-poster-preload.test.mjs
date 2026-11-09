import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const section = read('sections/hero.liquid');
const snippet = read('snippets/hero-video-poster-preload.liquid');

/*
 * The homepage's LCP is the hero video's poster frame. `video_tag` emits it as a
 * `poster` attribute, which the browser cannot see until it has parsed the
 * element, so the section preloads it instead.
 *
 * A preload only helps while its URL is the one the element then uses. When the
 * two drift apart the browser downloads the poster twice and the page is slower
 * than with no preload at all -- and nothing about the rendered page looks
 * wrong, which is why this is a test and not a comment. Three ways to drift,
 * each guarded below:
 *
 *   - the size. `video_tag`'s `image_size:` and the preload's `img_url:`
 *     argument must be the same value. They are held in one variable for that
 *     reason; this asserts they still both read it.
 *   - the filter. Shopify builds two different URLs for the same image:
 *     `img_url: '1600x'` gives the `_1600x.jpg` suffix form `video_tag` uses
 *     for a poster, `image_url: width: 1600` gives `?width=1600`. Only the
 *     first matches, though both are 1600px of the same file. So the
 *     deprecated-filter warning theme-check raises on the snippet is the
 *     correct state, and swapping to the modern filter is the regression.
 *   - the breakpoint. The desktop media element is `display: none` below the
 *     mobile breakpoint unless it is standing in for mobile too, so a preload
 *     scoped to the wrong side fetches a poster that is never painted.
 */

/** The Liquid expression a hero `assign` binds, or undefined. */
const assigned = (name) => section.match(new RegExp(`\\bassign ${name} = (.+)`))?.[1]?.trim();

test('every hero video poster and its preload read one shared size', () => {
  const posterSize = assigned('poster_size');
  assert.ok(
    posterSize,
    'sections/hero.liquid must assign poster_size -- it is the single value the video_tag posters and the preload both read, and the only thing keeping them from drifting',
  );
  assert.match(posterSize, /^'[^']+'$/, `poster_size must be a plain size literal, got ${posterSize}`);

  const imageSizes = [...section.matchAll(/\|\s*video_tag:[\s\S]{0,400}?image_size:\s*([^,\s]+)/g)].map(
    ([, value]) => value,
  );
  assert.ok(imageSizes.length > 0, 'expected the hero to render video media through video_tag');
  for (const value of imageSizes) {
    assert.equal(
      value,
      'poster_size',
      `a video_tag poster is sized with ${value} instead of poster_size -- the preload reads poster_size, so this poster would be fetched at one size and preloaded at another`,
    );
  }

  const call = section.match(/\{%-\s*render 'hero-video-poster-preload',([\s\S]*?)-%\}/);
  assert.ok(call, "sections/hero.liquid must render 'hero-video-poster-preload'; without it the LCP poster is discovered only after the <video> element is parsed");
  assert.match(
    call[1],
    /\bsize:\s*poster_size\b/,
    'the preload must be passed poster_size, not a size of its own',
  );
  assert.match(call[1], /\bsection_index:\s*section\.index\b/, 'the snippet decides whether this is the first section, so it needs section.index');
  assert.match(call[1], /\bfallback_to_desktop:\s*fallback_to_desktop\b/, 'the snippet scopes its media queries on fallback_to_desktop, so it needs that value');
});

test('the poster preload builds the URL video_tag will actually use', () => {
  const hrefs = [...snippet.matchAll(/<link\b[\s\S]*?rel="preload"[\s\S]*?href="\{\{\s*([\s\S]*?)\s*\}\}"/g)].map(
    ([, expression]) => expression.replace(/\s+/g, ' '),
  );
  assert.equal(hrefs.length, 2, `expected a desktop and a mobile poster preload, found ${hrefs.length}`);

  for (const href of hrefs) {
    assert.match(
      href,
      /\|\s*img_url:\s*size\b/,
      `the preload href is "${href}" -- a poster URL must come from "img_url: size", because image_url produces the "?width=" form while video_tag produces the "_<size>" suffix form, so the browser would download the poster twice`,
    );
    assert.doesNotMatch(
      href,
      /\|\s*image_url:/,
      `the preload href is "${href}", whose "?width=" URL is not the one video_tag puts in the poster attribute`,
    );
    assert.match(
      href,
      /\.preview_image\b/,
      `the preload href is "${href}" -- the poster is the video's preview_image, not the video object`,
    );
  }
});

test('each poster preload is scoped to the breakpoint that paints it', () => {
  /*
   * Read the breakpoint from the CSS block that performs the swap rather than
   * hardcoding it, and require that block to carry BOTH halves: keyed only on
   * the rule hiding `--desktop`, a stylesheet that had lost the rule showing
   * `--mobile` would still satisfy this while the hero rendered blank on a
   * phone. Same reasoning as tests/responsive-breakpoint-pairing.test.mjs.
   */
  const swap = section.match(
    /@media screen and \(max-width:\s*(\d+)px\)\s*\{[\s\S]*?\.hero__media-wrapper--desktop\s*\{\s*display:\s*none;[\s\S]*?\.hero__media-wrapper--mobile\s*\{\s*display:\s*block;/,
  );
  assert.ok(
    swap,
    'could not find the media block that hides .hero__media-wrapper--desktop and shows --mobile; the scoping below is measured against it, so a moved or split swap must be re-read here rather than left unchecked',
  );
  const breakpoint = swap[1];

  const call = section.match(/\{%-\s*render 'hero-video-poster-preload',([\s\S]*?)-%\}/);
  assert.ok(call);
  assert.match(
    call[1],
    new RegExp(`\\bmobile_max:\\s*${breakpoint}\\b`),
    `the preload is told the mobile breakpoint is ${call[1].match(/mobile_max:\s*(\S+)/)?.[1]} while the CSS switches at ${breakpoint}px -- in the band between them a poster is preloaded and never painted, or painted and never preloaded`,
  );

  // Both queries are written from mobile_max, so they cannot disagree with it.
  assert.match(
    snippet,
    /media="not all and \(max-width: \{\{ mobile_max \}\}px\)"/,
    'the desktop preload must be withheld below mobile_max, where its element is display:none',
  );
  assert.match(
    snippet,
    /media="\(max-width: \{\{ mobile_max \}\}px\)"/,
    'the mobile preload must be scoped to at most mobile_max, where its element is the one shown',
  );

  // The desktop query is conditional: when the desktop element stands in for
  // mobile as well, withholding its poster there leaves the only poster a phone
  // paints un-preloaded -- the exact failure this whole feature exists to fix.
  assert.match(
    snippet,
    /\{%-\s*unless fallback_to_desktop %\}\s*media="not all and \(max-width: \{\{ mobile_max \}\}px\)"\s*\{%-\s*endunless %\}/,
    'the desktop preload must drop its media query when fallback_to_desktop is set, because the desktop element is then what a phone paints',
  );

  // And the mobile preload must not fire in that same case: there is no mobile
  // element to paint it, so the fetch would be pure waste on every phone.
  assert.match(
    snippet,
    /\{%-\s*unless fallback_to_desktop -%\}\s*\{%-\s*if mobile_media == 'video'/,
    'the mobile preload must be skipped when fallback_to_desktop is set, since no mobile element renders in that case',
  );

  assert.match(snippet, /\{%-\s*if section_index == 1 -%\}/, 'only the first section should preload; below the fold there is nothing to win');
});
