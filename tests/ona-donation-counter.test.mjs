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
    /\.donation-counter__cta\s*{/,
  ]) {
    assert.match(source, rule);
  }
});

test('keeps the approved measurements the live counter uses', () => {
  // Pixel parity with the live theme: card 71x92 at 83px, 16px gaps, 2px
  // frame, 5px split line, and the two step-downs at 749px and 480px.
  assert.match(source, /width: 71px;\s*\n\s*height: 92px;/);
  assert.match(source, /font-size: 83px;/);
  assert.match(source, /gap: 16px;/);
  assert.match(source, /border: 2px solid #000;/);
  assert.match(source, /height: 5px;/);
  assert.match(source, /@media screen and \(max-width: 749px\)/);
  assert.match(source, /@media screen and \(max-width: 480px\)/);
  assert.match(source, /width: 48px;\s*\n\s*height: 68px;/);
  assert.match(source, /width: 36px;\s*\n\s*height: 52px;/);
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
