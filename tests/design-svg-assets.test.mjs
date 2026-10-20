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
    assert.doesNotMatch(
      svg,
      /fill="#(751132|fff|ffffff|f5f4ea)"/i,
      `${name} still hard-codes a brand colour`,
    );
  }
});

test('the two-tone badges keep the colours they were drawn with', () => {
  // Recolouring these would flatten the badge into one tone.
  for (const name of AS_DESIGNED) {
    assert.doesNotMatch(read(`assets/${name}`), /currentColor/, `${name} must stay as designed`);
  }
});
