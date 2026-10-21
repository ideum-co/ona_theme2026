import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const source = read('sections/header.liquid');

/*
 * Code only, same discipline as tests/product-faqs.test.mjs: the explanatory comment above the
 * sameAs capture names the thing a prose-blind guard would be fooled by, so strip comments before
 * asserting on the code.
 */
const code = source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');

const ldJsonStart = code.indexOf('<script type="application/ld+json">');
assert.ok(ldJsonStart > -1, 'the sitewide Organization schema block must still exist');
const ldJsonBlock = code.slice(ldJsonStart, code.indexOf('</script>', ldJsonStart));

test('Organization schema carries a sameAs array', () => {
  assert.match(ldJsonBlock, /"sameAs":\s*\{\{\s*organization_same_as\s*\}\}/, 'sameAs must be wired into the ld+json object');
});

test('sameAs captures exactly ONA\'s known live social profiles', () => {
  const captureStart = code.indexOf('{%- capture organization_same_as -%}');
  assert.ok(captureStart > -1, 'the sameAs capture block must exist');
  const captureBlock = code.slice(captureStart, code.indexOf('{%- endcapture -%}', captureStart));

  // Sourced from the live footer on 2026-10-21 -- see the comment above the capture in
  // sections/header.liquid for how these were found and why they're hard-coded rather than
  // read off a Liquid object at render time.
  for (const url of [
    'https://www.facebook.com/onacoffee/',
    'https://www.instagram.com/onacoffee/',
    'https://www.youtube.com/channel/UCvwLJ4owqt_I2QqqC2OE0_A',
  ]) {
    assert.ok(captureBlock.includes(url), `sameAs must include ${url}`);
  }

  // Guards against a silent drift back to an empty/placeholder array, which would validate as
  // JSON but defeat the entity-disambiguation purpose of the field.
  const urlCount = (captureBlock.match(/https:\/\//g) || []).length;
  assert.equal(urlCount, 3, 'sameAs should carry exactly the 3 known profiles -- update this test deliberately if ONA adds or removes one');
});

test('the capture itself parses as a JSON array of strings', () => {
  const captureStart = code.indexOf('{%- capture organization_same_as -%}') + '{%- capture organization_same_as -%}'.length;
  const captureEnd = code.indexOf('{%- endcapture -%}', captureStart);
  const raw = code.slice(captureStart, captureEnd).trim();
  const parsed = JSON.parse(raw);
  assert.ok(Array.isArray(parsed), 'organization_same_as must be a JSON array');
  assert.ok(parsed.every((url) => typeof url === 'string' && url.startsWith('https://')), 'every entry must be an https URL');
});
