import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'sections/ona-donation-counter.liquid'), 'utf8');
const schemaMatch = source.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);

test('renders the Water For Good total from the shop metafield', () => {
  // The number is written by ona-data-platform's recompute job. The section
  // only formats it, and must not break when the metafield is absent.
  assert.match(source, /shop\.metafields\.custom\.donation_total\.value \| default: 0/);
  assert.match(source, /\| floor/);
  // One card per digit, with a thousands separator every third position.
  assert.match(source, /for i in \(1\.\.num_len\)/);
  assert.match(source, /pos_mod == 0/);
});

test('carries its own styles, because this theme has no legacy main.css', () => {
  // The legacy theme styles .donation-counter from ONA's main.css, which
  // ona_theme2026 does not ship. Without these the section renders unstyled.
  assert.match(source, /{% stylesheet %}/);
  for (const rule of [
    /\.donation-counter\s*{/,
    /\.donation-counter__cards\s*{/,
    /\.donation-counter__card\s*{/,
    /\.donation-counter__card::after\s*{/,
    /\.donation-counter__subtitle\s*{/,
    // PR #190 re-pointed the CTA at Horizon's global button and now scopes the
    // rule as `.donation-counter__cta.button`, so an exact `__cta {` match went
    // red on main for a day. The class may pick up further qualifiers; what this
    // file exists to prove is that a rule for the CTA is present at all, because
    // this theme has no legacy main.css to fall back on.
    /\.donation-counter__cta[.\w-]*\s*{/,
  ]) {
    assert.match(source, rule);
  }

  // #190 drives the button colours through two custom properties fed by new
  // schema settings. If either side is dropped the CTA silently inherits
  // Horizon's default button colours instead of the ones the editor set.
  for (const wiring of [
    /--donation-button-background: \{\{ section\.settings\.button_bg_color \}\}/,
    /--donation-button-text: \{\{ section\.settings\.button_text_color \}\}/,
    /--button-background-color: var\(--donation-button-background\)/,
    /--button-color: var\(--donation-button-text\)/,
    /"id": "button_bg_color"/,
    /"id": "button_text_color"/,
  ]) {
    assert.match(source, wiring, 'the #190 button-colour wiring must stay intact end to end');
  }
});

test('keeps the approved measurements as the customizable defaults', () => {
  // The live measurements (card 71x92 at 83px, 16px gaps, 2px frame, 5px split)
  // are now editable, so they live as the fallbacks of the matching custom
  // properties -- identical pixels when the merchant changes nothing. The
  // desktop card scales from one digit-size control; the two mobile step-downs
  // at 749px and 480px stay fixed literals so the approved narrow-screen fitting
  // is untouched.
  assert.match(source, /width: calc\(var\(--dc-digit-size, 83px\) \* 71 \/ 83\);\s*\n\s*height: calc\(var\(--dc-digit-size, 83px\) \* 92 \/ 83\);/);
  assert.match(source, /font-size: var\(--dc-digit-size, 83px\);/);
  assert.match(source, /gap: var\(--dc-card-gap, 16px\);/);
  assert.match(source, /border: 2px solid var\(--dc-frame-color, #000\);/);
  assert.match(source, /height: 5px;/);
  assert.match(source, /@media screen and \(max-width: 749px\)/);
  assert.match(source, /@media screen and \(max-width: 480px\)/);
  assert.match(source, /width: 48px;\s*\n\s*height: 68px;/);
  assert.match(source, /width: 36px;\s*\n\s*height: 52px;/);
});

test('exposes spacing, size and colour controls with the live values as defaults', () => {
  // The whole point of this section being editable is that nothing moves until a
  // merchant moves it: every new control defaults to the measurement the live
  // counter already uses, so adding the controls is a no-op on render.
  const schema = JSON.parse(schemaMatch[1]);
  const setting = (id) => schema.settings.find((item) => item.id === id);

  const numericDefaults = {
    'padding-block-start': 43,
    'padding-block-end': 52,
    'padding-inline-start': 30,
    'padding-inline-end': 30,
    digit_size: 83,
    card_gap: 16,
    heading_size: 16,
    subtitle_size: 16,
  };
  for (const [id, def] of Object.entries(numericDefaults)) {
    assert.ok(setting(id), `missing control ${id}`);
    assert.equal(setting(id).default, def, `${id} default drifted from the live value`);
  }

  // spacing-style reads exactly these four ids, so the padding controls only
  // work if they are named for the properties they feed.
  assert.match(source, /{% render 'spacing-style', settings: section\.settings %}/);

  const colourDefaults = {
    heading_color: '#fbf8f3',
    subtitle_color: '#fbf8f3',
    card_bg_color: '#f2f0eb',
    card_ink_color: '#441925',
    frame_color: '#000000',
  };
  for (const [id, def] of Object.entries(colourDefaults)) {
    assert.ok(setting(id), `missing colour ${id}`);
    assert.equal(setting(id).default.toLowerCase(), def, `${id} default drifted from the live value`);
  }
});

test('uses the theme brand font tokens rather than hard-coded families', () => {
  assert.match(source, /--font-brand-text/);
  assert.match(source, /--font-brand-display/);
  assert.doesNotMatch(source.replace(/{%-? comment -?%}[\s\S]*?{%-? endcomment -?%}/g, ''), /Palmer Lake/);
});

test('is placeable from the theme editor', () => {
  assert.ok(schemaMatch);
  const schema = JSON.parse(schemaMatch[1]);
  const setting = (id) => schema.settings.find((item) => item.id === id);
  for (const id of ['bg_color', 'title', 'subtitle', 'learn_more_text', 'learn_more_url']) {
    assert.ok(setting(id), `missing setting ${id}`);
  }
  assert.equal(setting('bg_color').default, '#441925');
  assert.ok(schema.presets?.length, 'needs a preset so it can be added in the editor');
});

test('does not render an empty CTA when no url is set', () => {
  // learn_more_text ships a nonblank default ("Shop Coffees") but
  // learn_more_url has none, so guarding on the text alone renders
  // <a href=""> -- a CTA that silently reloads the page -- on every
  // instance added from the preset. Codex flagged this on PR #149.
  assert.match(
    source,
    /if section\.settings\.learn_more_text != blank and section\.settings\.learn_more_url != blank/
  );
  // The guard is permanent, not a workaround: Shopify's schema does not support
  // `default` on a `url` setting, and none of this theme's url settings has one.
  const schema = JSON.parse(schemaMatch[1]);
  const urls = schema.settings.filter((item) => item.type === 'url');
  assert.ok(urls.length > 0);
  for (const setting of urls) {
    assert.equal(setting.default, undefined, `url setting ${setting.id} cannot carry a default`);
  }
});

test('a six-figure total still fits a 320px viewport', () => {
  // $ + n digits + a comma every third digit, so six digits is 8 children:
  // 7x36 + 14 + 7x2 + 16 + 4 = 300px against 320 - 30 = 290px available.
  // The 8th-child guard shrinks only that case, so the five-digit rendering
  // matched against the live counter is untouched. Codex + reviewer, PR #150.
  assert.match(source, /:has\(> \.donation-counter__card:nth-child\(8\)\)/);
  const [, mobile] = source.split('@media screen and (max-width: 480px)');
  const guarded = mobile.split(':has(> .donation-counter__card:nth-child(8))').slice(1).join('');
  assert.match(guarded, /width: 32px;/);
  assert.match(guarded, /width: 12px;/);
  const card = 32, comma = 12, gap = 2, pad = 8, border = 2;
  const width = 7 * card + comma + 7 * gap + 2 * pad + 2 * border;
  assert.ok(width <= 320 - 2 * 15, `six-digit row is ${width}px, must fit 290px`);
});

test('the homepage CTA points at the campaign collection, as live does', () => {
  // Live sends this CTA to /collections/donation-products (14 participating
  // products), not /collections/all (90, most of which contribute nothing).
  const index = readFileSync(resolve(root, 'templates/index.json'), 'utf8');
  const settings = JSON.parse(index.replace(/\/\*[\s\S]*?\*\//g, '')).sections.wfg_donation_counter.settings;
  assert.equal(settings.learn_more_url, 'shopify://collections/donation-products');
});

test('the promo badge is available inside product cards, as on live', () => {
  // Live renders ona-product-tags on every coffee card -- that is where the
  // "$3 PER 200G ... DONATED TO WATER FOR GOOD" line comes from on the
  // homepage and on collection pages. In this theme the card is composed from
  // child blocks, so the type has to be accepted by _product-card before it
  // can be placed in any template.
  const card = readFileSync(resolve(root, 'blocks/_product-card.liquid'), 'utf8');
  const schema = JSON.parse(card.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/)[1]);
  assert.ok(
    schema.blocks.some((block) => block.type === 'ona-product-tags'),
    'product cards cannot show the promo badge'
  );
});

test('the promo badge is actually placed on the card surfaces live uses', () => {
  // Accepting the type only makes it selectable in the editor -- _product-card
  // renders the children each template configures, so an unplaced block ships
  // nothing. Live renders the badge through snippets/ona-product-card.liquid,
  // which is used by recommendations, search, main-collection and
  // featured-collection -- not by cart or 404. Those four get it here.
  // Position matches live: straight after the gallery, ahead of the title.
  const surfaces = [
    ['templates/index.json', 'coffee_spotlight', 'static-product-card'],
    ['templates/collection.json', 'main', 'product-card'],
    ['templates/search.json', 'main', 'product-card'],
    ['templates/product.json', 'product_recommendations_qggXJq', 'static-product-card'],
  ];
  for (const [file, section, card] of surfaces) {
    const raw = readFileSync(resolve(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const config = JSON.parse(raw).sections[section].blocks[card];
    assert.equal(config.blocks.ona_promo_tags?.type, 'ona-product-tags', `${file}: block missing`);
    const order = config.block_order;
    const at = order.indexOf('ona_promo_tags');
    assert.ok(at > 0, `${file}: not in block_order`);
    assert.match(order[at - 1], /gallery/, `${file}: should follow the gallery`);
  }
});

test('cart and 404 cards stay badge-free, as on live', () => {
  for (const [file, section, card] of [
    ['templates/cart.json', 'product_list_NNFgcy', 'static-product-card'],
    ['templates/404.json', 'product_list_iA96Tq', 'static-product-card'],
  ]) {
    const raw = readFileSync(resolve(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const config = JSON.parse(raw).sections[section].blocks[card];
    assert.ok(!config.block_order.includes('ona_promo_tags'), `${file}: live has no badge here`);
  }
});
