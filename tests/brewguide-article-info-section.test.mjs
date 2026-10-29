import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const source = read('sections/brewguide-article-info.liquid');

/*
 * This section restores content the 2026 theme migration dropped from individual Brew Guides
 * blog articles: see sections/brewguide-article-info.liquid's own doc comment for the full
 * story (source: sections/article-template.liquid in Shopify theme 147471433919, "ONA - OLD
 * 11/26/2025"). Same "code only, strip comments" discipline as
 * tests/collection-itemlist-schema.test.mjs -- comment prose shouldn't satisfy a pattern match
 * meant to prove something about the actual Liquid.
 */
const code = source.replace(/\{%-?\s*doc\s*-?%\}[\s\S]*?\{%-?\s*enddoc\s*-?%\}/g, '');

/*
 * `code` only strips the {% doc %} block, so the inline {% comment %} rationale is still in it
 * -- fine for the Liquid-shape assertions above, which quote code the comments don't contain,
 * but not for anything asserting a token is absent: the comments discuss those tokens by name.
 * `markup` is the Liquid with every comment removed; `css` is the {% stylesheet %} body with
 * its /* *\/ comments removed. Both are what the browser actually gets.
 */
const markup = code.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');
const css = (source.match(/\{%\s*stylesheet\s*%\}([\s\S]*?)\{%\s*endstylesheet\s*%\}/) || [, ''])[1]
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('templates/article.json wires in this section, after the existing main-blog-post one', () => {
  const template = JSON.parse(read('templates/article.json').replace(/^\/\*[\s\S]*?\*\/\s*/, ''));
  assert.ok(template.sections['brewguide-info'], 'templates/article.json must define a brewguide-info section entry');
  assert.equal(template.sections['brewguide-info'].type, 'brewguide-article-info', 'the entry must use this section\'s type');
  assert.deepEqual(
    template.order,
    ['section', 'brewguide-info'],
    'this section (recipe + cross-sell) must render after main-blog-post, same position the old recipe block and cross-sell held. The Tastes Like / Roast info is a separate block nested inside main-blog-post itself now, not a sibling section -- see tests/brewguide-article-tasting-info-block.test.mjs'
  );
});

test('every piece is gated on blog.handle == \'brewguides\', so News/Journal articles stay untouched', () => {
  // A live diagnostic (PR #286/#287) proved article.blog.handle resolves blank in this theme's
  // actual rendering of this section, even though article.metafields.* on the same object reads
  // correctly -- so the gate uses the simpler, standard `blog` context object instead.
  const gateIndex = code.indexOf("if blog.handle == 'brewguides'");
  assert.ok(gateIndex > -1, 'must gate on blog.handle, not render unconditionally for every blog sharing templates/article.json');
  assert.ok(!code.includes('article.blog.handle'), 'article.blog.handle resolves blank in this theme -- must not reintroduce it as the gate');
  const ifBrewguideIndex = code.indexOf('if is_brewguide_article');
  assert.ok(ifBrewguideIndex > gateIndex, 'the blog-handle check must set the flag the rendering is gated on');
});

test('nothing renders at all unless the recipe or the cross-sell will, and the cross-sell keeps its .section wrapper', () => {
  // Codex, PR #282 round 2: this section used to also carry the Tastes Like / Roast info, now
  // split into sections/brewguide-article-tasting-info.liquid so it can render near the title
  // instead of after the full article body. has_any_content is now just recipe-or-cross-sell.
  assert.doesNotMatch(code, /has_info/, 'the tastes-like/roast info and its has_info flag moved to sections/brewguide-article-tasting-info.liquid -- this file must not still reference it');
  assert.match(code, /assign has_any_content = false\s*\n\s*if has_recipe or cross_sell_product != blank\s*\n\s*assign has_any_content = true/, 'has_any_content must be true only when the recipe or the cross-sell will render');
  assert.match(markup, /\{%-\s*if has_any_content\s*-%\}/, 'both branches must sit behind has_any_content, so an article with neither emits nothing');
  assert.match(markup, /\{%-\s*if cross_sell_product != blank\s*-%\}\s*<div class="section">/, 'the cross-sell card still needs .section -- it is a centred card in the content column');
});

test('the recipe band is NOT inside .section, because .section is what confined it to the content column', () => {
  /*
   * The band is the mock's full-bleed maroon "Brew guide table". Measured on live before this
   * change: the shopify-section wrapper was 1363px wide and .section was 1363px wide, but
   * .brewguide-article-recipe inside it rendered at 736px -- .section is Horizon's page-width
   * grid (assets/base.css) and auto-places a direct child in the centred column. Putting the
   * band back inside .section would silently restore that 736px measure and the band would
   * stop being full-bleed, with nothing failing. Hence this guard rather than a comment.
   */
  const bandIndex = markup.indexOf('<div class="brewguide-article-recipe-band">');
  assert.ok(bandIndex > -1, 'the recipe must be wrapped in .brewguide-article-recipe-band');
  const before = markup.slice(0, bandIndex);
  const openSections = (before.match(/<div class="section">/g) || []).length;
  const closedBeforeBand = (before.match(/<\/div>/g) || []).length;
  assert.equal(openSections, 0, 'no .section wrapper may be opened before the band -- the band must be a direct child of the section wrapper, not of the page-width grid');
  assert.ok(closedBeforeBand >= 0);
  assert.match(markup, /<div class="brewguide-article-recipe-band">\s*<div class="brewguide-article-recipe">/, 'the measure is restored by .brewguide-article-recipe inside the band, not by .section');
});

test('the band paints from the palette extremes, and its rules inside never fall back to the page foreground', () => {
  /*
   * The spec table's rules used rgb(var(--color-foreground-rgb) / ...). On the page ground that
   * is maroon-on-cream and visible; on the band it is maroon-on-maroon and invisible. The
   * failure is silent -- the CSS is valid, the token resolves, the borders simply vanish. So
   * assert the band's own ground and text come from the palette extremes, and that no rule
   * scoped inside the band still reaches for the page foreground.
   */
  assert.match(css, /\.brewguide-article-recipe-band\s*\{[^}]*background-color:\s*var\(--palette-darkest\)/, 'the band ground must be var(--palette-darkest), not a hard-coded hex that drifts from the palette');
  assert.match(css, /\.brewguide-article-recipe-band\s*\{[^}]*color:\s*var\(--palette-lightest\)/, 'the band text must be var(--palette-lightest)');
  for (const selector of ['.brewguide-article-recipe__spec', '.brewguide-article-recipe__row']) {
    const rule = css.match(new RegExp(selector.replace(/[.]/g, '\\.') + '\\s*\\{[^}]*\\}'));
    assert.ok(rule, `${selector} must still have a rule`);
    assert.doesNotMatch(rule[0], /--color-foreground-rgb/, `${selector} sits on the maroon band now -- --color-foreground-rgb is the page foreground and renders maroon-on-maroon there`);
    assert.match(rule[0], /--palette-lightest-rgb/, `${selector} must draw its rule from --palette-lightest-rgb so it is visible on the band`);
  }
});

test('every !important is scoped inside the pasted-metafield container and nowhere else', () => {
  /*
   * The intro's inline styles can only be beaten with !important. That is a blunt instrument,
   * so the blast radius is the thing worth guarding: every declaration carrying it must belong
   * to a selector that names .brewguide-article-recipe__intro. A future rule that drops the
   * scope would start overriding inline styles elsewhere on the article page.
   */
  const rules = css.match(/[^{}]+\{[^}]*\}/g) || [];
  const important = rules.filter((r) => r.includes('!important'));
  assert.ok(important.length > 0, 'the intro overrides must actually be present');
  for (const rule of important) {
    const selector = rule.slice(0, rule.indexOf('{')).trim();
    // Split on commas BETWEEN selectors, not on the ones inside :is()/:where() -- a naive
    // split(',') tears ":is(h1, h2, h3)" into the bare fragments "h2", "h3" and reports them
    // as unscoped. (It did exactly that the first time this guard ran.)
    const parts = [];
    let depth = 0;
    let current = '';
    for (const ch of selector) {
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      if (ch === ',' && depth === 0) { parts.push(current); current = ''; continue; }
      current += ch;
    }
    parts.push(current);
    for (const part of parts) {
      assert.ok(
        part.includes('.brewguide-article-recipe__intro'),
        `every !important rule must be scoped to the pasted-metafield container; "${part.trim()}" is not`,
      );
    }
  }
});

test('"Brew guide" stays an h2 in the outline while rendering as the mock\'s 12px eyebrow', () => {
  // The mock shows a small uppercase label above the serif title, not a second heading
  // competing with it -- but dropping to a <span> would take the band's only heading out of
  // the document outline. Presentation changes; the element does not.
  assert.match(markup, /<h2 class="brewguide-article-recipe__heading">Brew guide<\/h2>/, 'the eyebrow must remain an h2 so the band keeps a heading in the outline');
  const rule = css.match(/\.brewguide-article-recipe__heading\s*\{[^}]*\}/);
  assert.ok(rule, '.brewguide-article-recipe__heading must have a rule');
  assert.match(rule[0], /font-size:\s*var\(--font-h6--size\)/, 'the eyebrow renders at --font-h6--size (0.75rem = the mock\'s 12px), not the --font-h4--size it used to use');
  assert.match(rule[0], /text-transform:\s*uppercase/, 'the eyebrow is uppercase in the mock');
});

test('the heading italic is applied to known copy only, so unrecognised copy is passed through untouched', () => {
  // All 24 Brew Guides carry the identical pasted heading and the mock italicises its second
  // half; the copy lives in the metafield, so the emphasis has to be added on the way out.
  // The guard that matters is that it is a replace of one exact string -- never a rewrite of
  // whatever happens to be there.
  assert.match(code, /assign guide_intro = guide_intro \| replace: 'How to get the best tasting cup', 'How to get the <em>best tasting cup<\/em>'/, 'the italic must be a replace of the one known string');
  assert.doesNotMatch(code, /guide_intro \| (strip_html|truncate|remove)/, 'the metafield must not be stripped or truncated -- an author writing real copy there must see it rendered whole');
});

test('the recipe block only renders when there is an intro or at least one spec pair, matching the pruning-safe pattern in blocks/product-brew-guide.liquid', () => {
  assert.match(code, /assign has_recipe = false\s*\n\s*if guide_intro != blank or spec_rows != blank\s*\n\s*assign has_recipe = true/, 'has_recipe must only be set when there is an intro or the captured spec_rows markup is non-blank');
  assert.match(code, /\{%-\s*if has_recipe\s*-%\}/, 'the recipe block must be gated on has_recipe, not render an empty "Brew guide" heading over nothing');
});

test('has_recipe is gated on the CAPTURED spec rows, not a raw count that can\'t see whether any row survived the blank guard', () => {
  // Codex, PR #282: spec_count > 0 only proves both lists have that many entries, not that any
  // individual label/value pair is non-blank -- if every value happened to be blank or
  // whitespace, spec_count would still be > 0 while the capture below produces nothing, which
  // would have rendered a "Brew guide" heading over an empty <dl>. Same fix shape as
  // blocks/product-faqs.liquid's faq_items capture: test the markup actually produced, not a
  // count that can't see into it.
  const captureStart = code.indexOf('{%- capture spec_rows -%}');
  assert.ok(captureStart > -1, 'spec_rows must be captured before has_recipe is decided');
  const captureEnd = code.indexOf('{%- endcapture -%}', captureStart);
  assert.ok(captureEnd > captureStart, 'the capture must be closed');
  const hasRecipeIndex = code.indexOf('assign has_recipe = false', captureEnd);
  assert.ok(hasRecipeIndex > captureEnd, 'has_recipe must be decided after spec_rows is captured, not before (reading spec_rows before the capture closes would see last render\'s stale value or nothing)');
  assert.doesNotMatch(code, /if guide_intro != blank or spec_count > 0/, 'must not fall back to deciding has_recipe from the raw count');
});

test('spec_labels and spec_values are paired only as far as both lists go, same discipline as the product-level brew guide', () => {
  assert.match(code, /assign spec_count = 0/, 'spec_count must default to 0');
  assert.match(code, /if spec_labels\.size > 0 and spec_values\.size > 0/, 'must check both lists have entries before pairing');
  assert.match(code, /if spec_values\.size < spec_count[\s\S]{0,40}assign spec_count = spec_values\.size/, 'must shrink spec_count to the shorter list, never index past the end of either');
});

test('a spec row with a blank label or blank value is skipped, not emitted with an empty cell', () => {
  assert.match(code, /assign label = spec_labels\[index\] \| strip/, 'must read and strip the label before using it');
  assert.match(code, /assign value = spec_values\[index\] \| strip/, 'must read and strip the value before using it');
  assert.match(code, /\{%-\s*if label != blank and value != blank\s*-%\}/, 'each spec row must be guarded on both label and value being non-blank before it is emitted');
});

test('the label is not double-uppercased -- CSS text-transform already handles it', () => {
  // Raised in an independent review of PR #282: {{ label | upcase }} plus
  // .brewguide-article-recipe__label's own text-transform: uppercase did the same thing twice.
  // Harmless visually, but blocks/product-brew-guide.liquid (this file's own stated source
  // pattern) relies on the CSS transform alone, and the Liquid-side uppercase changes what a
  // screen reader or copy-paste sees from the underlying text.
  assert.doesNotMatch(code, /\{\{ label \| upcase \}\}/, 'must not uppercase the label in Liquid when the CSS class already does it');
  assert.match(code, /\{\{ label \}\}/, 'must render the label plain, letting .brewguide-article-recipe__label\'s text-transform: uppercase do the visual work');
});

test('the cross-sell does a direct product lookup, not a loop over every product in the catalog', () => {
  assert.doesNotMatch(code, /for product in collections\.all\.products/, 'must not reproduce the old O(n) collections.all scan the legacy section used');
  assert.match(code, /assign cross_sell_product = all_products\[cross_sell_handle\]/, 'must use a direct all_products[handle] lookup instead');
  assert.match(code, /\{%-\s*if cross_sell_product != blank\s*-%\}/, 'the cross-sell card must only render when the lookup actually found a product');
});

test('the cross-sell only looks up a handle when accentuate.select_product is actually set', () => {
  assert.match(code, /assign cross_sell_product = blank/, 'cross_sell_product must default to blank');
  assert.match(code, /if cross_sell_handle != blank\s*\n\s*assign cross_sell_product = all_products\[cross_sell_handle\]/, 'the lookup itself must be guarded on cross_sell_handle being non-blank, so all_products[blank] is never attempted');
});

test('the section schema has no visible settings and a preset, matching the other pruning-safe PDP/article blocks', () => {
  const schemaStart = code.indexOf('{% schema %}');
  const schemaEnd = code.indexOf('{% endschema %}');
  assert.ok(schemaStart > -1 && schemaEnd > schemaStart, 'the schema tag must exist');
  const schema = JSON.parse(code.slice(schemaStart + '{% schema %}'.length, schemaEnd));
  assert.equal(schema.name, 'Brew guide article info');
  assert.ok(Array.isArray(schema.presets) && schema.presets.length === 1, 'must have exactly one preset so it can be added back from the theme editor if ever removed');
  // Codex, PR #282: a section schema only accepts tag values of article/aside/div/footer/
  // header/section (unlike a theme block, where tag: null is valid and means "no wrapper").
  // This is a section (referenced directly in templates/article.json, not nested inside
  // another section's blocks), so tag: null here would have made the schema itself invalid
  // and the file unsyncable. Omitting the key entirely falls back to Shopify's own <div>
  // default, which is what's wanted.
  assert.equal(schema.tag, undefined, 'tag must be omitted (section schema does not accept tag: null the way a theme block schema does)');
});

test('no Jinja-style {# #} comment delimiters -- Liquid does not recognise them, so they would render as visible text', () => {
  // Codex, PR #282: a {#- ... #} block around the .section wrapper's developer note rendered
  // as literal customer-facing text on every brew-guide article, since Liquid has no such
  // delimiter (that's Jinja2 syntax). The only valid Liquid comment form is
  // {% comment %}...{% endcomment %} (or {%- comment -%} with whitespace control).
  assert.doesNotMatch(source, /\{#/, 'must not contain any {# ... #} Jinja-style comment delimiter');
  assert.match(source, /\{%-?\s*comment\s*-?%\}/, 'the developer note must use a real Liquid comment tag instead');
});

test('every spacing and radius token used is one already proven to resolve elsewhere in this theme, not a plausible-looking guess', () => {
  // Codex, PR #282: --margin-3xl, --style-border-radius-cards and --style-border-radius-images
  // are never declared anywhere in this theme (confirmed: this file was the ONLY one in the
  // whole codebase referencing them before this fix) -- browsers silently discard a declaration
  // naming an undefined custom property, so the margin and both border-radius rules had no
  // effect at all. --gap-* and --style-border-radius-popover are both used successfully
  // elsewhere (blocks/product-brew-guide.liquid for gap-*; sections/header.liquid,
  // sections/product-hotspots.liquid, blocks/filters.liquid for the popover radius).
  assert.doesNotMatch(code, /var\(--margin-3xl\)/, 'must not reference the undefined --margin-3xl token');
  assert.doesNotMatch(code, /var\(--style-border-radius-cards\)/, 'must not reference the undefined --style-border-radius-cards token');
  assert.doesNotMatch(code, /var\(--style-border-radius-images\)/, 'must not reference the undefined --style-border-radius-images token');
  assert.match(code, /margin-block-start:\s*var\(--gap-3xl\)/, 'the recipe block spacing must use the proven --gap-3xl token instead');
  const radiusUses = code.match(/border-radius:\s*var\(--style-border-radius-popover\)/g) || [];
  assert.equal(radiusUses.length, 2, 'both the cross-sell card and its image must use the proven --style-border-radius-popover token');
});
