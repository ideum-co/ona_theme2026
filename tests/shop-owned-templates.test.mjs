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
 * Procedure before merging anything that touches these files: compare the
 * theme's `checksumMd5` with the md5 of the repo file. Equal means the
 * integration wrote it and the editor has not diverged it -- safe.
 *
 * Unequal means NOTHING on its own, and reading it as "the editor diverged it"
 * is wrong. The editor stores these minified while this repo carries them
 * pretty-printed, so the hashes differ on encoding alone: on 2026-10-21
 * index.json reported size 115283 against a body of 188663 bytes. Treating
 * that as drift flags every release and trains people to skip the check.
 *
 * On unequal, fetch `body.content` and compare the PARSED JSON -- flatten both
 * sides to leaf paths and diff the sets. Do not md5 the body either; it is a
 * pretty-printed rendering of the stored bytes and matches neither side.
 *
 * "Both sides" means the live body and the DEPLOYED revision -- `git show
 * origin/main:templates/product.json` -- never the copy on your release
 * branch. A release PR changes one of these files on purpose, so diffing live
 * against the branch reports your own edits as editor drift and sends you off
 * to "reconcile" the release away. Inspect the branch's diff separately with
 * `git diff origin/main...HEAD -- templates/ config/settings_data.json`.
 * If `git show origin/main:<file>` fails the file is a first-time import:
 * live is the baseline and there is nothing to reconcile.
 *
 * Semantically identical means encoding only, and is safe. See §5 of
 * docs/branching-and-release.md, which this header mirrors.
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

/**
 * Every node the theme editor has switched off, at ANY depth, as sorted dotted
 * paths -- `section`, or `section.block`, or `section.block.nested`.
 *
 * It recurses because a first version looked only at top-level sections, and
 * the empty Brew Guide tab is a BLOCK: `product_tabs_fW4maV.product_tab_4tzPxX`.
 * Re-enabling it put that tab back on all 92 PDPs with the suite still green.
 */
const disabledPaths = (sections) => {
  const found = [];
  const walk = (node, path) => {
    for (const [id, child] of Object.entries(node.blocks ?? {})) {
      const childPath = `${path}.${id}`;
      if (child.disabled === true) found.push(childPath);
      walk(child, childPath);
    }
  };
  for (const [id, section] of Object.entries(sections)) {
    if (section.disabled === true) found.push(id);
    walk(section, id);
  }
  return found.sort();
};

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
  // This asserts the WHOLE disabled set at every depth, not a chosen few. Two
  // earlier versions were incomplete: one listed six of thirteen sections while
  // claiming to list all, and the next still missed every nested block. Both
  // times a stale snapshot could re-enable something with the suite green --
  // the exact overwrite this file exists to catch. Comparing the complete set
  // also fails when something is newly disabled, which is the point: that is a
  // real change to the storefront and should take a deliberate edit to record.
  //
  // Measured 2026-10-16. find_your_coffee and product_highlight_KkUAVM were in
  // this list on 2026-10-14 and have since been switched back on in the editor;
  // product_highlight is now the home of the In Sequence campaign. The list
  // failing on that change is the mechanism working, not a stale test.
  assert.deepEqual(disabledPaths(sections), [
    'club_benefits',
    'club_benefits_QGRDdd',
    'club_invite_QLL4T3',
    'club_invite_TGPaF8',
    'collection_carousel_GRkRhJ.collection_f8jkdP',
    'discover_by_category',
    'floating_badge_r89NRP',
    'hero_ona.icon_9aLnRm',
    'press_band',
    'product_intro_k9p6yn',
    'raspberry_candy',
    'slideshow_nBcaMx.slide_8Ar7Nq',
    'special_release',
    'story_video_LN6zzn',
  ], 'the set of disabled homepage sections and blocks changed');

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

  // The whole disabled set, for the reason given in the index.json test above.
  // `story`, `brew_guide` and `faqs` are superseded by the bespoke sections and
  // enabling them double-renders. `product_dna_trxBBN` re-enabled puts
  // "Maple DNA" back on all 92 products; `product_tabs_XnTEpK` duplicates the
  // product tabs.
  assert.deepEqual(disabledPaths(sections), [
    'brew_guide',
    'faqs',
    // Superseded by blocks/pdp-product-summary.liquid; re-enabling these
    // double-renders the summary. See the 2026-theme notes on group_icgrde.
    'main.product-details.best_for_pdp',
    'main.product-details.divider_VJhene',
    'main.product-details.group_icgrde',
    'main.product-details.tastes_like_pdp',
    'product_dna_trxBBN',
    'product_tabs_XnTEpK',
    // Disabled in the theme editor on 2026-10-21, in the same save that added
    // `product_media_with_text_Vy9RW6`. That section supersedes this one: #259
    // and #261 built it as a dedicated, top-level "Product media with text",
    // and `section_EhyeAD` is the hand-rolled version it replaces. Leaving both
    // on double-renders the same idea. As with `story_video_VUwQ6f` below, the
    // editor's decision stands and this entry records it rather than reversing
    // it. Its image was rebound to `custom.who_is_for_image` in the same save.
    'section_EhyeAD',
    // `product_tabs_fW4maV.product_tab_4tzPxX`, the Brew Guide tab, is no longer
    // in this list. It was disabled because it was empty and would otherwise
    // have shown on all 92 PDPs; it now holds `product-brew-guide`, which emits
    // nothing on a product with no recipe, and #236's pruning then removes the
    // tab. The 37 merch and equipment products still never see it.
    'story',
    // Disabled in the theme editor after the repo's copy was taken, and picked
    // up when the live template was reconciled back into git. The editor's
    // decision stands; this entry records it rather than reversing it.
    'story_video_VUwQ6f',
  ], 'the set of disabled PDP sections and blocks changed');
});

test('product.merch.json keeps the editor-wired merch PDP', () => {
  // This template renders 21 products -- every Merch item plus the V60 filter
  // papers -- and lived only on the live theme until 2026-10-21. It gets the
  // same pinning as product.json for the same reason: it is editor-written, so
  // a merge from a stale snapshot overwrites it silently.
  const { sections, order } = readTemplate('product.merch.json');

  assert.equal(order.length, Object.keys(sections).length, 'order and sections disagree');
  assert.equal(sections.main.type, 'product-information');

  // The whole disabled set, at every depth, for the reason given in the
  // index.json test above.
  //
  // The two entries that matter most are the tabs: this template switches OFF
  // both `product_tab_ePcCkQ` (Profile) and `product_tab_4tzPxX` (Brew Guide),
  // which `templates/product.json` leaves on. That is the merch template doing
  // its job -- a t-shirt has no tasting profile and no recipe -- and it is why
  // the "TASTES LIKE" label with nothing after it is not a merch problem.
  //
  // It is, however, an equipment problem, and not because of this file: 21
  // Brew Gear products carry `templateSuffix: "product-2"` and one carries
  // "product-3", and neither template exists on the theme or in this repo. The
  // storefront falls back to `templates/product.json`, so a V60 dripper renders
  // the coffee Profile tab. Re-pointing those products at this template is the
  // fix -- but not before the FAQs tab below exists here, which is the one
  // thing those products would otherwise lose.
  //
  // The FAQs tab is the one thing this template was missing that its products
  // actually have. `custom.accordion` is populated on 11 of the ACTIVE Brew
  // Gear products still pointed at product-2/product-3, and on two products
  // already on this template -- hario-v60-filter-papers-1 and
  // water-for-good-bottle -- whose FAQs have therefore never rendered. The
  // other coffee-only sections are safe to lose: not one equipment product has
  // origin_intro, producer, brew_guide_intro, who_is_for or profile_image.
  //
  // blocks/product-faqs.liquid emits nothing without an answerable FAQ and
  // #236 prunes the empty tab, so a t-shirt is unaffected by this being here.
  // Reassigning products to this template is only non-destructive while it
  // stays.
  {
    const tabs = sections.product_tabs_fW4maV;
    assert.ok(
      tabs.block_order.includes('product_tab_faqs_Jv4Wmd'),
      'the merch PDP must carry the FAQs tab, or reassigned products lose their FAQs',
    );
    const faqTab = tabs.blocks.product_tab_faqs_Jv4Wmd;
    assert.equal(faqTab.settings.label, 'FAQs');
    assert.equal(faqTab.blocks.product_faqs_Zb9Nxe.type, 'product-faqs');
  }

  // The summary line must stay blank here. blocks/pdp-product-summary.liquid
  // ships a richtext default of "Caramel, biscuits, nuts and spices" -- real
  // tasting notes, for a coffee -- and overrides it only from
  // accentuate.tastes_like. No merch or equipment product has that metafield,
  // so any non-blank value here prints coffee tasting notes on every t-shirt,
  // tote, board game, grinder and dripper. It did, until 2026-10-21.
  //
  // Blank is the deliberate state, not an oversight: the block's own
  // `if summary_description != blank` guard prunes the line, and the
  // description_key wiring is left in place so populating
  // accentuate.tastes_like on a merch product is all it takes to give these
  // PDPs their own summary copy later.
  {
    const summary = sections.main.blocks['product-details'].blocks.pdp_product_summary.settings;
    assert.equal(
      summary.description,
      '',
      'the merch summary line must stay blank -- a value here prints coffee tasting notes on merch',
    );
    assert.equal(summary.description_key, 'tastes_like', 'keep the metafield override wired for later');
    assert.equal(summary.namespace, 'accentuate');
  }
  assert.deepEqual(disabledPaths(sections), [
    'brew_guide',
    'faqs',
    'main.product-details.best_for_pdp',
    'main.product-details.divider_VJhene',
    'main.product-details.group_icgrde',
    'main.product-details.tastes_like_pdp',
    'product_dna_trxBBN',
    'product_tabs_XnTEpK',
    'product_tabs_fW4maV.product_tab_4tzPxX',
    'product_tabs_fW4maV.product_tab_ePcCkQ',
    'section_EhyeAD',
    'story',
    'story_video_VUwQ6f',
  ], 'the set of disabled merch PDP sections and blocks changed');

  // The badges come from the metafield, as #257 made them everywhere else.
  // This file carried `badge_1`/`badge_2` -- "Staple Range", "Best with Milk"
  // -- hard-coded onto every merch product, because #257 could not reach a file
  // that was not in the repository. The block stopped reading them, so they
  // rendered nothing and simply sat here; the next person to read this template
  // would reasonably have believed they were live.
  const summary = sections.main.blocks['product-details'].blocks.pdp_product_summary.settings;
  for (const dead of ['badge_1', 'badge_2', 'badge_1_key', 'badge_2_key']) {
    assert.ok(!(dead in summary), `${dead} is a pre-#257 setting the block no longer reads`);
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

test('the coffee spotlight card keeps the price Victor added in #185', () => {
  // The homepage card showed no price until PR #185 added a `price` block to
  // `coffee_spotlight > static-product-card`. That block lives only in this
  // shop-owned JSON, so it is exactly the kind of thing a reconciliation from a
  // stale snapshot drops without a word -- `staging-v2` was missing it within a
  // day of the merge. Pin the block, its type and its place in the order.
  const card = readTemplate('index.json').sections.coffee_spotlight.blocks['static-product-card'];

  assert.equal(card.blocks.card_price?.type, 'price', 'the card price block is gone');
  assert.ok(
    card.block_order.includes('card_price'),
    'card_price exists but is not in block_order, so it does not render',
  );
  assert.deepEqual(
    card.block_order.slice(-3),
    ['card_price', 'variant_picker', 'buy_group'],
    'the price must sit directly above the variant picker and buy button',
  );
});

test('the release procedure never sends anyone to the retired staging branch', () => {
  // `staging` died on 2026-10-16 (docs/branching-and-release.md §1a) and
  // `staging-v2` replaced it. The rename missed the numbered release steps, so
  // §4 still told maintainers to open the release PR from the dead branch --
  // which would ship nothing, because every change now lands on `staging-v2`.
  // Codex caught it on PR #191.
  //
  // This checks the two places that actually route somebody, not every mention
  // of the word: §1a and §2 name `staging` on purpose, step 3 says "the staging
  // theme" as a common noun, and step 4 now names it in a warning NOT to use it.
  // A word-level lint flagged all three and would have to be weakened until it
  // caught nothing.
  const doc = readFileSync(resolve(root, 'docs/branching-and-release.md'), 'utf8');
  const flow = doc.slice(doc.indexOf('## 4. The flow'), doc.indexOf('## 5.'));
  assert.ok(flow.length > 200, 'could not locate the flow section');

  // a. the release PR's source branch
  assert.match(flow, /release PR from `staging-v2` into\n\s*`main`/, 'step 4 must ship from staging-v2');
  assert.doesNotMatch(flow, /from `staging` into/, 'step 4 must not ship from the retired branch');

  // b. the branch the diagram shows feeding the preview theme
  const diagram = flow.slice(flow.indexOf('```'), flow.indexOf('```', flow.indexOf('```') + 3));
  assert.match(diagram, /ona_theme2026\/staging-v2/, 'the diagram must point the preview theme at staging-v2');
  assert.doesNotMatch(diagram, /ona_theme2026\/staging\b(?!-v2)/, 'the diagram still shows the retired branch');
});

test('page.location.json is declared shop-owned, and never carries the Maps key', () => {
  // This template holds a credential: the store finder's Google Maps API key is
  // a SECTION setting, so the theme editor writes it in here. The spec that
  // built the finder forbids committing the key, and
  // tests/locations-store-finder.test.mjs enforces that -- so the repository's
  // copy of this file is permanently one merge away from wiping the live value,
  // with no error anywhere. Decision (Felipe, 2026-10-19): the key stays in the
  // theme editor, and this file joins index.json, product.json and
  // settings_data.json under the reconcile-first rule.
  //
  // The two halves have to be asserted together. A reconcile rule nobody wrote
  // down is not a rule, and a file listed in a document the code does not check
  // drifts the first time someone edits one and not the other.
  const doc = readFileSync(resolve(root, 'docs/branching-and-release.md'), 'utf8');
  const shopOwned = doc.slice(doc.indexOf('## 5.'), doc.indexOf('## 6.'));

  for (const file of [
    'templates/index.json',
    'templates/product.json',
    'templates/product.merch.json',
    'templates/page.location.json',
    'config/settings_data.json',
  ]) {
    assert.ok(
      shopOwned.includes(`\`${file}\``),
      `${file} must be listed as shop-owned in docs/branching-and-release.md §5`,
    );
  }
  assert.match(shopOwned, /page\.location\.json.*credential/is, '§5 must say why this one is different');

  // §5 must not tell anyone that an unequal checksum proves editor drift.
  // These files are stored minified and this repo carries them pretty-printed,
  // so the hashes differ on encoding alone -- the check fires on every release
  // and gets ignored. Codex caught the procedure still saying so on PR #264,
  // in the same PR whose commit message documented the measurements.
  // The checksum can clear a file (equal means the integration wrote it) but
  // never convict one, so the procedure has to send an unequal result on to a
  // parsed comparison.
  assert.match(
    shopOwned,
    /minified/i,
    '§5 must explain that the editor stores these minified, or the checksum check reads as drift',
  );
  assert.match(
    shopOwned,
    /parsed JSON|parse both sides/i,
    '§5 must prescribe comparing parsed JSON when the checksum differs',
  );
  assert.match(
    shopOwned,
    /inconclusive/i,
    '§5 must say an unequal checksum is inconclusive rather than proof of drift',
  );

  // The parsed comparison needs the right baseline. A release PR deliberately
  // changes one of these files, so diffing live against the *branch* reports
  // the PR's own edits as editor drift and sends you off to "reconcile" away
  // the release. Codex, PR #264. The baseline is the deployed revision --
  // origin/main -- with the branch's own diff inspected separately.
  assert.match(
    shopOwned,
    /deployed pre-change revision[^`]*`git show origin\/main:/is,
    '§5 must name the deployed origin/main revision as the parsed-comparison baseline',
  );
  assert.match(
    shopOwned,
    /not\b[^.]*against the file on your release branch/is,
    '§5 must warn against diffing live against the release branch itself',
  );
  assert.match(
    shopOwned,
    /git diff origin\/main\.\.\.HEAD --\s*\n?\s*templates\/ config\/settings_data\.json/,
    "§5's separate diff must cover settings_data.json, which §5 governs too",
  );
  // A first-time import has no deployed baseline to diff against, so the
  // procedure has to say what to do instead of failing the command. Codex, #264.
  assert.match(
    shopOwned,
    /first-time import/i,
    '§5 must handle a file that is not yet in the deployed revision',
  );

  // The rule in §5 is only followed if it reaches the list people actually
  // tick. Codex, PR #191: §5 gained the re-enter step while §6's checklist
  // still asked only for the ordinary pre-merge reconcile.
  const checklist = doc.slice(doc.indexOf('## 6.'), doc.indexOf('## 7.'));
  assert.match(checklist, /page\.location\.json/, 'the release checklist must call out this template');

  // §5 can be perfectly correct and still change nothing, because the table
  // people actually fill in recorded only the two md5s and whether they matched
  // -- with no cell for the parsed result, an unequal hash reads as "reconcile"
  // and the destructive step §5 exists to prevent happens anyway. Codex, #264.
  assert.match(
    checklist,
    /inconclusive/i,
    'the checklist must say an unequal checksum is inconclusive, not grounds to reconcile',
  );
  assert.match(
    checklist,
    /parsed vs `origin\/main`/,
    'the checksum table must have a column for the parsed comparison against the deployed revision',
  );
  assert.match(
    checklist,
    /reconcile needed\?/i,
    'the checksum table must record the reconcile decision separately from the hash comparison',
  );

  // This file's own header restates the procedure, and has drifted from §5
  // three times on this PR alone -- each fix to the doc left the header saying
  // the superseded thing one file further from where anyone reads it. Codex,
  // #264. Pin the header against the same facts the doc is pinned against.
  const header = readFileSync(import.meta.filename, 'utf8').slice(0, 2500);
  for (const [pattern, what] of [
    [/origin\/main/, 'the deployed baseline'],
    [/config\/settings_data\.json/, 'settings_data.json in the release diff'],
    [/first-time import/i, 'the first-time-import case'],
  ]) {
    assert.match(header, pattern, `this file's header must mirror §5 on ${what}`);
  }
  assert.match(checklist, /re-enter the Google\n\s*Maps API key/i, 'and must say to re-enter the key after merging');
  assert.match(checklist, /mapsApiKey/, 'and must give the check that proves it took');

  const template = readTemplate('page.location.json');
  const key = template.sections.store_finder.settings?.maps_api_key;
  assert.ok(
    key === undefined || key === '',
    `the repository copy must never carry a Maps key; found ${JSON.stringify(key)}`,
  );
  assert.equal(
    template.sections.store_finder.settings?.default_view,
    'map',
    'the map leads on this page, as it does on the production theme',
  );
});

test('the promotion procedure prescribes a command that can actually run', () => {
  // Codex, PR #191. `main` requires linear history, so release PRs are
  // squashed, and the squashed commit is not a descendant of the branch it came
  // from -- the "fast-forward staging-v2 to main" the document prescribed is
  // refused every time. The document also claimed staging-v2 forbids
  // force-pushes, which would have left no way to resync at all. It carries no
  // protection whatsoever (GET .../protection → 404), so a reset is available;
  // the claim was simply wrong.
  const doc = readFileSync(resolve(root, 'docs/branching-and-release.md'), 'utf8');
  const flow = doc.slice(doc.indexOf('## 4. The flow'), doc.indexOf('## 5.'));

  assert.match(flow, /git branch -f staging-v2 origin\/main/, 'step 5 needs the reset command');
  assert.match(flow, /--force-with-lease/, 'and the lease that catches an unexpected divergence');
  assert.doesNotMatch(
    flow,
    /fast-forward `staging-v2`/,
    'fast-forwarding cannot work after a squash merge; the document must not ask for it',
  );

  // And the protection section must not re-assert the claim that made the
  // broken procedure look workable.
  const branches = doc.slice(doc.indexOf('## 2. The branches'), doc.indexOf('## 3.'));
  assert.match(branches, /no protection rules at all/, '§2 must state staging-v2 is unprotected');
});
