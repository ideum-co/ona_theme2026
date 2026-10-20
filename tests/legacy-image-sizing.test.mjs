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
