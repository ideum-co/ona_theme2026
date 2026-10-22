import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

/*
 * The main menu is shop data, shared with the live theme, so an anchor it
 * points at has to exist in this theme's markup -- it cannot be fixed by
 * editing the menu without breaking live.
 *
 * "Locations > ONA Flagships" points at /pages/locations#flagships_content.
 * Confirmed on 2026-10-20: that id resolves on the live theme and existed
 * nowhere on this one, so the menu item dropped visitors at the top of the
 * store finder. The link returned 200 throughout, which is why no link checker
 * would ever have caught it.
 */
test('every anchor the main menu points at exists in the theme', () => {
  const anchors = [
    { id: 'flagships_content', file: 'sections/locations-flagships.liquid', menu: 'Locations > ONA Flagships' },
  ];

  for (const { id, file, menu } of anchors) {
    assert.match(
      read(file),
      new RegExp(`\\bid="${id}"`),
      `"${menu}" links to #${id}, which must exist in ${file}`,
    );
  }
});
