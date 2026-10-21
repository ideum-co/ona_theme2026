import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const source = read('sections/ona-bread-crumbs.liquid');

// Code only -- see tests/collection-itemlist-schema.test.mjs for why.
const code = source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');

const schemaGuardStart = code.indexOf('{%- if section.blocks.size > 0 -%}');
assert.ok(schemaGuardStart > -1, 'the BreadcrumbList guard must exist');
const schemaEnd = code.indexOf('</script>', schemaGuardStart) + '</script>'.length;
const schemaBlock = code.slice(schemaGuardStart, schemaEnd);

test('schema is guarded on section.blocks.size > 0 -- a bare current-page <li> with no crumbs is not a trail worth describing', () => {
  assert.match(schemaBlock, /application\/ld\+json/, 'the ld+json script must be inside the blocks.size > 0 guard');
});

test('iterates section.blocks directly, unlike the FAQ page -- this is a section-schema blocks array, not a theme block', () => {
  assert.match(schemaBlock, /for block in section\.blocks/, 'must iterate section.blocks, the same array the visible <ul> loop iterates');
  assert.match(schemaBlock, /if block\.type == 'link'/, "must filter to type == 'link', same as the visible loop");
});

test('positions start at 1 and the current page is always last, after every link crumb', () => {
  assert.match(schemaBlock, /assign crumb_position = 0/, 'position counter must start at 0 before the loop so the first link block becomes position 1');
  assert.match(schemaBlock, /assign crumb_position = crumb_position \| plus: 1/, 'position must increment inside the loop, once per link block');
  assert.match(schemaBlock, /assign current_position = crumb_position \| plus: 1/, 'the current-page item\'s position must be one past however many link crumbs were actually counted, not a hard-coded number');
  const currentItemIndex = schemaBlock.indexOf('"name":{{ current_name }}');
  const loopEndIndex = schemaBlock.indexOf('{%- endfor -%}');
  assert.ok(currentItemIndex > loopEndIndex, 'the current-page ListItem must be emitted after the link-crumb loop, i.e. always last');
});

test('an internal (relative) crumb URL is made absolute; an external one is left as-is', () => {
  assert.match(schemaBlock, /if block\.settings\.url contains '\:\/\/'/, 'must branch on whether the URL already contains "://"');
  assert.match(schemaBlock, /crumb_url_raw = request\.origin \| append: block\.settings\.url/, 'a relative url (no ://) must be prefixed with request.origin');
  assert.match(schemaBlock, /crumb_url_raw = block\.settings\.url\s*-%\}\s*\{%-\s*else/, 'an already-absolute url must be used as-is (the if-branch), not double-prefixed');
});

test('current-page name falls back to page.title when current_label is blank, same as the visible <li>', () => {
  const visibleListStart = code.indexOf('<ul>');
  const visibleListEnd = code.indexOf('</ul>', visibleListStart) + '</ul>'.length;
  const visibleList = code.slice(visibleListStart, visibleListEnd);
  assert.match(visibleList, /current_label != blank.*page\.title/s, 'the visible <li> must still fall back to page.title when current_label is blank');
  assert.match(schemaBlock, /current_crumb_label = section\.settings\.current_label \| default: page\.title/, 'the schema must use the identical fallback, via the `default` filter, so the two can never disagree about the current page\'s label');
});

test('all names and urls are escaped against JSON metacharacters and premature </script> termination', () => {
  assert.match(schemaBlock, /crumb_name = block\.settings\.label \| json \| replace: '<\/', '<\\\/'/, 'crumb_name must be escaped the same way as blocks/product-faqs.liquid');
  assert.match(schemaBlock, /crumb_url = crumb_url_raw \| json \| replace: '<\/', '<\\\/'/, 'crumb_url must be escaped the same way');
  assert.match(schemaBlock, /current_name = current_crumb_label \| json \| replace: '<\/', '<\\\/'/, 'current_name must be escaped the same way');
  assert.match(schemaBlock, /current_url = request\.origin \| append: page\.url \| json \| replace: '<\/', '<\\\/'/, 'current_url must be escaped the same way');
});
