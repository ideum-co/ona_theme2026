import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const source = read('sections/ona-bread-crumbs.liquid');

// Code only -- see tests/collection-itemlist-schema.test.mjs for why.
const code = source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');

const captureStart = code.indexOf('{%- capture crumb_link_items -%}');
assert.ok(captureStart > -1, 'the crumb_link_items capture must exist');
const captureEnd = code.indexOf('{%- endcapture -%}', captureStart) + '{%- endcapture -%}'.length;
const captureBlock = code.slice(captureStart, captureEnd);

const schemaGateStart = code.indexOf('{%- if crumb_link_items != blank -%}', captureEnd);
assert.ok(schemaGateStart > -1, 'the BreadcrumbList guard must exist after the capture, gated on the captured string');
const schemaEnd = code.indexOf('</script>', schemaGateStart) + '</script>'.length;
const schemaBlock = code.slice(schemaGateStart, schemaEnd);

/*
 * Peer review on #272 round 4: a prior version of this file gated the script on
 * `crumb_position > 0`, a counter assigned inside the {% for %}/{% capture %} and read back after
 * {% endcapture %}. That depends on Liquid leaking the assignment out of the capture's scope --
 * likely true, but unverified here, and the one thing a *gate* cannot afford to be wrong about: if
 * the leak didn't hold, crumb_position would read nil, `nil > 0` is false with no error in Liquid,
 * and the BreadcrumbList would vanish from the one page that uses this section -- silently, with
 * every text-pattern test in this file still green, because none of them execute Liquid.
 *
 * Fixed by capturing ONLY the link crumbs into crumb_link_items and gating on that string's
 * blankness: a capture's own target is guaranteed to exist, so there's nothing left to leak. The
 * current-page item is built and interpolated separately, after the gate, and still uses
 * crumb_position for its position NUMBER -- deliberately: if that specific leak somehow failed,
 * the failure mode is a visible, debuggable wrong number on one item, not a missing script. Gating
 * input and cosmetic input are held to different standards on purpose.
 *
 * The tests below can still only prove the text is pinned to this shape, not that Liquid's scoping
 * actually behaves as described -- that distinction is the other half of the lesson from this
 * round, and it's worth stating in the test file, not just the commit message.
 */
test('the script is gated on the captured crumb_link_items string, not a counter read back out of capture scope', () => {
  assert.doesNotMatch(code, /if crumb_position > 0 -%\}\s*\n\s*<script/, 'must not gate the script on crumb_position -- that depends on an assignment leaking out of {% capture %} scope, which is not a property this test (or anything else here) verifies');
  assert.match(schemaBlock, /application\/ld\+json/, 'the ld+json script must be inside the crumb_link_items != blank guard');
});

test('crumb_link_items captures only the link crumbs, not the current-page item', () => {
  assert.doesNotMatch(captureBlock, /current_name|current_url|current_position/, 'the current-page item must be built outside this capture, so the gate input (crumb_link_items) cannot be blank-but-nonempty from an unconditional trailing item');
});

test('the current-page item is appended after the gate, interpolated directly rather than captured', () => {
  const afterGate = code.slice(schemaGateStart);
  assert.match(afterGate, /assign current_position = crumb_position \| plus: 1/, 'current_position must still be derived from crumb_position (accepted residual use -- see file header comment)');
  assert.match(afterGate, /"itemListElement":\[\{\{ crumb_link_items \| strip \}\},\{"@type":"ListItem"/, 'the current-page ListItem must be appended directly after crumb_link_items in the itemListElement array, with a literal comma, not built inside another capture');
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

test('crumb_position increments only inside the content guard, so a skipped block cannot consume a position number', () => {
  const guardIndex = captureBlock.indexOf('if crumb_label != blank and crumb_target != blank');
  const incrementIndex = captureBlock.indexOf('assign crumb_position = crumb_position | plus: 1');
  assert.ok(incrementIndex > guardIndex, 'crumb_position must only increment after the blank check, inside its guard -- incrementing before validation is the bug this test exists to catch');
});

test('the comma before a link crumb is driven by crumb_position, not forloop.index, so a skipped block cannot produce malformed JSON', () => {
  assert.doesNotMatch(captureBlock, /if forloop\.index > 1/, 'the comma must not be keyed off forloop.index once blocks can be skipped for being blank');
  assert.match(captureBlock, /\{%-\s*if crumb_position > 1\s*-%\},\{%-\s*endif\s*-%\}/, 'the comma before a link crumb must be emitted only when a prior crumb was actually emitted');
});

test('iterates section.blocks directly, unlike the FAQ page -- this is a section-schema blocks array, not a theme block', () => {
  assert.match(captureBlock, /for block in section\.blocks/, 'must iterate section.blocks, the same array the visible <ul> loop iterates');
  assert.match(captureBlock, /if block\.type == 'link'/, "must filter to type == 'link', same as the visible loop");
});

test('positions start at 1 for link crumbs; the current page is always one past the last link crumb', () => {
  assert.match(captureBlock, /assign crumb_position = 0/, 'position counter must start at 0 before the loop so the first valid link block becomes position 1');
  const afterGate = code.slice(schemaGateStart);
  assert.match(afterGate, /assign current_position = crumb_position \| plus: 1/, 'the current-page item\'s position must be one past however many link crumbs actually survived, not a hard-coded number');
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
  const afterGate = code.slice(schemaGateStart);
  assert.match(afterGate, /current_crumb_label = section\.settings\.current_label \| default: page\.title/, 'the schema must use the identical fallback, via the `default` filter, so the two can never disagree about the current page\'s label');
});

test('all names and urls are escaped against JSON metacharacters and premature </script> termination', () => {
  assert.match(captureBlock, /crumb_name = crumb_label \| json \| replace: '<\/', '<\\\/'/, 'crumb_name must be escaped the same way as blocks/product-faqs.liquid, reading the already-validated crumb_label rather than block.settings.label directly');
  assert.match(captureBlock, /crumb_url = crumb_url_raw \| json \| replace: '<\/', '<\\\/'/, 'crumb_url must be escaped the same way');
  const afterGate = code.slice(schemaGateStart);
  assert.match(afterGate, /current_name = current_crumb_label \| json \| replace: '<\/', '<\\\/'/, 'current_name must be escaped the same way');
  assert.match(afterGate, /current_url = request\.origin \| append: page\.url \| json \| replace: '<\/', '<\\\/'/, 'current_url must be escaped the same way');
});
