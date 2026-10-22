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
 * What an href="#..." can actually reach.
 *
 * Almost nothing is excluded. An HTML id may start with a digit, and `| escape` is transparent
 * rather than lossy -- `research&development` is emitted as `id="research&amp;development"`, the
 * parser decodes it, and the DOM id is the string the merchant typed, so a matching fragment
 * works. The only real constraint is ASCII whitespace.
 *
 * The leading `#` is rejected for a different reason, and not because HTML forbids it: the info
 * text tells the merchant to leave it off, and an id of `#complete-training` needs
 * `href="##complete-training"` to reach it, so every link written the documented way misses. A
 * `#` later in the value is fine -- the fragment is everything after the first one.
 *
 * A percent escape is the one place where that transparency argument does not carry over. `|
 * escape` is an HTML escape and the parser undoes it, so the DOM id is what the merchant typed.
 * Percent-decoding happens on the *other* side: `research%20development` is emitted verbatim as
 * the id, but `href="#research%20development"` is decoded during fragment navigation and looks
 * for `research development`, which is not on the page. The value is accepted everywhere and
 * reachable nowhere, so it is rejected here rather than silently shipped.
 */
const FRAGMENT = /^[^\s#][^\s]*$/;
const PERCENT_ESCAPE = /%[0-9A-Fa-f]{2}/;
const reachable = (anchor) => FRAGMENT.test(anchor) && !PERCENT_ESCAPE.test(anchor);

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
/*
 * Which section types emit a copy of their `id` setting, and under what prefix. Derived from the
 * markup: five sections render `id="slider-{{ section.settings.id }}"` as well as the bare id,
 * and the rest render only the bare one. Reserving `slider-<id>` for every legacy section would
 * block an anchor that collides with nothing -- `ona-training` owns `complete-training` on
 * wholesale and emits no `slider-complete-training`.
 */
const EMITS = new Map(
  readdirSync(join(root, 'sections'))
    .filter((name) => name.endsWith('.liquid'))
    .map((name) => [
      name.replace(/\.liquid$/, ''),
      [...new Set([...read(join('sections', name)).matchAll(/id="([^"{]*)\{\{\s*section\.settings\.id\s*\}\}"/g)].map((m) => m[1]))],
    ])
    .filter(([, prefixes]) => prefixes.length > 0)
);

/*
 * The static ids a section type's own markup puts on the page. `settings.id` is not the only
 * thing a legacy section contributes: `sections/header.liquid` emits `id="header-component"`,
 * and the header group pulls it onto every template, so an anchor of `header-component` lands a
 * link on the header. Reading these per type -- and attributing them to the pages that
 * instantiate the type -- is what keeps the collision set the ids of the *rendered page* rather
 * than the ids the JSON happens to configure.
 */
const STATIC = new Map(
  readdirSync(join(root, 'sections'))
    .filter((name) => name.endsWith('.liquid'))
    .map((name) => [
      name.replace(/\.liquid$/, ''),
      [...new Set([...read(join('sections', name)).matchAll(/id="([A-Za-z][-\w]*)"/g)].map((m) => m[1]))],
    ])
);

const idsIn = (file) => {
  const parsed = JSON.parse(stripBanner(read(file)));
  const anchors = [];
  const taken = [];
  for (const [key, section] of Object.entries(parsed.sections ?? {})) {
    const settings = section.settings ?? {};
    const anchor = settings.anchor;
    if (anchor != null && String(anchor).trim() !== '') anchors.push({ key, anchor });
    const id = settings.id;
    if (typeof id === 'string' && id.trim() !== '') {
      for (const prefix of EMITS.get(section.type) ?? []) taken.push([`${prefix}${id}`, `${file} ${key} ${prefix || 'id'}`]);
    }
    for (const id of STATIC.get(section.type) ?? []) taken.push([id, `sections/${section.type}.liquid`]);
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

  /* The layout wraps every template, and its own ids -- `MainContent`, `header-group` -- are on
     the page before a section renders. An anchor duplicating one sends `#MainContent` to the
     wrapper instead of the section. (password.liquid is deliberately not here: it serves the
     password page, which has no template JSON, so its ids are not on these pages.) */
  const fromLayout = [...read('layout/theme.liquid').matchAll(/id="([A-Za-z][-\w]*)"/g)].map((m) => [m[1], 'layout/theme.liquid']);
  assert.ok(fromLayout.length >= 2, `the layout emits ${fromLayout.length} static ids; the probe is broken`);

  /* The groups reach every page, so their section types' own ids do too. Without this the set
     holds only what the group JSON configures, and `header-component` -- which is on every page
     from `sections/header.liquid` -- is absent. */
  const fromGroupMarkup = everywhere.flatMap(([, { taken: ids }]) => ids).filter(([, where]) => where.endsWith('.liquid'));
  assert.ok(
    fromGroupMarkup.length >= 1,
    `the section groups instantiate no type that emits a static id; the probe is broken`
  );

  const unreachable = [];
  const collisions = [];
  let set = 0;
  for (const file of templates) {
    const page = [[file, idsIn(file)], ...everywhere];
    const taken = new Map(fromLayout);
    for (const [, { taken: ids }] of page) for (const [id, where] of ids) if (!taken.has(id)) taken.set(id, where);

    for (const [owner, { anchors }] of page) {
      for (const { key, anchor } of anchors) {
        if (owner === file || groups.includes(owner)) set += owner === file ? 1 : 0;
        if (!reachable(anchor)) {
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
  const unusable = [...targets].filter((anchor) => !reachable(anchor));
  assert.deepEqual(unusable, [], 'these live anchors cannot be carried by the new setting');
});
