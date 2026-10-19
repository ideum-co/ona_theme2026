import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

/*
 * Shopify renders a template section whose Liquid file is missing as nothing at
 * all -- no error, no placeholder, HTTP 200. On 2026-10-19 /pages/faq and
 * /pages/subscription-faq were serving 27 and 33 words against the live
 * theme's 1209 and 1206, because the FAQ content lives entirely in the
 * template and sections/ona-faq-layout.liquid had never been ported into this
 * repo. Nothing failed; the pages were simply blank below the title.
 *
 * These assertions bind every template to the files it names.
 */

// A .json template carries the editor's auto-generated /* ... */ banner.
const parseTemplate = (path) => JSON.parse(read(path).replace(/\/\*[\s\S]*?\*\//, ''));

/*
 * A section may legitimately ship without a {% schema %} -- sections/
 * ona-bookings-top.liquid and ona-training-iframe.liquid are static markup and
 * take no settings. Those are read as declaring nothing, so a template that
 * does pass them a setting still fails below.
 */
const schemaOf = (liquidPath) => {
  const match = read(liquidPath).match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  if (!match) return { settings: [], blocks: [] };
  return JSON.parse(match[1]);
};

const templates = readdirSync(resolve(root, 'templates'))
  .filter((name) => name.endsWith('.json'))
  .map((name) => `templates/${name}`);

/** Settings a schema declares, including those nested under a header/group. */
const declaredSettings = (schema) =>
  new Set((schema.settings ?? []).map((setting) => setting.id).filter(Boolean));

/**
 * Where a block type's schema lives: a file under blocks/, or an inline
 * definition in the parent's own "blocks" array (section-local blocks).
 */
const resolveBlock = (type, parentSchema) => {
  const inline = (parentSchema.blocks ?? []).find((b) => b.type === type && b.settings);
  if (inline) return { schema: inline, origin: 'inline' };
  const path = `blocks/${type}.liquid`;
  if (existsSync(resolve(root, path))) return { schema: schemaOf(path), origin: path };
  return null;
};

const walkBlocks = (owner, ownerSchema, ownerLabel, problems) => {
  for (const [key, block] of Object.entries(owner.blocks ?? {})) {
    const label = `${ownerLabel} > ${key} (${block.type})`;
    // App blocks ship inside the app, not this repo -- Judge.me's review widget
    // is one. Nothing here can tell whether they resolve.
    if (block.type.startsWith('shopify://apps/')) continue;
    const resolved = resolveBlock(block.type, ownerSchema);
    if (!resolved) {
      problems.push(`${label}: no blocks/${block.type}.liquid and no inline definition`);
      continue;
    }
    /*
     * Deliberately not asserting the parent's "blocks" list permits this type.
     * Horizon places many blocks statically with {% content_for 'block' %} --
     * buy-buttons, _product-card, _media-without-appearance and friends -- and
     * a parent never declares those, so the check only produced noise.
     */
    const declared = declaredSettings(resolved.schema);
    for (const id of Object.keys(block.settings ?? {})) {
      if (!declared.has(id)) problems.push(`${label}: setting "${id}" is not in ${resolved.origin}`);
    }
    walkBlocks(block, resolved.schema, label, problems);
  }
};

test('every template section and block resolves to a file that declares it', () => {
  const problems = [];
  for (const path of templates) {
    const template = parseTemplate(path);
    for (const [key, section] of Object.entries(template.sections ?? {})) {
      const label = `${path} > ${key} (${section.type})`;
      const liquid = `sections/${section.type}.liquid`;
      if (!existsSync(resolve(root, liquid))) {
        problems.push(`${label}: ${liquid} does not exist -- the section renders as nothing`);
        continue;
      }
      const schema = schemaOf(liquid);
      const declared = declaredSettings(schema);
      for (const id of Object.keys(section.settings ?? {})) {
        if (!declared.has(id)) problems.push(`${label}: setting "${id}" is not in ${liquid}`);
      }
      walkBlocks(section, schema, label, problems);
    }
  }
  assert.deepEqual(problems, [], `\n${problems.join('\n')}\n`);
});

test('nothing is stranded outside order or block_order', () => {
  /*
   * Shopify renders from "order" and "block_order", not from the "sections" and
   * "blocks" maps. A key left out of them keeps all its content in the file and
   * still renders nothing, which is invisible to any check that counts the maps
   * -- as an earlier draft of the test below was.
   */
  const problems = [];
  /*
   * Only the reverse direction is checked for blocks. A block absent from
   * block_order is usually a statically placed one -- Horizon writes
   * {% content_for 'block', id: 'static-product-card' %} and never lists it --
   * so requiring every block to appear there is wrong. A block_order entry with
   * no block behind it is always a bug.
   */
  const walk = (owner, label) => {
    const keys = Object.keys(owner.blocks ?? {});
    for (const key of owner.block_order ?? []) {
      if (!keys.includes(key)) problems.push(`${label}: block_order names "${key}", which has no block`);
    }
    for (const key of keys) walk(owner.blocks[key], `${label} > ${key}`);
  };
  for (const path of templates) {
    const template = parseTemplate(path);
    const order = template.order ?? [];
    for (const key of Object.keys(template.sections ?? {})) {
      // Sections are never placed statically, so every one must be in "order".
      if (!order.includes(key)) problems.push(`${path} > ${key}: missing from order`);
      walk(template.sections[key], `${path} > ${key}`);
    }
    for (const key of order) {
      if (!(key in (template.sections ?? {}))) {
        problems.push(`${path}: order names "${key}", which has no section`);
      }
    }
  }
  assert.deepEqual(problems, [], `\n${problems.join('\n')}\n`);
});

test('the two FAQ pages still carry their questions', () => {
  // Guards the port itself: these are the counts the live theme served on
  // 2026-10-19. Counted through block_order, which is what actually renders.
  for (const [path, categories, items] of [
    ['templates/page.faq.json', 3, 14],
    ['templates/page.faq-subscriptions.json', 1, 14],
  ]) {
    const layout = parseTemplate(path).sections.faq_layout;
    assert.equal(layout.block_order.length, categories, `${path}: category count`);
    const total = layout.block_order.reduce((n, key) => n + layout.blocks[key].block_order.length, 0);
    assert.equal(total, items, `${path}: question count`);
    for (const categoryKey of layout.block_order) {
      const category = layout.blocks[categoryKey];
      for (const itemKey of category.block_order) {
        const item = category.blocks[itemKey];
        assert.ok(item.settings.title?.trim(), `${path}: a question has no title`);
        assert.ok(item.settings.content?.trim(), `${path}: "${item.settings.title}" has no answer`);
      }
    }
  }
});

test('the FAQ page has a real heading outline', () => {
  /*
   * h1 (ona-page-title) > h2 (category) > h3 (question). The live theme put
   * questions in <div class="accordion-title">, so /pages/faq and
   * /pages/subscription-faq have never had an outline -- 1209 words of
   * question-and-answer copy with nothing for a search engine or a screen
   * reader rotor to navigate by. A bare <summary> would not fix that either.
   */
  const category = read('blocks/_faq-category.liquid');
  assert.match(category, /<h2 class="ona-faq-category__heading/, 'category title must be an h2');

  const item = read('blocks/_faq-item.liquid');
  const summary = item.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
  assert.ok(summary, '_faq-item must render a <summary>');
  assert.match(summary[1], /<h3 class="ona-faq-item__question"/, 'question must be an h3 inside the summary');

  // The h3 must hand typography back to the accordion, or it renders at h3 size
  // and the semantic change becomes a visual regression.
  assert.match(
    item,
    /\.ona-faq-item__question\s*\{[^}]*\bfont:\s*inherit\b/,
    '.ona-faq-item__question must reset font to inherit',
  );
});

test('a printed FAQ carries its answers', () => {
  /*
   * Every row starts closed, and a closed <details> does not open itself for
   * print the way current browsers open it for find-in-page. With no other
   * @media print rule anywhere in this repo, /pages/faq printed as fourteen
   * questions with nothing under them. Codex, PR #192.
   *
   * Three mechanisms hide the content, so all three are asserted: the theme's
   * own .details-content rule, the ::details-content pseudo-element, and the
   * older UA rule that hides a closed details' non-summary children.
   */
  const item = read('blocks/_faq-item.liquid');
  const print = item.match(/@media print \{([\s\S]*?)\n  \}/);
  assert.ok(print, '_faq-item must carry print styles');

  assert.match(print[1], /\.ona-faq-item__details \.details-content/,
    "the theme's own .details-content rule must be answered");
  assert.match(print[1], /\.ona-faq-item__details::details-content/,
    'the ::details-content pseudo-element must be answered');
  assert.match(print[1], /content-visibility:\s*visible/,
    'content-visibility must be restored');

  /*
   * The two must not share a selector list. A selector list is invalid as a
   * whole if any one selector in it is, so a browser without ::details-content
   * would discard the rule and the legacy override with it -- in exactly the
   * browsers that need it. Codex, PR #192, against the first version of this fix.
   */
  assert.doesNotMatch(
    print[1],
    /\.details-content\s*,\s*[^{]*::details-content|::details-content\s*,/,
    '::details-content must not share a selector list with anything else',
  );
  assert.match(print[1], /:not\(\[open\]\) > \*:not\(summary\)/,
    "the older UA rule hiding a closed details' children must be answered");

  // The rules key off this class, so the details element has to carry it.
  assert.match(item, /<details class="details ona-faq-item__details"/,
    'the details element must carry the class the print rules target');
});
