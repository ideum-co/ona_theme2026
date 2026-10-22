import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

/*
 * Vector artwork lifted out of the 2026 home-page design (Web 1920 - 1.svg).
 * These live in assets/ rather than Shopify Files so Liquid can inline them
 * with `inline_asset_content` -- no extra request, and the mark inherits CSS
 * colour. A file served from Files could only ever be an <img> src.
 */
const RECOLOURABLE = [
  'ona-logo-mark.svg',
  'ona-coffee-wordmark.svg',
  'icon-benefit-freshly-roasted.svg',
  'icon-benefit-new-releases.svg',
  'icon-benefit-flexible-delivery.svg',
  'press-broadsheet.svg',
  'press-espresso-room.svg',
  'press-urban-list.svg',
];
const AS_DESIGNED = ['badge-new-harvest-sale.svg', 'badge-ona-brew-club.svg'];

test('each design SVG is present and self-contained', () => {
  for (const name of [...RECOLOURABLE, ...AS_DESIGNED]) {
    const path = `assets/${name}`;
    assert.ok(existsSync(resolve(root, path)), `${path} is missing`);
    const svg = read(path);
    assert.match(svg, /<svg\b/, `${path} must be an svg`);
    // A viewBox is what lets the mark scale; without it an inlined SVG renders
    // at a fixed size and ignores CSS width.
    assert.match(svg, /viewBox="[-\d. ]+"/, `${path} must carry a viewBox`);
    // These are inlined into the document, so a stray <script> would execute.
    assert.doesNotMatch(svg, /<script/i, `${path} must not contain a script`);
    // Raster payloads defeat the point of shipping vector.
    assert.doesNotMatch(svg, /data:image\/(png|jpeg)/i, `${path} must not embed a raster`);
  }
});

test('single-colour marks inherit the surrounding text colour', () => {
  /*
   * The design hard-codes #751132 on the icons and press logos and #fff /
   * #f5f4ea on the wordmarks. Inlined, that would ignore the section's colour
   * scheme -- the press logos sit on both cream and maroon in the design.
   */
  for (const name of RECOLOURABLE) {
    const svg = read(`assets/${name}`);
    assert.match(svg, /fill="currentColor"/, `${name} must use currentColor`);
    /*
     * Both paint attributes, and any hex -- not a list of the brand colours we
     * happened to think of. The first version of this check read `fill=` only,
     * so icon-benefit-freshly-roasted.svg shipped 17 visible paths carrying
     * fill="currentColor" next to stroke="#751132": the fills recoloured, the
     * outlines stayed maroon, and cream-on-maroon drew the icon in outline.
     * Codex caught it on PR #202; rendering the icon at color:#F5E9D7 over
     * maroon moved 24,577 px from maroon to cream once the strokes followed.
     */
    assert.doesNotMatch(
      svg,
      /(?:fill|stroke)="#[0-9a-f]{3,8}"/i,
      `${name} still hard-codes a paint colour`,
    );
  }
});

test('the two-tone badges keep the colours they were drawn with', () => {
  // Recolouring these would flatten the badge into one tone.
  for (const name of AS_DESIGNED) {
    assert.doesNotMatch(read(`assets/${name}`), /currentColor/, `${name} must stay as designed`);
  }
});

test('no design SVG carries artwork that cannot render', () => {
  /*
   * badge-new-harvest-sale.svg was exported with the whole 1920px artboard
   * nested inside it under opacity="0" -- 36 elements and half the file's
   * bytes, including an <image xlink:href="stripped"> that would 404 on every
   * inline. Invisible, so no test and no screenshot could see it. Codex, #202.
   */
  for (const name of [...RECOLOURABLE, ...AS_DESIGNED]) {
    const svg = read(`assets/${name}`);
    assert.doesNotMatch(svg, /opacity="0"/, `${name} hides a subtree nothing can render`);
    // Every href must stay in-document; an inlined SVG cannot resolve a
    // relative external reference, and the exporter leaves "stripped" behind.
    for (const [, target] of svg.matchAll(/(?:xlink:)?href="([^"]*)"/g)) {
      assert.ok(target.startsWith('#'), `${name} references "${target}" outside the document`);
    }
  }
});
