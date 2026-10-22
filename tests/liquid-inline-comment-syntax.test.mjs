import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');

/*
 * sections/ona-bread-crumbs.liquid shipped to `main` in b8045f8 (#272) with a multi-line
 * `{%- # ... -%}` whose continuation lines did not start with `#`. Shopify's inline comment tag
 * requires every line to begin with `#` -- "or a syntax error will occur" -- so the platform
 * rejected the file on sync. The theme kept serving a version from 2026-10-15 while `main`,
 * every test, and the merge itself all looked healthy. Two other files from the same commit
 * synced in the same second, which is the only reason it was visible at all.
 *
 * Nothing in this suite could catch it: these tests match source text, they do not parse Liquid.
 * So this walks every .liquid file in the theme rather than naming the one we got burned by --
 * an enumerated list would only ever protect the file someone remembered.
 *
 * https://shopify.dev/docs/api/liquid/tags/comment
 */

const LIQUID_DIRS = ['sections', 'snippets', 'blocks', 'layout', 'templates'];

const liquidFiles = LIQUID_DIRS.flatMap((dir) => {
  let entries = [];
  try {
    entries = readdirSync(resolve(root, dir), { recursive: true, encoding: 'utf8' });
  } catch {
    return [];
  }
  return entries.filter((name) => name.endsWith('.liquid')).map((name) => `${dir}/${name}`);
});

test('the scan actually reaches the theme\'s liquid files', () => {
  assert.ok(
    liquidFiles.length > 50,
    `expected to walk the theme's liquid files, found only ${liquidFiles.length} -- a scan that silently matches nothing passes forever`,
  );
  assert.ok(
    liquidFiles.includes('sections/ona-bread-crumbs.liquid'),
    'the file this test exists because of must be in the walked set',
  );
});

test('every multi-line {% # %} inline comment starts each line with #, or Shopify rejects the file', () => {
  const offenders = [];

  for (const file of liquidFiles) {
    const source = readFileSync(resolve(root, file), 'utf8');
    for (const match of source.matchAll(/\{%-?\s*#(.*?)-?%\}/gs)) {
      const body = match[1];
      if (!body.includes('\n')) continue;
      const lines = body.split('\n');
      const line = source.slice(0, match.index).split('\n').length;
      for (const [offset, text] of lines.slice(1).entries()) {
        if (text.trim() && !text.trimStart().startsWith('#')) {
          offenders.push(`${file}:${line + offset + 1}  ${text.trim().slice(0, 70)}`);
        }
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `multi-line inline comments must start every line with '#' -- Shopify treats these as a syntax error and silently refuses to sync the file:\n  ${offenders.join('\n  ')}`,
  );
});
