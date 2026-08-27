import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../snippets/header-megamenu.liquid', import.meta.url), 'utf8');

test('spreads primary links and social logos across the mega-menu height', () => {
  assert.match(
    source,
    /\.header-megamenu__primary-column\s*\{[^}]*justify-content:\s*space-between\s*;/,
  );
});

test('aligns the desktop mega-menu panel with a ten-percent left inset', () => {
  assert.match(source, /\.header-megamenu__panel\s*\{[^}]*padding-left:\s*10%\s*;/);
});
