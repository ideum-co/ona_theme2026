import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const readTemplate = (name) => JSON.parse(readFileSync(resolve(root, name), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));

/*
 * templates/collection.json's "faqs" section is a custom-liquid block (its markup lives as a
 * *string* inside this JSON file, not as a .liquid file -- which is why an SEO audit twice
 * concluded this content was unrendered: grepping --include=*.liquid cannot see Liquid embedded
 * in a JSON template). sections/main-collection.liquid emits FAQPage structured data describing
 * exactly this section's output, reading the same collection.metafields.custom.faqs metafield.
 *
 * The two are coupled only by convention, not by any mechanism the platform enforces -- and
 * templates/collection.json is shop-owned (docs/branching-and-release.md §5): the theme editor
 * can remove the section, disable it, or rewrite the block's content at any time, through a
 * surface this test suite has no visibility into except by re-reading the file.
 *
 * This guard exists so that if an editor change strands the schema -- removes the faqs section,
 * drops it from `order`, or rewrites the custom_liquid to read a different metafield -- the
 * suite fails and says so, instead of main-collection.liquid quietly describing content that no
 * longer exists on the page. That is a real Google structured-data violation (FAQPage content
 * must be visible on the page), not just a cosmetic drift.
 */
const collectionTemplate = readTemplate('templates/collection.json');

test('the faqs section exists and is enabled (present in order) on templates/collection.json', () => {
  assert.ok(collectionTemplate.sections.faqs, 'templates/collection.json must still declare a "faqs" section');
  assert.ok(
    collectionTemplate.order.includes('faqs'),
    'the faqs section must still be in `order` -- a section present in `sections` but absent from `order` does not render, which would strand the FAQPage schema in sections/main-collection.liquid describing content no longer on the page',
  );
});

test('the faqs section\'s block still reads collection.metafields.custom.faqs', () => {
  const body = collectionTemplate.sections.faqs?.blocks?.body;
  assert.ok(body, 'the faqs section must still have its "body" custom-liquid block');
  assert.ok(
    collectionTemplate.sections.faqs.block_order?.includes('body'),
    'the body block must still be in the faqs section\'s block_order, or it will not render even though it exists',
  );
  assert.match(
    body.settings.custom_liquid,
    /collection\.metafields\.custom\.faqs/,
    'the rendered accordion must still read collection.metafields.custom.faqs -- the exact metafield sections/main-collection.liquid\'s FAQPage schema also reads. If this changes, the schema needs the matching change in the same PR.',
  );
});
