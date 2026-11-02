import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const sectionSource = read('sections/press-quotes.liquid');
const readTemplate = (name) => JSON.parse(read(`templates/${name}`).replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));
const index = readTemplate('index.json');

/*
 * Markup only. The {% comment %} in the section describes the `elsif` this change removes, so a
 * guard run over the prose would read the description of the old behaviour as the behaviour.
 * Same lesson as tests/locations-flagship-tabs.test.mjs.
 */
const section = sectionSource.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');

/*
 * Four named café testimonials were sitting on /pages/wholesale, a page almost no retail visitor
 * reaches, while the homepage's own customer quote was an explicit placeholder -- the
 * `club_benefits.testimonials` block says so in its first comment, and that section is disabled.
 *
 * They are blocks inside the homepage's existing quote section rather than a section of their
 * own, for two reasons. index.json is at 25 of Shopify's 25 sections, so a 26th would make the
 * GitHub integration refuse the whole file; and the section already mixes press with partners --
 * the Espresso quote is a 2012 partnership, not a review.
 */

test('a quote can carry both a logo and a name', () => {
  /*
   * This is what made the café quotes possible. The attribution used to be an `elsif` on the
   * logo: a block could render a logo or a name, never both. Fine for a masthead everyone
   * recognises, wrong for a café whose square logo is not a wordmark -- the quote would have
   * appeared unattributed.
   */
  assert.doesNotMatch(section, /elsif block\.settings\.source != blank/, 'the name must not be an alternative to the logo');
  assert.match(
    section,
    /<figcaption class="press-quotes__source">\{\{ block\.settings\.source \}\}<\/figcaption>/,
    'the name is a figcaption',
  );

  // A figcaption is only valid as the first or last child of its figure.
  const figure = section.slice(section.indexOf('<figure'), section.indexOf('</figure>'));
  assert.ok(figure.indexOf('<figcaption') > figure.indexOf('<blockquote'), 'the attribution follows the words it attributes');
  assert.match(figure.slice(figure.indexOf('<figcaption')), /<\/figcaption>\s*\{%-? endif -?%\}\s*$/, 'and nothing follows it inside the figure');

  /*
   * A logo whose source is named below it is decorative; one without a source is the quote's
   * only identification, so it keeps the alt the image picker stored. Passing a blank source
   * straight to alt would have emptied it for the three press logos that have no source --
   * image_tag only falls back to image.alt when alt is not passed at all.
   */
  assert.match(section, /class: 'press-quotes__logo', alt: logo_alt/, 'the logo alt is chosen, not restated');
  assert.match(
    section,
    /assign logo_alt = block\.settings\.logo\.alt \| default: ''\s+if block\.settings\.source != blank\s+assign logo_alt = ''/,
    'a named source makes the logo decorative; an unnamed one keeps the stored alt',
  );
});

test('the existing press quotes are untouched by that change', () => {
  /*
   * The three that were already there carry no `source`, so moving the attribution below the
   * quote changes nothing about how they render. Asserted because this is the whole argument for
   * editing a shared section rather than forking it, and a future edit that gives one of them a
   * source would quietly move its name from above the quote to below.
   */
  const blocks = index.sections.press_quotes_4kW9eF.blocks;
  for (const id of ['quote_aCYyE8', 'quote_efak7r', 'quote_NUbmXf']) {
    assert.equal(blocks[id]?.settings.source, '', `${id} must still have no attribution line`);
    assert.ok(blocks[id]?.settings.logo, `${id} is identified by its logo`);
  }

  // And they still come first, so the first slide is the one that has always been there.
  assert.deepEqual(
    index.sections.press_quotes_4kW9eF.block_order.slice(0, 3),
    ['quote_aCYyE8', 'quote_efak7r', 'quote_NUbmXf'],
  );
});

test('the homepage carries the four café testimonials', () => {
  const press = index.sections.press_quotes_4kW9eF;
  assert.ok(!press.disabled, 'disabled it shows nothing');

  const cafes = ['quote_ginninderry', 'quote_faducci', 'quote_precinct37', 'quote_freestate'];
  for (const id of cafes) {
    const block = press.blocks[id];
    assert.ok(block, `${id} must exist`);
    assert.equal(block.type, 'quote');
    assert.ok(block.settings.source?.trim(), 'an unattributed testimonial is worth nothing');
    assert.ok(block.settings.logo?.startsWith('shopify://'), 'each café brings its logo');
    assert.ok(block.settings.quote?.trim().length > 80, 'the quote must actually be there');
    assert.ok(press.block_order.includes(id), `${id} is stranded outside block_order`);
  }

  /*
   * Seven blocks across three columns is what puts the carousel arrows on screen: the section
   * only shows them when the blocks outnumber the columns. Before this there were exactly three,
   * so the arrows were never drawn.
   */
  assert.ok(press.block_order.length > press.settings.columns, 'otherwise there is nothing to page through');

  /*
   * Outnumbering the columns is only half of it: sections/press-quotes.liquid gates the arrows
   * on `icons_style != 'none'` as well, so setting the icon style to None in the editor leaves
   * slides four to seven reachable by swipe alone, with this test still green.
   */
  assert.notEqual(press.settings.icons_style, 'none', 'with no icons the extra slides are swipe-only');
});

test('the homepage is at Shopify\'s section ceiling, which is why these are blocks', () => {
  /*
   * The reason this is not its own section. tests/shop-owned-templates.test.mjs enforces the
   * limit across every template; this states the consequence at the place someone would reach
   * for a 26th section, because the failure mode is the integration silently refusing the entire
   * file rather than dropping the extra section.
   */
  //
  // 2026-11-01: this is now 23. It was 25, then 24 when #152-era cleanup
  // deleted two disabled duplicates to make room for the Water For Good
  // campaign banner; closing the campaign removed the banner and gave that
  // slot back. Two slots of headroom, deliberately not spent -- the reason
  // these testimonials are blocks has not changed, and a page two sections
  // below a hard ceiling is not an invitation.
  assert.equal(Object.keys(index.sections).length, 23, 'if this climbs to 25 the homepage is full again');
  assert.equal(index.order.length, Object.keys(index.sections).length);
});

test('the wholesale page keeps its own copy', () => {
  /*
   * Deliberately not a move. /pages/wholesale is addressed to cafés deciding whether to buy, and
   * the testimonials are the page's closing argument. Reusing the words on the homepage does not
   * mean taking them off the page they were written for.
   */
  const wholesale = readTemplate('page.wholesale.json');
  assert.ok(wholesale.sections.cafe_testimonial, 'the wholesale section must stay');
  assert.ok(wholesale.order.includes('cafe_testimonial'), 'and stay in the order');
});

/*
 * Section width is a customizer control now, like the theme's other homepage sections (carousel,
 * hero). It reaches the markup through the standard `.section` grid: `section--page-width` holds the
 * quotes in the central page-width column, `section--full-width` spans the viewport.
 */
test('the section width is a page/full control applied through the .section grid', () => {
  const schema = JSON.parse(sectionSource.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/)[1]);
  const width = schema.settings.find((s) => s.id === 'section_width');
  assert.ok(width, 'press-quotes must expose a section_width control, like the other homepage sections');
  assert.deepEqual(width.options.map((o) => o.value).sort(), ['full-width', 'page-width']);
  assert.equal(width.default, 'page-width', 'defaults to page width, as the theme does elsewhere');

  assert.match(
    section,
    /class="press-quotes section section--\{\{ settings\.section_width \}\}/,
    'the chosen width must reach the markup through the standard section modifier class',
  );
});

test('the colour band is a full-bleed sibling, so page-width does not clip it', () => {
  /*
   * `.shopify-section ... .section { background: transparent }` zeroes a background set on the
   * section wrapper, and `.section--page-width` would in any case hold it to the central column, so
   * the band lives on an absolutely-positioned `.section-background` sibling painted with the chosen
   * colour -- exactly as carousel and hero do.
   */
  assert.match(
    section,
    /<div class="section-background" style="background-color: \{\{ settings\.background_color \}\};"><\/div>/,
    'the colour band must be painted on a separate full-bleed sibling',
  );
  assert.doesNotMatch(
    sectionSource,
    /background:\s*var\(--press-quotes-background\)/,
    'the band must not sit on the .section wrapper, where the grid would clip it in page-width mode',
  );
});
