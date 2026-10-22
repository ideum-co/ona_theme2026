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

/*
 * What an href="#..." can actually reach. HTML5 ids may start with a digit -- `2026-training` is
 * a working anchor -- so the old "must begin with a letter" rule was HTML4's and would have
 * blocked a legitimate value. What genuinely breaks a fragment link: whitespace, a leading `#`
 * (the typo the setting's info text warns about), and any character `| escape` rewrites, because
 * the rendered id then no longer equals what the merchant typed and the link misses silently.
 */
const FRAGMENT = /^[^\s#"'<>&]+$/;

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
 * Two claims about stored anchors, checked against the page a visitor actually gets.
 *
 * Shape: the editor writes "" for a text setting with no default -- `ona-wholesale-sourcing-v2`
 * declares `id` the same way and `page.wholesale.json` carries seven empty ones -- so a blank
 * anchor is the unset state, not a bad value. Anything else must be reachable by an href, which
 * also catches a merchant who typed the # the info text tells them to leave off.
 *
 * Uniqueness: an id is unique per *rendered page*, not per file. `layout/theme.liquid` pulls in
 * section groups on every template, and the legacy sections emit their `id` setting as a real
 * element id (`sections/ona-supported.liquid:3`, and a `slider-` variant on the same value), so
 * an anchor can collide with something declared in a different file and send a link to the wrong
 * element. The universe below is each template plus the groups the layout names -- read out of
 * the layout rather than listed here, so moving a group does not quietly shrink the check.
 *
 * Nothing is set today, so both assertions are vacuous at this commit. That vacuity is the
 * inertness this PR rests on, and the count at the end measures it instead of asserting it in a
 * comment. The rebuild makes all three real.
 */
const idsIn = (file) => {
  const parsed = JSON.parse(stripBanner(read(file)));
  const anchors = [];
  const taken = [];
  for (const [key, section] of Object.entries(parsed.sections ?? {})) {
    const settings = section.settings ?? {};
    const anchor = settings.anchor;
    if (anchor != null && String(anchor).trim() !== '') anchors.push({ key, anchor });
    const id = settings.id;
    if (typeof id === 'string' && id.trim() !== '') taken.push([id, `${file} ${key} id`], [`slider-${id}`, `${file} ${key} slider`]);
  }
  return { anchors, taken };
};

test('every stored anchor is reachable and unique on the page it renders on', () => {
  /* Section groups reach every template through the layout; `header` is the only thing `section`
     is disabled on, so a group can hold one too. */
  const groups = [...read('layout/theme.liquid').matchAll(/\{%-?\s*sections\s+'([^']+)'/g)].map((m) => `sections/${m[1]}.json`);
  assert.ok(groups.length >= 2, `the layout names ${groups.length} section groups; the probe is broken`);

  const templates = readdirSync(join(root, 'templates')).filter((name) => name.endsWith('.json')).map((name) => join('templates', name));
  const everywhere = groups.map((file) => [file, idsIn(file)]);

  const unreachable = [];
  const collisions = [];
  let set = 0;
  for (const file of templates) {
    const page = [[file, idsIn(file)], ...everywhere];
    const taken = new Map();
    for (const [, { taken: ids }] of page) for (const [id, where] of ids) if (!taken.has(id)) taken.set(id, where);

    for (const [owner, { anchors }] of page) {
      for (const { key, anchor } of anchors) {
        if (owner === file || groups.includes(owner)) set += owner === file ? 1 : 0;
        if (!FRAGMENT.test(anchor)) {
          unreachable.push(`${owner} ${key}: ${JSON.stringify(anchor)}`);
          continue;
        }
        if (taken.has(anchor)) collisions.push(`${file}: anchor ${anchor} on ${owner} ${key} already taken by ${taken.get(anchor)}`);
        else taken.set(anchor, `${owner} ${key} anchor`);
      }
    }
  }

  assert.deepEqual(unreachable, [], 'these anchors are not usable as a URL fragment');
  assert.deepEqual(collisions, [], 'these anchors collide with another id on the same rendered page');
  assert.ok(templates.length >= 7, `only ${templates.length} templates scanned; the probe is broken`);
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
