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

test('schema is guarded on the exact same condition as the visible content it describes', () => {
  // templates/collection.json guards the visible accordion with `{% if faqs.size > 0 %}`.
  // This guards the schema with `collection_faqs.size > 0` on the same underlying value. Any
  // divergence between the two guards would let the schema and the visible content disagree.
  const guardIndex = faqBlock.indexOf('{%- if collection_faqs.size > 0 -%}');
  assert.ok(guardIndex > -1, 'must be guarded on collection_faqs.size > 0');
  const afterGuard = faqBlock.slice(guardIndex);
  assert.match(afterGuard, /application\/ld\+json/, 'the ld+json script must be inside the size>0 guard');
});

// This capture nests a second capture (faq_answer) inside it, so there are two
// {%- endcapture -%} tags in source order: the first closes faq_answer, the second closes
// collection_faq_questions. Taking the first one truncates the block before the question/answer
// JSON-building lines even exist in the slice -- which is exactly the "guard matched a prose
// description instead of the code" failure mode #269 warned about, just via index math instead
// of a stray comment. find the outer capture's matching close explicitly rather than the nearest one.
const captureStart = faqBlock.indexOf('{%- capture collection_faq_questions -%}');
const innerEndcaptureEnd = faqBlock.indexOf('{%- endcapture -%}', captureStart) + '{%- endcapture -%}'.length;
const outerCaptureBlock = faqBlock.slice(captureStart, faqBlock.indexOf('{%- endcapture -%}', innerEndcaptureEnd));

test('FAQPage mainEntity is built from the same for-loop over collection_faqs, question and answer both present', () => {
  assert.ok(captureStart > -1, 'the collection_faq_questions capture must exist');
  assert.match(outerCaptureBlock, /for faq in collection_faqs/, 'must iterate collection_faqs, the same list the visible accordion iterates');
  assert.match(outerCaptureBlock, /faq\.question/, 'must read faq.question');
  assert.match(outerCaptureBlock, /faq\.answer \| metafield_tag/, 'must read faq.answer through metafield_tag, same as the visible accordion -- a bare faq.answer would emit the raw rich-text JSON instead of rendered HTML');
});

test('question and answer are escaped against JSON metacharacters and premature </script> termination', () => {
  assert.match(outerCaptureBlock, /question_json = faq\.question \| json \| replace: '<\/', '<\\\/'/, 'question must be escaped the same way as blocks/product-faqs.liquid');
  assert.match(outerCaptureBlock, /answer_json = faq_answer \| strip \| json \| replace: '<\/', '<\\\/'/, 'answer must be escaped the same way as blocks/product-faqs.liquid');
});

test('is placed outside the {% paginate %} block -- FAQ content is collection-level, not page-scoped', () => {
  const paginateStart = code.indexOf('{% paginate collection.products by products_per_page %}');
  const paginateEnd = code.indexOf('{% endpaginate %}', paginateStart) + '{% endpaginate %}'.length;
  assert.ok(faqStart > paginateEnd, 'the FAQPage block must come after {% endpaginate %}, not inside it -- unlike ItemList, these FAQs do not change per page of pagination');
});
