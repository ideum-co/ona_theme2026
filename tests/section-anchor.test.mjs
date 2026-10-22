import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const stripBanner = (text) => text.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
const schemaOf = (file) =>
  JSON.parse(read(file).match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/)[1]);

/* A URL fragment: what an href="#..." can actually reach. */
const FRAGMENT = /^[A-Za-z][\w:.-]*$/;

/*
 * /pages/wholesale navigates to itself -- `ona-icon-and-content` links to four #anchors, and
 * each is the `id` setting of another legacy section on the page. Horizon's `section` had no
 * equivalent, so rebuilding any of those four would have broken a link on the same page. This
 * setting is the replacement, and these tests pin the three things that make it a replacement
 * rather than a lookalike: it exists, it renders only when set, and it can carry the values
 * actually in use.
 */
test('the section anchor setting exists and offers no default', () => {
  const setting = (schemaOf('sections/section.liquid').settings ?? []).find((entry) => entry.id === 'anchor');
  assert.ok(setting, 'sections/section.liquid has no anchor setting');
  assert.equal(setting.type, 'text', 'the anchor must be free text; a merchant types the fragment');
  assert.ok(setting.label, 'the anchor setting has no label');
  assert.ok(setting.info, 'the anchor setting has no info text explaining the missing #');

  /* Shopify silently rejects a schema whose text setting defaults to an empty string, which
     would take the whole section's schema down with it rather than erroring visibly. */
  assert.ok(
    !Object.hasOwn(setting, 'default'),
    'the anchor setting declares a default; an empty-string default is silently rejected and takes the schema with it'
  );
});

/*
 * The snippet is shared: sections/_blocks.liquid renders it too and has no anchor setting, so an
 * unconditional id would emit id="" on every section in the theme. The guard reads the
 * conditional rather than the attribute, because the attribute alone is what the bug looks like.
 */
test('the section renders an anchor only when one is set', () => {
  const snippet = read('snippets/section.liquid');
  const emitted = snippet.match(/id="\{\{\s*section\.settings\.anchor[^"]*"/g) ?? [];
  assert.equal(emitted.length, 1, `the anchor id is emitted ${emitted.length} times; expected exactly one`);

  /* `[^>]*` keeps the match inside one opening tag: an id emitted after the tag closes is a
     bare id="..." in the markup, which renders but anchors nothing. */
  const guarded = /<div[^>]*\{%-?\s*if\s+section\.settings\.anchor\s*!=\s*blank\s*%\}\s*id="\{\{\s*section\.settings\.anchor\s*\|\s*escape\s*\}\}"\s*\{%-?\s*endif\s*%\}/;
  assert.match(
    snippet.replace(/\n\s*/g, ' '),
    guarded,
    'the anchor id is not inside the section tag, not wrapped in a blank check, or not escaped; _blocks.liquid shares this snippet and sets no anchor'
  );

  assert.ok(
    !(schemaOf('sections/_blocks.liquid').settings ?? []).some((entry) => entry.id === 'anchor'),
    '_blocks.liquid now has its own anchor setting; this guard assumed it does not'
  );
});

/*
 * Two claims about stored anchors, in the one place that can see them all.
 *
 * Shape: the editor writes "" for a text setting with no default -- `ona-wholesale-sourcing-v2`
 * declares `id` the same way and `page.wholesale.json` carries seven empty ones -- so a blank
 * anchor is the unset state, not a bad value. Anything else must be reachable by an href, which
 * also catches a merchant who typed the # the info text tells them to leave off.
 *
 * Uniqueness: two sections in one template claiming the same id is a link that reaches whichever
 * the browser happens to pick. Nothing is set today, so both assertions are vacuous at this
 * commit -- that vacuity is the inertness this PR rests on, and it is now measured rather than
 * asserted in a comment. The rebuild makes them real.
 *
 * Section groups are in scope: `section` is disabled only on `header`, so footer-group.json can
 * hold one.
 */
test('every stored anchor is reachable and unambiguous', () => {
  const files = [
    ...readdirSync(join(root, 'templates')).filter((name) => name.endsWith('.json')).map((name) => join('templates', name)),
    ...readdirSync(join(root, 'sections')).filter((name) => name.endsWith('.json')).map((name) => join('sections', name)),
  ];

  const unreachable = [];
  const duplicated = [];
  let set = 0;
  for (const file of files) {
    const parsed = JSON.parse(stripBanner(read(file)));
    const seen = new Map();
    for (const [key, section] of Object.entries(parsed.sections ?? {})) {
      const anchor = (section.settings ?? {}).anchor;
      if (anchor == null || String(anchor).trim() === '') continue;
      set += 1;
      if (typeof anchor !== 'string' || !FRAGMENT.test(anchor)) {
        unreachable.push(`${file} ${key}: ${JSON.stringify(anchor)}`);
        continue;
      }
      if (seen.has(anchor)) duplicated.push(`${file}: ${anchor} on both ${seen.get(anchor)} and ${key}`);
      seen.set(anchor, key);
    }
  }

  assert.deepEqual(unreachable, [], 'these anchors are not usable as a URL fragment');
  assert.deepEqual(duplicated, [], 'these templates give two sections the same anchor');
  assert.ok(files.length >= 7, `only ${files.length} section-bearing JSON files scanned; the probe is broken`);
  assert.equal(set, 0, `${set} section(s) now set an anchor; this PR claimed none did, so re-check that claim before trusting it`);
});

/*
 * The reason the setting exists. If the live anchors ever become something this setting cannot
 * carry, the rebuild plan is wrong and this says so before the swap, not after.
 */
test('the wholesale anchors the contents list points at are expressible as this setting', () => {
  const parsed = JSON.parse(stripBanner(read('templates/page.wholesale.json')));
  const sections = Object.values(parsed.sections ?? {});
  const owned = new Map();
  for (const section of sections) {
    const id = (section.settings ?? {}).id;
    if (typeof id === 'string' && id) owned.set(id, section.type);
  }

  /* Scoped to the contents list itself. Counting every in-page link on the page happens to give
     the same four today, which would make this pass for a reason that has nothing to do with the
     section the PR is about. */
  const contents = sections.filter((section) => section.type === 'ona-icon-and-content');
  assert.equal(contents.length, 1, `wholesale has ${contents.length} ona-icon-and-content sections; expected the one contents list`);

  const targets = new Set();
  const visit = (node) => {
    for (const value of Object.values(node.settings ?? {})) {
      if (typeof value === 'string' && value.startsWith('#') && owned.has(value.slice(1))) {
        targets.add(value.slice(1));
      }
    }
    for (const child of Object.values(node.blocks ?? {})) visit(child);
  };
  visit(contents[0]);

  assert.ok(targets.size >= 4, `only ${targets.size} in-page anchor targets found in the contents list; the probe is broken`);
  const unusable = [...targets].filter((anchor) => !FRAGMENT.test(anchor));
  assert.deepEqual(unusable, [], 'these live anchors cannot be carried by the new setting');
});
