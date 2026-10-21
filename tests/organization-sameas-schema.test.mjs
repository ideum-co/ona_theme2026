import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const readTemplate = (name) => JSON.parse(read(name).replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));
const source = read('sections/header.liquid');

/*
 * sections/header-group.json is the one truth for these URLs -- the block that actually renders
 * them, two levels of nested theme block deep (header_section > header-menu > header-menu-social),
 * which is exactly why sameAs can't read them live: Liquid has no accessor from header.liquid down
 * into a nested block's settings (same limitation as the FAQ page's Q&A blocks). Asserting against
 * this file instead of against string literals means an editor change to the social links fails
 * this test loudly instead of leaving sameAs quietly lying about the entity -- the "Caramel,
 * biscuits" class of bug. header-group.json is itself editor-writable and has been dropped by the
 * sync before (sections/footer-group.json / PR #263), so this catches repo-internal drift between
 * the capture and this file, not repo-vs-live drift -- still strictly more protective than literals.
 */
const headerGroup = readTemplate('sections/header-group.json');
const socialSettings = headerGroup.sections.header_section.blocks['header-menu'].blocks['header-menu-social'].settings;
const liveSocialUrls = Object.entries(socialSettings)
  .filter(([key, value]) => key.endsWith('_url') && value !== '')
  .map(([, value]) => value)
  .sort();

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

test('sameAs matches exactly the non-empty social URLs in sections/header-group.json', () => {
  const captureStart = code.indexOf('{%- capture organization_same_as -%}') + '{%- capture organization_same_as -%}'.length;
  const captureEnd = code.indexOf('{%- endcapture -%}', captureStart);
  const raw = code.slice(captureStart, captureEnd).trim();
  const captured = JSON.parse(raw).slice().sort();

  assert.deepEqual(
    captured,
    liveSocialUrls,
    'sameAs has drifted from sections/header-group.json -- if a social link changed in the theme editor, update the capture in sections/header.liquid to match (and re-verify against the live footer, since this file itself can drift from production, per the sync-drop history on footer-group.json / PR #263)',
  );
});

test('the capture itself parses as a JSON array of https URLs', () => {
  const captureStart = code.indexOf('{%- capture organization_same_as -%}') + '{%- capture organization_same_as -%}'.length;
  const captureEnd = code.indexOf('{%- endcapture -%}', captureStart);
  const raw = code.slice(captureStart, captureEnd).trim();
  const parsed = JSON.parse(raw);
  assert.ok(Array.isArray(parsed), 'organization_same_as must be a JSON array');
  assert.ok(parsed.length > 0, 'sameAs must not be empty -- an empty array defeats the entity-disambiguation purpose of the field');
  assert.ok(parsed.every((url) => typeof url === 'string' && url.startsWith('https://')), 'every entry must be an https URL');
});
