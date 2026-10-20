import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const layout = read('assets/legacy-page-layout.css');
const base = read('assets/base.css');

/*
 * assets/base.css sets `img { width: 100% }` for every image in the theme.
 * Horizon's own components always wrap an image in a sized container, so that
 * is safe there -- but sections ported from the legacy theme have no such
 * container, and the image expands to its parent's full width.
 *
 * Measured on /pages/wholesale, 2026-10-20: a 100x150 icon painted at
 * 1016x1526, .col-4-icons 6,491px tall against production's 396px, and the
 * page at 40,886px against production's 10,400px. Production's own numbers,
 * read out of its assets/main.min.css (a 467 KB legacy monolith this theme
 * deliberately does not carry): icons max 120x88, brand logos max 170px.
 */
test('base.css really does stretch every image, which is why these rules exist', () => {
  // If this ever stops being true the overrides below are dead weight -- but
  // they must not be removed on a guess, so assert the premise.
  assert.match(
    base,
    /\bimg\s*\{[^}]*width:\s*100%/,
    'base.css no longer sets img { width: 100% } -- re-check whether the legacy overrides are still needed',
  );
});

test('the legacy icon row and brand wall constrain their images', () => {
  for (const [label, selector, maxW] of [
    ['icon', '\\.col-4-icons \\.icon-c img', '120px'],
    ['brand logo', '\\.wholesale-brands \\.brand-thumb img', '170px'],
  ]) {
    const rule = layout.match(new RegExp(`#MainContent ${selector}\\s*\\{([^}]*)\\}`));
    assert.ok(rule, `${label} images must be constrained`);
    // width:auto is the part that matters. max-width alone loses to
    // base.css's width:100% -- the image is still laid out at full width.
    assert.match(rule[1], /width:\s*auto/, `${label}: width:auto is required to beat base.css`);
    assert.match(rule[1], new RegExp(`max-width:\\s*${maxW}`), `${label}: max-width must be ${maxW}`);
  }
  assert.match(
    layout,
    /#MainContent \.col-4-icons \.icon-c \{[^}]*block-size:\s*88px/,
    'the icon row keeps production\'s 88px height',
  );
});

test('the two-column rows match the single-element .content.container markup', () => {
  /*
   * The ported sections emit ONE element carrying both classes --
   * `<div class="content container">` -- not `.container > .content`. An
   * earlier rule targeted `> .container > .content` and therefore matched
   * nothing, so every image-and-text row stacked full width: six sections on
   * /pages/wholesale at 1,941-2,994px against production's 441-566px.
   *
   * Reproduced before writing this: deleting the `.content.container`
   * selector takes the live page from 17,274px back to 27,033px.
   */
  const rule = layout.match(
    /#MainContent :is\([^)]*\.add-image-and-text-slider[^)]*\) > \.content\.container\s*\{([^}]*)\}/,
  );
  assert.ok(rule, 'the two-column rule must target `.content.container` as one element');
  assert.match(rule[1], /display:\s*grid/, 'it must lay the row out, not just set a width');
  assert.match(rule[1], /grid-template-columns:\s*repeat\(2/, 'production renders these as two columns');

  // A rule that only matched the nested shape would silently do nothing again.
  assert.doesNotMatch(
    layout,
    /> \.container > \.content\.container/,
    'that selector describes markup this theme does not emit',
  );
});

test('the video play overlay is positioned and its icon is capped', () => {
  /*
   * `.play-video` wraps a real <img> here (production used a ::before), so
   * base.css painted a 150px icon at 605px -- 4.0x, the worst upscale left on
   * /pages/wholesale after #204. Production: absolute, inset 0, centred, icon
   * capped at 100px.
   */
  const overlay = layout.match(/#MainContent \.play-video\s*\{([^}]*)\}/);
  assert.ok(overlay, '.play-video must be positioned over its media');
  assert.match(overlay[1], /position:\s*absolute/);
  assert.match(overlay[1], /inset:\s*0/);

  const icon = layout.match(/#MainContent \.play-video img\s*\{([^}]*)\}/);
  assert.ok(icon, 'the play icon must be constrained');
  // width:auto is what beats base.css's img{width:100%}; max-width alone loses.
  assert.match(icon[1], /width:\s*auto/, 'max-width alone cannot beat img{width:100%}');
  assert.match(icon[1], /max-width:\s*100px/, "production's icon is 100px");

  // The overlay needs a positioned ancestor or it escapes to the page.
  assert.match(
    layout,
    /#MainContent :has\(> \.play-video\)\s*\{[^}]*position:\s*relative/,
    'the overlay needs a positioned parent, scoped so it does not reposition every .img',
  );
});

test('the round avatars have an intrinsic size', () => {
  /*
   * `.bg-img` holds its image as an inline `background-image` and has no
   * intrinsic size, so with no rule it rendered 411x0 -- invisible. The
   * section still measured close to production, which is exactly why a
   * height-only comparison called it a correct "control" section.
   */
  const avatar = layout.match(/#MainContent [^{]*\.img > \.bg-img\s*\{([^}]*)\}/);
  assert.ok(avatar, '.bg-img must be given a size');
  assert.match(avatar[1], /padding-top:\s*100%/, 'production squares it with padding-top');
  assert.match(avatar[1], /background-size:\s*cover/);
  assert.match(avatar[1], /border-radius:\s*50%/, 'production renders these round');
});

test('the decorative blob sits behind the photo, not above it in flow', () => {
  /*
   * `svg.animated-svg` is a mustard organic shape the ported sections place as
   * a sibling of the photo inside `.img`. Unstyled it lays out as a normal
   * block, so the column becomes blob + photo stacked and the blob reads as a
   * giant orange rectangle above the image -- on eight sections, which is most
   * of the legacy pages.
   *
   * Production (theme 160815546559, /pages/barista-courses): the svg is
   * absolute at inset 0 0 auto with z-index 1, and the IMAGE carries
   * z-index 2 so it covers the blob. Only the crescent extending past the
   * photo shows.
   */
  const svg = layout.match(/#MainContent :has\(> \.animated-svg\):has\(img\) > \.animated-svg\s*\{([^}]*)\}/);
  assert.ok(svg, 'the blob must be taken out of flow');
  assert.match(svg[1], /position:\s*absolute/, 'in flow it stacks above the photo');
  assert.match(svg[1], /z-index:\s*1/);

  const container = layout.match(/#MainContent :has\(> \.animated-svg\):has\(img\)\s*\{([^}]*)\}/);
  assert.ok(container, 'the blob needs a positioned ancestor');
  assert.match(container[1], /position:\s*relative/);

  /*
   * The z-index on the image is the part that is easy to miss, and I missed
   * it first: without it the blob paints OVER the photo and the page looks
   * worse, not better. Production puts the photo above the blob.
   */
  const image = layout.match(/#MainContent :has\(> \.animated-svg\):has\(img\) img\s*\{([^}]*)\}/);
  assert.ok(image, 'the photo must be lifted above the blob');
  assert.match(image[1], /position:\s*relative/);
  assert.match(image[1], /z-index:\s*2/, 'without this the blob covers the photo');

  /*
   * Keyed on shape, not class: the same sections wrap the pair in `.img`,
   * `.image-box` and `.left-box`, and a rule naming one of them misses the
   * others. Codex, #213 -- the first version matched `.img` and left the
   * /pages/about blob in flow.
   */
  assert.doesNotMatch(
    layout,
    /#MainContent \.img:has\(> \.animated-svg\)/,
    'do not key the blob rule on one wrapper class; match the shape',
  );
});
