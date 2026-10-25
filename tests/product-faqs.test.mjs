import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const source = read('blocks/product-faqs.liquid');

/*
 * Code only. The {%- doc -%} header names the very things these guards assert are absent -- an
 * inline <style>, an <svg> icon -- so a guard run over the prose fails on correct code and can be
 * fooled into passing by a comment. Same lesson as tests/product-brew-guide.test.mjs.
 */
const block = source
  .replace(/\{%-?\s*doc\s*-?%\}[\s\S]*?\{%-?\s*enddoc\s*-?%\}/g, '')
  .replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
  .replace(/^\s*#.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const readTemplate = (name) => JSON.parse(read(`templates/${name}`).replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));

/*
 * 18 of 60 active products have FAQs authored against them and not one rendered. They are the only
 * place on the site that answers, in liftable prose, what a coffee is like with milk or which
 * grinder suits it -- which is why this block carries structured data rather than just an
 * accordion.
 */

test('nothing renders unless at least one FAQ has both a question and an answer', () => {
  /*
   * #236 prunes a tab whose panel renders nothing, so "emit no markup" IS "hide the tab". The
   * guard is on the captured markup rather than a counter: it is the one test that cannot drift
   * from what is actually being rendered.
   */
  const guardStart = block.indexOf('{%- if faq_items != blank -%}');
  assert.ok(guardStart > -1, 'the output must be guarded on the captured markup');
  assert.match(block.slice(guardStart), /class="product-faqs"/, 'the wrapper belongs inside the guard');

  /*
   * A reference whose metaobject was deleted comes back nil, and an entry can be saved with a
   * title and no answer. Both must be skipped -- a <details> with an empty body is an open-able
   * control that reveals nothing, and a Question with no acceptedAnswer is invalid FAQPage.
   */
  const rowGuards = block.match(/\{%-? if question != blank and answer_text != blank -?%\}/g) ?? [];
  assert.equal(rowGuards.length, 2, 'both the markup and the structured data must skip incomplete rows');
});

test('only the rendered <details> escape the captures', () => {
  /*
   * Everything before the guard happens inside {% capture %}, which swallows output. If a tag
   * ever moves outside one, the panel is never empty and the tab appears on all 42 products with
   * no FAQs.
   */
  const guardStart = block.indexOf('{%- if faq_items != blank -%}');
  const before = block.slice(0, guardStart);
  const captured = [...before.matchAll(/\{%-?\s*capture\s+\w+\s*-?%\}/g)].length;
  const closed = [...before.matchAll(/\{%-?\s*endcapture\s*-?%\}/g)].length;
  assert.equal(captured, closed, 'every capture before the guard must be closed before it');
  assert.ok(captured >= 2, 'the markup and the structured data are each captured');
});

test('the CSS is a theme stylesheet and the icon is not an <svg>', () => {
  /*
   * Two separate ways to defeat the pruning, both of which the superseded `faqs` section had.
   * #236 treats a panel as empty only when `panel.textContent.trim() === ''` AND it matches none
   * of `img, picture, video, audio, iframe, svg, canvas, object, embed, model-viewer`. A <style>
   * element's text counts towards textContent; an <svg> icon is on the whitelist. Either one
   * keeps every empty panel alive.
   */
  assert.match(block, /\{%\s*stylesheet\s*%\}/, 'the rules belong in a theme stylesheet');
  assert.doesNotMatch(block, /<style\b/i, 'an inline <style> would defeat the empty-tab pruning');
  assert.doesNotMatch(block, /<svg\b/i, 'svg is on the pruning whitelist; the icon is drawn in CSS');

  const stylesheet = block.slice(block.indexOf('{% stylesheet %}'));
  assert.match(stylesheet, /\.product-faqs__icon::before/, 'the plus is drawn with pseudo-elements');
  assert.match(stylesheet, /border-block-end: 1px solid currentColor/, 'the rules follow the product colour');
});

test('the metaobject fields are read the way their types require', () => {
  /*
   * custom.accordion       list.metaobject_reference -> .value is the array
   * accordion.title        single_line_text_field    -> plain string
   * accordion.description  rich_text_field           -> metafield_tag, never a bare drop
   *
   * A rich_text_field printed as a bare drop puts a literal `{"type":"root"...` on the page.
   * Codex caught exactly that twice on #240.
   */
  assert.match(block, /assign faqs = closest\.product\.metafields\.custom\.accordion\.value/, 'a list metafield needs .value');
  assert.match(block, /\{\{ faq\.description \| metafield_tag \}\}/, 'the answer must go through metafield_tag');
  assert.doesNotMatch(block, /\{\{ faq\.description \}\}/, 'a bare rich-text drop renders its JSON');
});

test('the structured data describes exactly the questions the page shows', () => {
  /*
   * The SEO/AEO/GEO half of the block. Three things have to hold or it is worse than nothing:
   *   - it is inside the same guard as the markup, so no page claims FAQs it does not display;
   *   - the answer is plain text, because acceptedAnswer.text must not carry the rich text's
   *     structured JSON;
   *   - the separators are driven by a counter, not forloop.first, because skipped rows would
   *     otherwise leave a leading comma and make the whole document unparseable.
   */
  const guardStart = block.indexOf('{%- if faq_items != blank -%}');
  const emitted = block.slice(guardStart);
  assert.match(emitted, /<script type="application\/ld\+json">/, 'the structured data is emitted with the markup');
  assert.match(emitted, /"@type":"FAQPage"/, 'and it is a FAQPage');
  assert.doesNotMatch(block.slice(0, guardStart), /<script\b/i, 'never outside the guard');

  /*
   * Both strings are JSON-escaped and then have `</` neutralised: `json` escapes JSON
   * metacharacters but not `<` or `/`, so a `</script>` inside merchant text would end the
   * script element early and spill the rest onto the page.
   */
  assert.ok(
    block.includes(String.raw`assign question_json = question | json | replace: '</', '<\/'`),
    'the question is escaped and its </ neutralised',
  );
  assert.ok(
    block.includes(String.raw`assign answer_json = answer | strip | json | replace: '</', '<\/'`),
    'the answer likewise',
  );

  /*
   * The answer goes into acceptedAnswer.text as HTML. Google allows <p> <br> <ol> <ul> <li>
   * <a> <b> <strong> <i> <em> there, and strip_html would cost two things: it removes tags
   * but not entities, so `&amp;` would reach the structured data literally with no Liquid
   * filter able to undo it, and it joins paragraphs with no separator.
   */
  assert.doesNotMatch(block, /text":\{\{ answer_text/, 'the structured answer must not be the stripped text');
  assert.match(block, /assign answer_text = answer \| strip_html \| strip/, 'answer_text stays, as the emptiness test');
  assert.match(block, /question != blank and answer_text != blank/, 'and that is what decides whether a row is described');

  assert.match(block, /\{%-? if described > 0 -?%\},\{%-? endif -?%\}/, 'commas come from a counter, not forloop.first');
  assert.doesNotMatch(block, /forloop\.first/, 'forloop.first breaks as soon as a row is skipped');
});

test('the FAQ tab sits before Reviews and holds the block', () => {
  const section = readTemplate('product.json').sections.product_tabs_fW4maV;
  const tab = section.blocks.product_tab_faqs_Jv4Wmd;

  assert.ok(tab, 'the tab must exist');
  assert.equal(tab.settings.label, 'FAQs');
  assert.ok(!tab.disabled, 'the tab is what shows the answers; disabled it shows nothing');

  const types = (tab.block_order ?? []).map((id) => tab.blocks[id]?.type);
  assert.deepEqual(types, ['product-faqs'], 'the tab must hold the FAQ block');

  // Our own answers come before other people's. Reviews stopped being a tab on
  // 2026-10-26 and became `product_reviews_bottom`, a section after
  // "You might also like", which is where the mock puts it -- so the ordering
  // this guards is now "FAQs is the last tab, and Reviews is below the strip"
  // rather than two indexes in the same block_order.
  const order = section.block_order;
  assert.equal(
    order[order.length - 1],
    'product_tab_faqs_Jv4Wmd',
    'FAQs is the last tab, so our own answers come before other people\'s',
  );
  assert.ok(
    !Object.hasOwn(section.blocks, 'product_tab_dFwTTp'),
    'Reviews must not be a tab any more; it is the bottom section',
  );

  const template = readTemplate('product.json');
  const reviews = template.sections.product_reviews_bottom;
  assert.ok(reviews, 'the Reviews section must exist');
  assert.ok(!reviews.disabled, 'Reviews disabled would hide every review on the PDP');
  assert.ok(
    template.order.indexOf('product_reviews_bottom') >
      template.order.indexOf('product_recommendations_qggXJq'),
    'the mock puts Reviews after "You might also like"',
  );
});

/*
 * WCAG 2.x relative luminance and contrast ratio. Small enough to inline, and the alternative
 * is trusting a guard that cannot tell `#470a12` from `#f4f3e9`.
 */
const relativeLuminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const channel = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const contrastRatio = (a, b) => {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

test('the Reviews section background contrasts with the widget\'s own light text', () => {
  /*
   * The Judge.me widget brings its own colours and they are configured light-on-colour -- it
   * used to sit inside `product_tabs_fW4maV`, which paints the per-product colour. Measured on
   * the storefront, its review text renders `#ffffff`, and that is an app-level setting we do
   * not control from this repo: `contrast-override.liquid` sets theme foreground tokens, which
   * the widget does not consume. So the only lever the theme has is the ground underneath.
   *
   * That shipped broken on 2026-10-26: the section existed, was enabled and sat in the right
   * place, and every guard above passed, because none of them looks at colour.
   *
   * Assert contrast, not a specific hex. A non-blank check is not enough -- cream `#f4f3e9`
   * is non-blank and just as unreadable as no background at all. Templates are shop-owned
   * (the theme editor and `shopify theme pull` both rewrite them), so that is a live path,
   * not a hypothetical.
   *
   * If the widget's own text colour is ever darkened in the Judge.me admin, this guard is the
   * thing that should be updated -- deliberately, with the new colour measured on the
   * storefront, rather than relaxed to make a template change pass.
   */
  const WIDGET_TEXT = '#ffffff';

  for (const name of [
    'product.json',
    'product.merch.json',
    'product.equipment.json',
    'product.non-coffee.json',
  ]) {
    const reviews = readTemplate(name).sections.product_reviews_bottom;
    assert.ok(reviews, `${name} must carry the Reviews section`);

    const background = (reviews.settings.background_color ?? '').trim();
    assert.match(
      background,
      /^#[0-9a-fA-F]{6}$/,
      `${name}: Reviews needs an opaque background or the widget's white text lands on the cream page`,
    );

    const ratio = contrastRatio(background, WIDGET_TEXT);
    assert.ok(
      ratio >= 4.5,
      `${name}: Reviews background ${background} gives ${ratio.toFixed(2)}:1 against the widget's ${WIDGET_TEXT} text; needs >= 4.5:1`,
    );
  }
});

test('the page still carries only one FAQPage', () => {
  /*
   * Two FAQPage documents on one URL is a structured-data error, and the PDP already emits
   * Product (product-information.liquid) and Organization (header.liquid). Neither is an FAQPage
   * today; if one ever becomes one, this block is the other half of the collision.
   */
  for (const file of ['sections/product-information.liquid', 'sections/header.liquid']) {
    assert.doesNotMatch(read(file), /"@type":\s*"?FAQPage/, `${file} must not also emit an FAQPage`);
  }
});
