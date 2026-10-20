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

  // A logo with no accessible name is a decorative image standing in for an attribution.
  assert.match(section, /class: 'press-quotes__logo', alt: block\.settings\.source/, 'the logo takes its alt from the name');
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
});

test('the homepage is at Shopify\'s section ceiling, which is why these are blocks', () => {
  /*
   * The reason this is not its own section. tests/shop-owned-templates.test.mjs enforces the
   * limit across every template; this states the consequence at the place someone would reach
   * for a 26th section, because the failure mode is the integration silently refusing the entire
   * file rather than dropping the extra section.
   */
  assert.equal(Object.keys(index.sections).length, 25, 'if this ever drops, a section becomes possible again');
  assert.equal(index.order.length, 25);
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
