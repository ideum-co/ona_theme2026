import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

/*
 * These templates are shop-owned, and this theme IS GitHub-connected
 * (`ona_theme2026/main` on theme 154676789439). Merging to `main` makes the
 * integration pull within seconds and overwrite whatever the theme editor has
 * since changed -- there is no merge that only "lands in the repo".
 *
 * On 2026-10-14 a merge did exactly that: ten editor-made sections were
 * deleted, eighteen surviving sections lost their editor-set values, and three
 * disabled sections came back enabled. These assertions pin the sections,
 * states and placements that were restored, so the same loss fails the suite
 * instead of reaching the theme. If a change here is deliberate, update the
 * test in the same commit and say why in the message.
 *
 * Procedure before merging anything that touches these files:
 * compare the theme's `checksumMd5` with the md5 of the repo file. Equal means
 * the integration wrote it and the editor has not diverged it -- safe. Unequal
 * means the editor has, and the shop copy must be merged in first.
 */

const root = resolve(import.meta.dirname, '..');
const readTemplate = (name) =>
  JSON.parse(readFileSync(resolve(root, 'templates', name), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));

/*
 * Shopify's own limits, and they fail silently through the GitHub integration.
 * PR #151 left index.json at 28 sections; the integration wrote product.json
 * and simply declined index.json -- no error, no commit status, no sign in the
 * admin, and the theme kept the damaged copy while the repo looked correct.
 * The only symptom was that the file's checksum never changed. Keep every JSON
 * template inside the limits so the suite says so instead.
 * https://shopify.dev/docs/storefronts/themes/architecture/section-groups
 */
const MAX_SECTIONS = 25;
const MAX_BLOCKS = 50;

/*
 * Theme blocks nest, so a section's `blocks` object holds only its direct
 * children -- this theme already nests (`coffee_spotlight` ->
 * `static-product-card` -> `ona_promo_tags`). Count the whole subtree: the
 * stricter reading can only fail earlier, never later, and when the platform
 * refuses a file in silence the conservative bound is the useful one. The
 * deepest section here totals 19, so this costs nothing today. Codex, PR #152.
 */
const countBlocks = (blocks) =>
  Object.values(blocks ?? {}).reduce((total, block) => total + 1 + countBlocks(block.blocks), 0);

test('every JSON template is inside Shopify\'s section and block limits', () => {
  const dir = resolve(root, 'templates');
  const files = readdirSync(dir).filter((name) => name.endsWith('.json'));
  assert.ok(files.length > 0, 'no JSON templates found');

  for (const file of files) {
    const { sections = {}, order = [] } = readTemplate(file);
    const count = Object.keys(sections).length;

    assert.ok(
      count <= MAX_SECTIONS,
      `${file} has ${count} sections; Shopify renders at most ${MAX_SECTIONS}, so the integration will refuse the whole file`,
    );
    assert.equal(order.length, count, `${file}: order and sections disagree`);

    for (const [id, section] of Object.entries(sections)) {
      const direct = Object.keys(section.blocks ?? {}).length;
      const nested = countBlocks(section.blocks);
      assert.ok(
        nested <= MAX_BLOCKS,
        `${file}: section ${id} has ${nested} blocks counting nested ones (${direct} direct); the limit is ${MAX_BLOCKS}`,
      );
    }
  }
});

test('index.json keeps the editor-made homepage sections', () => {
  const { sections, order } = readTemplate('index.json');

  for (const id of [
    'floating_badge_r89NRP',
    'slideshow_nBcaMx',
    'club_benefits_937XiA',
    'section_LpJJ4p',
    'story_video_LN6zzn',
  ]) {
    assert.ok(sections[id], `editor-made section ${id} is missing`);
    assert.ok(order.includes(id), `editor-made section ${id} is not in order`);
  }

  // Editor-set values the repo copy did not carry, lost once already.
  assert.equal(sections.coffee_spotlight.settings.adaptive_max_width, 1280);
  assert.equal(sections.coffee_spotlight.settings.carousel_loop, true);
  assert.equal(sections.press_quotes_4kW9eF.settings.background_color, '{{ settings.color_palette.background }}');
  assert.equal(Object.keys(sections.hero_ona.blocks).length, 4);

  // Sections the editor had switched off. They came back enabled once.
  //
  // The three the editor disabled on 2026-10-14 at 21:59:21Z are pinned here
  // too. Without them a later stale reconciliation could silently re-enable a
  // section and still pass this suite -- which is the exact overwrite this
  // file exists to catch. Every id the editor turns off belongs in this list.
  for (const id of [
    'club_invite_TGPaF8',
    'club_benefits_QGRDdd',
    'product_intro_k9p6yn',
    'floating_badge_r89NRP',
    'find_your_coffee',
    'product_highlight_KkUAVM',
  ]) {
    assert.equal(sections[id].disabled, true, `${id} must stay disabled`);
  }

  // The WFG counter is the one deliberate addition, second on the page.
  assert.equal(order[1], 'wfg_donation_counter');
  assert.equal(sections.wfg_donation_counter.type, 'ona-donation-counter');
});

test('product.json keeps the editor-wired PDP', () => {
  const { sections, order } = readTemplate('product.json');

  for (const id of [
    'product_tabs_fW4maV',
    'story_video_VUwQ6f',
    'product_dna_trxBBN',
    'section_EhyeAD',
    'inline_cta_8ann9f',
  ]) {
    assert.ok(sections[id], `editor-made section ${id} is missing`);
    assert.ok(order.includes(id), `editor-made section ${id} is not in order`);
  }

  // Superseded by the bespoke sections above; enabling them double-renders the
  // brew guide, story and FAQs. The repo copy had all three on.
  //
  // product_dna_trxBBN and product_tabs_XnTEpK are the editor's own switch-offs:
  // re-enabling the first puts "Maple DNA" back on all 92 products, and the
  // second duplicates the product tabs. Pinned for the same reason as above.
  for (const id of [
    'story',
    'brew_guide',
    'faqs',
    'product_dna_trxBBN',
    'product_tabs_XnTEpK',
  ]) {
    assert.equal(sections[id].disabled, true, `${id} must stay disabled`);
  }
});

test('the promo badge stays on both card surfaces, after the gallery', () => {
  const surfaces = [
    ['index.json', 'coffee_spotlight', 'product_card_gallery'],
    ['product.json', 'product_recommendations_qggXJq', 'product_card_gallery_DNizbJ'],
  ];

  for (const [file, sectionId, galleryId] of surfaces) {
    const card = readTemplate(file).sections[sectionId].blocks['static-product-card'];
    assert.equal(card.blocks.ona_promo_tags.type, 'ona-product-tags', `${file}: badge block missing`);
    assert.deepEqual(
      card.block_order.slice(0, 2),
      [galleryId, 'ona_promo_tags'],
      `${file}: badge must sit immediately after the gallery`,
    );
  }
});
