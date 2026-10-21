import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const source = read('sections/ona-bread-crumbs.liquid');

// Code only -- see tests/collection-itemlist-schema.test.mjs for why.
const code = source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');

const captureStart = code.indexOf('{%- capture crumb_list_items -%}');
assert.ok(captureStart > -1, 'the crumb_list_items capture must exist');
const captureEnd = code.indexOf('{%- endcapture -%}', captureStart) + '{%- endcapture -%}'.length;
const captureBlock = code.slice(captureStart, captureEnd);

const schemaGateStart = code.indexOf('{%- if crumb_position > 0 -%}', captureEnd);
assert.ok(schemaGateStart > -1, 'the BreadcrumbList guard must exist after the capture');
const schemaEnd = code.indexOf('</script>', schemaGateStart) + '</script>'.length;
const schemaBlock = code.slice(schemaGateStart, schemaEnd);

test('script is gated on crumb_position > 0, not section.blocks.size -- block count does not mean any block survives the content check', () => {
  // Codex, PR #272 round 3: section.blocks.size > 0 was the old gate, but both label and url are
  // optional in this block's schema, so a block can exist and still be entirely blank. Testing
  // crumb_position (incremented only for emitted link crumbs) after the capture runs is the one
  // guard that reflects what was actually produced, same reason the collection FAQPage schema
  // gates on its captured output rather than collection_faqs.size.
  assert.doesNotMatch(code, /if section\.blocks\.size > 0/, 'must not gate on section.blocks.size -- a block existing does not mean it has content');
  assert.match(schemaBlock, /application\/ld\+json/, 'the ld+json script must be inside the crumb_position > 0 guard');
});

test('a link block with a blank label or blank url is skipped, not emitted with a null name or empty item', () => {
  // Codex, PR #272 round 3: the loop used to emit unconditionally for every block.type == 'link',
  // so a half-filled block (label or url left blank in the editor -- neither is `required` in the
  // schema) produced "name":null or "item":"<origin>" with nothing appended. Same class of bug as
  // blocks/product-faqs.liquid's blank-question/answer guard, fixed the same way: validate before
  // emitting, not after.
  assert.match(captureBlock, /assign crumb_label = block\.settings\.label \| strip/, 'must read and strip the label before using it');
  assert.match(captureBlock, /assign crumb_target = block\.settings\.url/, 'must read the url into its own variable before using it');
  assert.match(captureBlock, /\{%-\s*if crumb_label != blank and crumb_target != blank\s*-%\}/, 'each link block must be guarded on both crumb_label and crumb_target being non-blank before it is emitted');
});

test('crumb_position increments only inside the content guard, so a skipped block cannot consume a position number or shift the current-page item', () => {
  // The part Codex's finding understated: incrementing position BEFORE validation (the old code)
  // meant a blank block still consumed a position number, so the comma logic stayed "correct"
  // around an entry that should not exist, and the current-page item inherited the wrong position.
  const guardIndex = captureBlock.indexOf('if crumb_label != blank and crumb_target != blank');
  const incrementIndex = captureBlock.indexOf('assign crumb_position = crumb_position | plus: 1');
  assert.ok(incrementIndex > guardIndex, 'crumb_position must only increment after the blank check, inside its guard -- incrementing before validation is the bug this test exists to catch');
});

test('the comma before a link crumb is driven by crumb_position, not forloop.index, so a skipped block cannot produce malformed JSON', () => {
  assert.doesNotMatch(captureBlock, /if forloop\.index > 1/, 'the comma must not be keyed off forloop.index once blocks can be skipped for being blank');
  assert.match(captureBlock, /\{%-\s*if crumb_position > 1\s*-%\},\{%-\s*endif\s*-%\}/, 'the comma before a link crumb must be emitted only when a prior crumb was actually emitted');
});

test('the current-page item\'s leading comma depends on whether any link crumb was actually emitted', () => {
  // The current-page ListItem is always appended unconditionally (there is always a current page),
  // but its own leading comma must still reflect crumb_position -- otherwise a page with zero valid
  // link crumbs (but the capture still running) would produce a leading comma before the only item.
  const currentItemIndex = captureBlock.indexOf('"name":{{ current_name }}');
  const currentCommaGuard = captureBlock.lastIndexOf('{%- if crumb_position > 0 -%},{%- endif -%}', currentItemIndex);
  assert.ok(currentCommaGuard > -1 && currentCommaGuard < currentItemIndex, 'the current-page item must be preceded by a crumb_position > 0 comma guard');
});

test('iterates section.blocks directly, unlike the FAQ page -- this is a section-schema blocks array, not a theme block', () => {
  assert.match(captureBlock, /for block in section\.blocks/, 'must iterate section.blocks, the same array the visible <ul> loop iterates');
  assert.match(captureBlock, /if block\.type == 'link'/, "must filter to type == 'link', same as the visible loop");
});

test('positions start at 1 and the current page is always last, after every link crumb', () => {
  assert.match(captureBlock, /assign crumb_position = 0/, 'position counter must start at 0 before the loop so the first valid link block becomes position 1');
  assert.match(captureBlock, /assign current_position = crumb_position \| plus: 1/, 'the current-page item\'s position must be one past however many link crumbs actually survived, not a hard-coded number');
  const currentItemIndex = captureBlock.indexOf('"name":{{ current_name }}');
  const loopEndIndex = captureBlock.indexOf('{%- endfor -%}');
  assert.ok(currentItemIndex > loopEndIndex, 'the current-page ListItem must be emitted after the link-crumb loop, i.e. always last');
});

test('an internal (relative) crumb URL is made absolute; an external one is left as-is', () => {
  assert.match(captureBlock, /if crumb_target contains '\:\/\/'/, 'must branch on whether the URL already contains "://"');
  assert.match(captureBlock, /crumb_url_raw = request\.origin \| append: crumb_target/, 'a relative url (no :// and no leading //) must be prefixed with request.origin');
  assert.match(captureBlock, /crumb_url_raw = crumb_target\s*-%\}\s*\{%-\s*else/, 'an already-absolute url (:// present) must be used as-is (the if-branch), not double-prefixed');
});

test('a protocol-relative crumb URL (//host/path) is also treated as absolute, not double-prefixed with origin', () => {
  // Codex, PR #272 round 3: `contains '://'` is false for "//docs.example.com/path" (no "://" at
  // all), so the old code would have prepended request.origin and produced
  // "https://onacoffee.com.au//docs.example.com/path" -- a URL that silently disagrees with the
  // visible <a href>, which is exactly what BreadcrumbList validators check for.
  assert.match(captureBlock, /assign crumb_target_prefix = crumb_target \| slice: 0, 2/, 'must slice the first two characters to detect a protocol-relative URL');
  assert.match(captureBlock, /if crumb_target contains '\:\/\/' or crumb_target_prefix == '\/\/'/, 'the absolute-URL check must also match a bare "//" prefix, not only "://"');
});

test('current-page name falls back to page.title when current_label is blank, same as the visible <li>', () => {
  const visibleListStart = code.indexOf('<ul>');
  const visibleListEnd = code.indexOf('</ul>', visibleListStart) + '</ul>'.length;
  const visibleList = code.slice(visibleListStart, visibleListEnd);
  assert.match(visibleList, /current_label != blank.*page\.title/s, 'the visible <li> must still fall back to page.title when current_label is blank');
  assert.match(captureBlock, /current_crumb_label = section\.settings\.current_label \| default: page\.title/, 'the schema must use the identical fallback, via the `default` filter, so the two can never disagree about the current page\'s label');
});

test('all names and urls are escaped against JSON metacharacters and premature </script> termination', () => {
  assert.match(captureBlock, /crumb_name = crumb_label \| json \| replace: '<\/', '<\\\/'/, 'crumb_name must be escaped the same way as blocks/product-faqs.liquid, reading the already-validated crumb_label rather than block.settings.label directly');
  assert.match(captureBlock, /crumb_url = crumb_url_raw \| json \| replace: '<\/', '<\\\/'/, 'crumb_url must be escaped the same way');
  assert.match(captureBlock, /current_name = current_crumb_label \| json \| replace: '<\/', '<\\\/'/, 'current_name must be escaped the same way');
  assert.match(captureBlock, /current_url = request\.origin \| append: page\.url \| json \| replace: '<\/', '<\\\/'/, 'current_url must be escaped the same way');
});
