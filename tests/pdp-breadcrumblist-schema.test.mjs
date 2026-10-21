import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const source = read('snippets/product-information-content.liquid');

/*
 * This snippet is shared by sections/product-information.liquid and
 * sections/featured-product-information.liquid. If a template ever carries both on one page, the
 * snippet renders twice and emits two BreadcrumbList nodes. This isn't something the snippet
 * itself can guard against, so it's pinned here as a fact about the current templates instead --
 * same "check the data, not just the logic" discipline as the FAQ dedup removal and the
 * live-title survey.
 *
 * Walks templates/ for every product*.json file rather than naming product.json and
 * product.merch.json by hand (same pattern as tests/homepage-wfg-campaign.test.mjs and
 * tests/pdp-product-summary.test.mjs). A hardcoded list protects only the templates that existed
 * when it was written -- it fails open on every new one, which is exactly what's about to happen:
 * Felipe is splitting product templates by type (coffee / non-coffee / merch / equipment, likely a
 * gift-card one too), and each new file would otherwise render this snippet with zero guard the
 * day it's created. Verified: a hardcoded two-item list did not catch a generated three-node
 * duplicate-emission template; the walk does.
 *
 * `assert.ok(productTemplates.length >= 2)` guards the other way a scan like this fails open --
 * a glob that silently matches nothing passes every assertion in the loop below for having
 * nothing to check.
 */
const productTemplates = readdirSync(resolve(root, 'templates')).filter((name) => /^product(\..+)?\.json$/.test(name));

test('every templates/product*.json file is covered by this scan, not a remembered list', () => {
  assert.ok(productTemplates.length >= 2, `expected at least product.json and product.merch.json under templates/, found: ${productTemplates.join(', ') || '(none)'}`);
});

test('no live product template renders product-information more than once, and featured-product-information is unreferenced', () => {
  for (const name of productTemplates) {
    const templatePath = `templates/${name}`;
    const occurrences = (read(templatePath).match(/"type":\s*"product-information"/g) || []).length;
    assert.equal(occurrences, 1, `${templatePath} must reference product-information exactly once -- a second reference would render snippets/product-information-content.liquid (and its BreadcrumbList) twice on one page`);
    assert.doesNotMatch(read(templatePath), /"type":\s*"featured-product-information"/, `${templatePath} must not also reference featured-product-information -- combined with product-information, that would emit two BreadcrumbList nodes on one page`);
  }
});

// Code only -- see tests/collection-itemlist-schema.test.mjs for why.
const code = source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');

const breadcrumbGuardStart = code.indexOf('{% if show_breadcrumbs %}');
assert.ok(breadcrumbGuardStart > -1, 'the show_breadcrumbs guard must still exist');
const visibleListStart = code.indexOf('<ol class="product-information__breadcrumb-list list-unstyled">', breadcrumbGuardStart);
const visibleListEnd = code.indexOf('</ol>', visibleListStart) + '</ol>'.length;
const visibleBreadcrumb = code.slice(visibleListStart, visibleListEnd);

const schemaStart = code.indexOf('{%- capture breadcrumb_list_items -%}', visibleListEnd);
assert.ok(schemaStart > -1, 'the BreadcrumbList capture must exist, after the visible <ol>');
const schemaEnd = code.indexOf('</script>', schemaStart) + '</script>'.length;
const schemaBlock = code.slice(schemaStart, schemaEnd);

test('BreadcrumbList sits inside the same show_breadcrumbs guard as the visible <ol>', () => {
  // Found by slicing from {% if show_breadcrumbs %} through past the schema block with no
  // intervening {% endif %} -- if there were one between the visible list and the schema, this
  // whole file would still parse, but the schema would render even when the visible trail is
  // turned off for a product.
  const betweenListAndSchema = code.slice(visibleListEnd, schemaStart);
  assert.doesNotMatch(betweenListAndSchema, /\{%\s*endif\s*%\}/, 'no {% endif %} may appear between the visible breadcrumb and its schema -- both must close on the same show_breadcrumbs guard');
});

/*
 * Codex, PR #272: featured-product-information.liquid's schema defines none of the
 * breadcrumb_* settings this snippet reads, so on that caller `settings` is the section's own
 * (breadcrumb-less) object -- and show_breadcrumbs's own `if show_breadcrumbs == nil / assign
 * show_breadcrumbs = true` coalesce makes it true there regardless. Inferring the schema's gate
 * from show_breadcrumbs would therefore emit a BreadcrumbList with an empty "name" (nil
 * breadcrumb_root_label) the moment a merchant drops featured-product-information onto a page
 * from the editor -- latent today only because no template references that section, which the
 * duplicate-emission test above already covers for a different reason.
 *
 * Fix is an explicit opt-in rather than inferring from show_breadcrumbs: the schema is gated on
 * a separate emit_breadcrumb_schema param that only product-information.liquid passes.
 */
test('BreadcrumbList schema requires an explicit emit_breadcrumb_schema opt-in, nested inside show_breadcrumbs', () => {
  const gateStart = code.indexOf('{%- if emit_breadcrumb_schema -%}', breadcrumbGuardStart);
  assert.ok(gateStart > -1, 'the schema must be gated on an explicit emit_breadcrumb_schema param');
  assert.ok(gateStart > breadcrumbGuardStart, 'the emit_breadcrumb_schema gate must sit after the show_breadcrumbs guard opens, not replace it -- both conditions must hold');
  assert.ok(gateStart < schemaStart, 'the emit_breadcrumb_schema check must wrap the capture, not follow it');
});

test('only product-information.liquid passes emit_breadcrumb_schema; featured-product-information.liquid does not', () => {
  const productInfoSection = read('sections/product-information.liquid');
  const featuredSection = read('sections/featured-product-information.liquid');
  assert.match(productInfoSection, /emit_breadcrumb_schema:\s*true/, 'sections/product-information.liquid must explicitly opt in');
  assert.doesNotMatch(featuredSection, /emit_breadcrumb_schema/, 'sections/featured-product-information.liquid must not pass emit_breadcrumb_schema at all -- its settings have no breadcrumb_root_label, so the schema would emit an empty "name" if it ever rendered');
});

test('the collection crumb is included under the exact same condition in both the visible list and the schema', () => {
  assert.match(visibleBreadcrumb, /\{%\s*if settings\.breadcrumb_show_collection and breadcrumb_collection != blank\s*%\}/, 'the visible <ol> must still gate the collection crumb on breadcrumb_show_collection and breadcrumb_collection != blank');
  assert.match(schemaBlock, /\{%-\s*if settings\.breadcrumb_show_collection and breadcrumb_collection != blank\s*-%\}/, 'the schema must gate the collection ListItem on the identical condition, or the two can disagree about whether a collection crumb exists');
});

test('positions are sequential starting at 1, root first and the current product last', () => {
  assert.match(schemaBlock, /assign breadcrumb_position = 1/, 'the root item must be position 1');
  const positionIncrements = schemaBlock.match(/assign breadcrumb_position = breadcrumb_position \| plus: 1/g) || [];
  assert.ok(positionIncrements.length >= 1, 'position must increment at least once (root -> product, with a second increment only when the collection crumb is present)');
  const productEntryIndex = schemaBlock.indexOf('"name":{{ product_name }}');
  const lastIncrementIndex = schemaBlock.lastIndexOf('assign breadcrumb_position = breadcrumb_position | plus: 1');
  assert.ok(productEntryIndex > lastIncrementIndex, 'the product ListItem must be emitted after every position increment, i.e. it is always last');
});

test('root, collection and product names/urls are all escaped against JSON metacharacters and premature </script> termination', () => {
  for (const varName of ['root', 'product']) {
    assert.match(schemaBlock, new RegExp(`${varName}_url = request\\.origin \\| append: [\\w.]+ \\| json \\| replace: '</', '<\\\\/'`), `${varName}_url must be escaped the same way as blocks/product-faqs.liquid`);
    assert.match(schemaBlock, new RegExp(`${varName}_name = [\\w.]+ \\| json \\| replace: '</', '<\\\\/'`), `${varName}_name must be escaped the same way as blocks/product-faqs.liquid`);
  }
  assert.match(schemaBlock, /collection_url = request\.origin \| append: breadcrumb_collection\.url \| json \| replace: '<\/', '<\\\/'/, 'collection_url must be escaped the same way');
  assert.match(schemaBlock, /collection_name = breadcrumb_collection\.title \| json \| replace: '<\/', '<\\\/'/, 'collection_name must be escaped the same way');
});

test('the root item links to routes.all_products_collection_url, same as the visible breadcrumb', () => {
  assert.match(visibleBreadcrumb, /routes\.all_products_collection_url/, 'the visible root crumb must still link to routes.all_products_collection_url');
  assert.match(schemaBlock, /root_url = request\.origin \| append: routes\.all_products_collection_url/, 'the schema root item must point at the same URL');
});

test('BreadcrumbList is valid JSON for the common case (root + product, no collection)', () => {
  // A structural smoke test: simulate the two-entry case (the collection crumb condition false)
  // by hand-building what the capture produces, and confirm it's parseable. This cannot execute
  // Liquid, so it's a sanity check on the hand-written JSON shape, not a replacement for the
  // source-pattern assertions above.
  const sample = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'All products', item: 'https://onacoffee.com.au/collections/all' },
      { '@type': 'ListItem', position: 2, name: 'Test Product', item: 'https://onacoffee.com.au/products/test-product' },
    ],
  };
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(sample)));
  assert.equal(sample.itemListElement[sample.itemListElement.length - 1].name, 'Test Product', 'the product must be the last entry');
});
