import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const source = read('sections/main-collection.liquid');

// Code only -- see tests/collection-itemlist-schema.test.mjs for why.
const code = source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');

const faqStart = code.indexOf('{%- assign collection_faqs = collection.metafields.custom.faqs.value -%}');
assert.ok(faqStart > -1, 'the collection FAQPage block must exist');
const faqBlock = code.slice(faqStart, code.indexOf('{% schema %}', faqStart));

test('reads the exact same metafield templates/collection.json\'s custom-liquid block renders', () => {
  // templates/collection.json's "faqs" section reads `closest.collection.metafields.custom.faqs.value`.
  // This section reads `collection.metafields.custom.faqs.value` directly (no `closest.` needed --
  // main-collection.liquid is the section itself, not a nested block). Same metafield either way;
  // schema describing different data than what's on the page would be worse than no schema.
  assert.match(faqBlock, /collection\.metafields\.custom\.faqs\.value/, 'must read collection.metafields.custom.faqs');
});

// This capture nests a second capture (`answer`) inside it, so there are two {%- endcapture -%}
// tags in source order: the first closes `answer`, the second closes `collection_faq_questions`.
// Taking the first one truncates the block before the question/answer JSON-building lines even
// exist in the slice -- the "guard matched a prose description instead of the code" failure mode
// #269 warned about, just via index math instead of a stray comment. Find the outer capture's
// matching close explicitly rather than the nearest one (same lesson as the first draft of this
// file, which made exactly this mistake once already).
const captureStart = faqBlock.indexOf('{%- capture collection_faq_questions -%}');
assert.ok(captureStart > -1, 'the collection_faq_questions capture must exist');
const innerEndcaptureEnd = faqBlock.indexOf('{%- endcapture -%}', captureStart) + '{%- endcapture -%}'.length;
const outerCaptureBlock = faqBlock.slice(captureStart, faqBlock.indexOf('{%- endcapture -%}', innerEndcaptureEnd));

test('FAQPage mainEntity is built from the same for-loop over collection_faqs, question and answer both read', () => {
  assert.match(outerCaptureBlock, /for faq in collection_faqs/, 'must iterate collection_faqs, the same list the visible accordion iterates');
  assert.match(outerCaptureBlock, /assign question = faq\.question \| strip/, 'must read faq.question');
  assert.match(outerCaptureBlock, /capture answer -%\}\{\{ faq\.answer \| metafield_tag \}\}/, 'must read faq.answer through metafield_tag, same as the visible accordion -- a bare faq.answer would emit the raw rich-text JSON instead of rendered HTML');
});

test('a blank question or a blank answer is skipped -- ported from blocks/product-faqs.liquid (Codex, #271)', () => {
  // A metaobject reference whose entry is half-filled in the admin comes back with a blank
  // field, not an absent one, so the guard has to test content, not presence. Every live
  // faq_item entry happens to be fully filled in today, so this is a latent bug until the first
  // half-finished admin save -- exactly the failure blocks/product-faqs.liquid's own guard was
  // written to prevent, and the one the first version of this file omitted.
  assert.match(outerCaptureBlock, /assign answer_text = answer \| strip_html \| strip/, 'must derive a stripped-text version of the answer to test for blankness, same as blocks/product-faqs.liquid');
  const entryGuardMatch = outerCaptureBlock.match(/\{%-\s*if question != blank and answer_text != blank and already_seen == false\s*-%\}/);
  assert.ok(entryGuardMatch, 'each entry must be guarded on question != blank and answer_text != blank before it is emitted');
});

test('the comma is driven by a described counter, not forloop.index, so a skipped entry cannot produce malformed JSON', () => {
  // This is the part that actually bites: filtering blank entries while still keying the comma
  // off forloop.index produces a leading comma when entry 1 is skipped, or a double comma when a
  // middle entry is skipped -- both invalid JSON, which is worse than the blank field this guard
  // exists to fix. `described` only increments for entries that actually get emitted, so the
  // comma logic can never see a gap.
  assert.doesNotMatch(outerCaptureBlock, /if forloop\.index > 1/, 'the comma must not be keyed off forloop.index once entries can be skipped');
  assert.match(outerCaptureBlock, /assign described = 0/, 'a described counter must be initialised before the loop');
  assert.match(outerCaptureBlock, /if described > 0.*-%\},\{%-\s*endif/, 'the comma must be emitted only when a prior entry was actually described');
  assert.match(outerCaptureBlock, /assign described = described \| plus: 1/, 'described must increment only inside the content guard, i.e. only for entries that are actually emitted');
});

test('an exact-duplicate question within one collection\'s list is skipped once, not emitted twice', () => {
  // The faq_item metaobject type has at least one known duplicate pair
  // (can-i-choose-the-exact-coffee / -1, ONAIN-47). If a collection's faqs list ever referenced
  // both, this stops two identical Question nodes from landing in one FAQPage.
  assert.match(outerCaptureBlock, /assign seen_faq_questions = ''/, 'must track questions already emitted for this collection');
  assert.match(outerCaptureBlock, /seen_faq_questions contains question/, 'must check the current question against what has already been emitted');
  assert.match(outerCaptureBlock, /already_seen == false/, 'the duplicate check must gate emission, not just get computed and ignored');
});

test('question and answer are escaped against JSON metacharacters and premature </script> termination', () => {
  assert.match(outerCaptureBlock, /question_json = question \| json \| replace: '<\/', '<\\\/'/, 'question must be escaped the same way as blocks/product-faqs.liquid');
  assert.match(outerCaptureBlock, /answer_json = answer \| strip \| json \| replace: '<\/', '<\\\/'/, 'answer must be escaped the same way as blocks/product-faqs.liquid');
});

test('the script is guarded on the captured output being non-blank, not on collection_faqs.size', () => {
  // collection_faqs.size > 0 does not mean anything will actually render -- every entry could
  // fail the blank-question/blank-answer check above. Testing the captured markup itself is the
  // one guard that cannot drift from what is actually emitted, same discipline as
  // blocks/product-faqs.liquid's own `{%- if faq_items != blank -%}`.
  const guardIndex = faqBlock.indexOf('{%- if collection_faq_questions != blank -%}');
  assert.ok(guardIndex > -1, 'must be guarded on collection_faq_questions != blank');
  assert.doesNotMatch(faqBlock, /if collection_faqs\.size > 0/, 'must not gate on collection_faqs.size -- that count can be nonzero while every entry fails the content guard');
  const afterGuard = faqBlock.slice(guardIndex);
  assert.match(afterGuard, /application\/ld\+json/, 'the ld+json script must be inside the blank guard');
});

test('is placed outside the {% paginate %} block -- FAQ content is collection-level, not page-scoped', () => {
  const paginateStart = code.indexOf('{% paginate collection.products by products_per_page %}');
  const paginateEnd = code.indexOf('{% endpaginate %}', paginateStart) + '{% endpaginate %}'.length;
  assert.ok(faqStart > paginateEnd, 'the FAQPage block must come after {% endpaginate %}, not inside it -- unlike ItemList, these FAQs do not change per page of pagination');
});
