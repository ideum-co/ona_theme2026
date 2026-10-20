import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

/*
 * The ported sections each invented their own type scale: maxima of 80px, 76px,
 * 60px, 58px, 43px, 36px and 18px, against a theme whose scale is h1 48-56,
 * h2 36-48, h3 32, h4 24 and body 14.
 *
 * Measured on the live theme at a 1685px viewport, /pages/locations rendered a
 * section heading at 72px against a page <h1> of 48px -- the hierarchy was
 * inverted -- while the homepage's largest heading was 48px. That is the
 * difference between a page that belongs to this site and one that does not.
 */

/*
 * sections/locations-flagships.liquid still carries two invented clamps
 * (4.5rem and 3.5rem) and is deliberately absent here: PR #231 is rewriting
 * that file's tablist, and converting its type in parallel would mean
 * resolving the same hunk twice. It joins this list in the follow-up, which is
 * the commit that converts it.
 */
const FILES = [
  'assets/legacy-page-layout.css',
  'sections/locations-store-finder.liquid',
  'sections/ona-page-media-gallery.liquid',
];

test('no section invents its own type scale', () => {
  const offenders = [];
  for (const file of FILES) {
    for (const m of read(file).matchAll(/font-size:\s*clamp\(([^)]*)\)/g)) {
      offenders.push(`${file}: clamp(${m[1]})`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `type comes from --font-*--size, so these pages follow the theme's scale:\n  ${offenders.join('\n  ')}`,
  );
});

test('headings reference the scale rather than copying a size', () => {
  const sheet = read('assets/legacy-page-layout.css');
  assert.match(sheet, /font-size:var\(--font-h1--size/, 'page heroes take the h1 token');
  assert.match(sheet, /font-size:var\(--font-h2--size/, 'section headings take the h2 token');
  assert.match(sheet, /font-size:var\(--font-h3--size/, 'sub-headings take the h3 token');
  assert.match(sheet, /font-size:var\(--font-paragraph--size/, 'body copy takes the paragraph token');

  /*
   * Each reference carries the token's own maximum as a fallback. A missing
   * variable makes the declaration invalid at computed-value time, which drops
   * it entirely and leaves a heading inheriting body size.
   */
  const refs = [...sheet.matchAll(/font-size:var\(--font-[a-z0-9-]+--size([^)]*)\)/g)].map((m) => m[1]);
  assert.ok(refs.length >= 4, 'expected several token references');
  const bare = refs.filter((r) => !r.trim().startsWith(','));
  assert.deepEqual(bare, [], 'every token reference needs a fallback size');
});

test('no page template re-declares a size the token already clamps', () => {
  /*
   * The mobile block carried its own `.about .right-box h3` font-size purely to
   * shrink an invented desktop value. The token clamps on its own, so a second
   * declaration just reintroduces the second scale this change removes.
   */
  const sheet = read('assets/legacy-page-layout.css');
  const inMedia = [...sheet.matchAll(/@media[^{]*\{([\s\S]*?)\n\}/g)].map((m) => m[1]);
  const sized = inMedia.flatMap((block) => [...block.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim()));
  const invented = sized.filter((v) => !v.startsWith('var(--font-'));
  assert.deepEqual(invented, [], `media blocks must not set sizes outside the scale: ${invented.join(', ')}`);
});
