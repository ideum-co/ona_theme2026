import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const doc = readFileSync(join(root, 'docs/component-kit.md'), 'utf8');

/* The kit is a plan, so it names parts that do not exist yet: a row marked "to write" is the
   work, not a broken reference. Everything else has to resolve to a real file, or the plan is
   pointing at something a later PR renamed or deleted. */
const kitRows = doc
  .split('\n')
  .filter((line) => /^\| \d+ \|/.test(line))
  .map((line) => line.split('|').map((cell) => cell.trim()));

const stripBanner = (text) => text.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
const backticked = (text) => [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
const resolve = (name) =>
  ['sections', 'blocks'].map((dir) => join(root, dir, `${name}.liquid`)).find(existsSync);

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

test('the kit names eight components', () => {
  assert.equal(kitRows.length, 8);
});

/*
 * The count is stated three times -- the kit's own line, its collapse sentence, and stage 2 of
 * page-design-structure.md -- and the table is the only one of the four that a reader can
 * check. Asserting the table alone let a stale "nine components" sit in the summary while the
 * suite passed, so this derives both numbers from the table and looks for them everywhere they
 * are claimed.
 */
test('every statement of the count agrees with the table', () => {
  const total = NUMBER_WORDS[kitRows.length];
  const existing = NUMBER_WORDS[kitRows.filter((row) => !/to write/i.test(row.join(' '))).length];
  const structure = readFileSync(join(root, 'docs/page-design-structure.md'), 'utf8');

  const claims = [
    [doc, new RegExp(`${total} components\\. ${existing} are`, 'i'), 'the kit headline'],
    [doc, new RegExp(`collapse to about ${total}`, 'i'), "the kit's collapse sentence"],
    [structure, new RegExp(`collapses to\\s+${total} components — ${existing} of which`, 'i'), 'stage 2'],
  ];

  for (const [text, pattern, where] of claims) {
    assert.match(text, pattern, `${where} does not say ${total} components, ${existing} existing`);
  }
});

test('every component the kit names exists, except the one it says to write', () => {
  const pending = [];
  for (const row of kitRows) {
    const [, , component] = row;
    if (/to write/i.test(row.join(' '))) {
      pending.push(...backticked(component));
      continue;
    }
    for (const name of backticked(component)) {
      assert.ok(resolve(name), `docs/component-kit.md names ${name}, which is not a section or block`);
    }
  }
  assert.deepEqual(pending, [], 'the kit should describe what is still to be written in prose, not backticks');
});

test('the sections the kit calls Horizon-native really do style themselves', () => {
  const rule = doc.match(/\*\*If a legacy section is already Horizon-native[^*]*\*\*([\s\S]*?)(?=\n\d+\. |\n#|$)/);
  assert.ok(rule, 'the Horizon-native rule is missing from docs/component-kit.md');

  /* The rule also backticks the Liquid tags it is talking about; a file name is the subset
     that looks like one. */
  const names = backticked(rule[1]).filter((name) => /^[a-z0-9-]+$/.test(name));
  assert.ok(names.length > 0, 'the rule should name the sections it exempts');

  for (const name of names) {
    const path = resolve(name);
    assert.ok(path, `the rule exempts ${name}, which is not a section or block`);

    const source = readFileSync(path, 'utf8');
    assert.match(source, /\{%-?\s*schema\s*-?%\}/, `${name} has no schema`);
    assert.match(source, /\{%-?\s*stylesheet\s*-?%\}/, `${name} has no stylesheet, so it does not style itself`);

    /* "Styles itself" is the stronger claim, and a stylesheet block alone does not prove it:
       most legacy sections have one and still get their page-width wrapper from
       assets/legacy-page-layout.css. The tell is the shared sheet's `.container` markup --
       see tests/legacy-stylesheet-gate.test.mjs, which derives the same dependency. */
    const own = source.match(/\{%-?\s*style(?:sheet)?\s*-?%\}[\s\S]*?\{%-?\s*endstyle(?:sheet)?\s*-?%\}/g) ?? [];
    const borrowsContainer =
      /class="(?:[^"]*\s)?(?:container|medium-container)(?:\s[^"]*)?"/.test(source) &&
      !own.some((block) => /\.(?:medium-)?container\b/.test(block));
    assert.equal(borrowsContainer, false, `${name} takes its page width from the shared legacy sheet`);
  }
});

/*
 * The kit's claim that nothing is dead yet is the one a conversion PR will break first, and
 * it is the claim the first draft got wrong: it said nine sections were unused, when all of
 * them are referenced. Rule 4 says a section goes in the same PR that removes its last use,
 * so both directions of this are the rule, not a snapshot.
 */
test('every ona-* section is referenced, and every referenced one exists', () => {
  const uses = new Map();

  const templates = join(root, 'templates');
  for (const file of readdirSync(templates)) {
    if (!file.endsWith('.json')) continue;
    const parsed = JSON.parse(stripBanner(readFileSync(join(templates, file), 'utf8')));
    for (const section of Object.values(parsed.sections ?? {})) {
      if (!section.type?.startsWith('ona-')) continue;
      if (!uses.has(section.type)) uses.set(section.type, new Set());
      uses.get(section.type).add(file);
    }
  }

  const referenced = new Set(uses.keys());

  const onDisk = new Set(
    readdirSync(join(root, 'sections'))
      .filter((file) => file.startsWith('ona-') && file.endsWith('.liquid'))
      .map((file) => file.slice(0, -'.liquid'.length))
  );

  const orphaned = [...referenced].filter((type) => !onDisk.has(type)).sort();
  assert.deepEqual(orphaned, [], 'a template references an ona-* section that does not exist');

  const unused = [...onDisk].filter((type) => !referenced.has(type)).sort();
  assert.deepEqual(unused, [], 'an ona-* section has no remaining use and should go in the PR that removed it');

  /*
   * The two assertions above are set differences, so they stay green when a PR adds a section
   * AND a template reference for it, or adds a second template use of an existing one. The doc
   * states a total and a shared-section list that both move in exactly those cases, so derive
   * them here as well: the inventory is only guarded if the numbers are.
   */
  const total = onDisk.size;
  const structure = readFileSync(join(root, 'docs/page-design-structure.md'), 'utf8');
  for (const [text, pattern, where] of [
    [doc, new RegExp(`\\*\\*${total} \`ona-\\*\` sections\\*\\*`), 'the kit headline'],
    [doc, new RegExp(`all\\s+${total} are referenced`), "the kit's deletion step"],
    [structure, new RegExp(`the theme ships\\s+${total}\\s+\`ona-\\*\` sections`), 'stage 2'],
  ]) {
    assert.match(text, pattern, `${where} does not say ${total} ona-* sections`);
  }

  const shared = [...uses.entries()].filter(([, files]) => files.size > 1).sort();
  const sentence = doc.match(/(\w+) are used by more than one template:([\s\S]*?)\.\n/);
  assert.ok(sentence, 'the kit no longer states which sections more than one template uses');
  assert.equal(
    sentence[1].toLowerCase(),
    NUMBER_WORDS[shared.length],
    `the kit says ${sentence[1]} sections are shared, but ${shared.length} are`
  );

  /* Each name is followed by its templates in parentheses, so the count in there is the
     multiplicity the doc claims -- the number a second template use would silently change. */
  const claimed = [...sentence[2].matchAll(/`([^`]+)`\s*\(([^)]*)\)/g)].map((match) => [
    match[1],
    match[2].split(',').filter((part) => part.trim()).length,
  ]);
  assert.deepEqual(
    claimed.sort(),
    shared.map(([type, files]) => [type, files.size]).sort(),
    'the shared-section list disagrees with the templates that actually reference them'
  );
});

/*
 * The kit sends five panel-plus-slider sections to `carousel`, and that only works because of
 * the section's internal shape rather than its settings: a static `group` header that accepts
 * theme blocks, and `_card`s that accept media. Read the schema alone and `carousel` looks
 * like a bare row of cards with nowhere for the panel, which is the mistake this asserts
 * against.
 */
test('carousel still composes a static header and media cards', () => {
  const carousel = readFileSync(join(root, 'sections/carousel.liquid'), 'utf8');
  assert.match(
    carousel,
    /content_for 'block', type: 'group', id: 'static-header'/,
    'carousel no longer renders a static header block, so the persistent panel has nowhere to go'
  );
  assert.match(
    carousel,
    /content_for 'block', type: '_carousel-content'/,
    'carousel no longer renders its carousel content block'
  );

  const schemaOf = (file) => {
    const match = readFileSync(join(root, file), 'utf8')
      .match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
    assert.ok(match, `${file} has no schema`);
    return JSON.parse(match[1]);
  };

  const accepts = (file) => (schemaOf(file).blocks ?? []).map((block) => block.type);
  assert.ok(accepts('blocks/group.liquid').includes('@theme'), 'the header group takes no theme blocks');
  assert.ok(accepts('blocks/_carousel-content.liquid').includes('_card'), 'carousel content takes no cards');

  for (const type of ['image', 'video', 'text']) {
    assert.ok(accepts('blocks/_card.liquid').includes(type), `a card no longer takes ${type}`);
  }
});

/*
 * The kit maps all ten *-sourcing-v* clones onto media-with-content on the strength of one
 * measurement: between them they have no enabled blocks, so the trailing quote slider their
 * markup carries draws nothing and the live render really is the two-column row. Enable one
 * block and that stops being true -- the conversion would then drop visible content -- so the
 * claim is rechecked here rather than trusted.
 */
test('the sourcing clones still render nothing from their blocks', () => {
  const live = [];

  const templates = join(root, 'templates');
  for (const file of readdirSync(templates)) {
    if (!file.endsWith('.json')) continue;
    const parsed = JSON.parse(stripBanner(readFileSync(join(templates, file), 'utf8')));
    for (const section of Object.values(parsed.sections ?? {})) {
      if (!/sourcing/.test(section.type ?? '')) continue;
      for (const block of Object.values(section.blocks ?? {})) {
        if (!block.disabled) live.push(`${file}:${section.type}`);
      }
    }
  }

  assert.deepEqual(
    live,
    [],
    'a sourcing section has an enabled block, so its trailing quote slider is live and media-with-content would drop it'
  );
});

/*
 * A section that contains a {% form %} or reads a metafield is doing something no generic
 * block does, so leaving one out of the plan is how a live form or a metafield-backed counter
 * gets quietly replaced by a text block. The set is derived from the Liquid, and each member
 * has to be accounted for somewhere -- either in the kit (ona-page-media-gallery is a
 * component) or in the section that says what the kit does not cover.
 */
test('every section carrying a form or a metafield is accounted for', () => {
  const behavioural = readdirSync(join(root, 'sections'))
    .filter((file) => file.startsWith('ona-') && file.endsWith('.liquid'))
    .filter((file) => {
      const source = readFileSync(join(root, 'sections', file), 'utf8');
      return /\{%-?\s*form\s/.test(source) || /(?:shop|page|product)\.metafields/.test(source);
    })
    .map((file) => file.slice(0, -'.liquid'.length));

  assert.ok(behavioural.length > 0, 'the probe found no behavioural sections, so it is broken');

  const scope = doc.slice(doc.indexOf('## What the kit does not cover'), doc.indexOf('## Page by page'));
  assert.ok(scope.length > 0, 'the kit no longer says what it does not cover');

  const kit = kitRows.map((row) => row.join(' ')).join('\n');
  const unaccounted = behavioural.filter((name) => !scope.includes(name) && !kit.includes(name)).sort();
  assert.deepEqual(
    unaccounted,
    [],
    'these sections carry a form or a metafield and appear in neither the kit nor its exclusions'
  );
});

/*
 * The verification status at the top of the kit claims the duplication groups are parsed from
 * schemas and guarded. The first version of this guard keyed each section on its section-setting
 * ids and its top-level block *types* only, and compared group sizes. That is too coarse twice
 * over: it collided `ona-brewguides-and-training` with `ona-sustainability-list`, which share
 * "no settings, one block named block" but differ in their block's settings and in max_blocks,
 * and comparing sizes alone would not have noticed even if the membership were wrong. So this
 * keys on the whole schema bar its human-facing name, and asserts the membership the table
 * states -- which is why the table spells every member out instead of abbreviating a range.
 */
/* JSON.stringify's second argument is a property allowlist, not a key sort, and it applies at
   every depth -- passing the top-level keys there silently empties every nested object and makes
   the key depend on which top-level keys the section happens to have. Sort recursively instead,
   so two schemas that differ only in key order produce the same string and nothing else does. */
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.keys(value).sort().reduce((out, key) => ({ ...out, [key]: canonical(value[key]) }), {})
      : value;

test('the duplication table still matches the schemas', () => {
  const groups = new Map();

  for (const file of readdirSync(join(root, 'sections'))) {
    if (!file.startsWith('ona-') || !file.endsWith('.liquid')) continue;
    const source = readFileSync(join(root, 'sections', file), 'utf8');
    const schema = source.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);

    let key = 'no-schema';
    if (schema) {
      const { name, ...rest } = JSON.parse(schema[1]);
      key = JSON.stringify(canonical(rest));
    }
    groups.set(key, [...(groups.get(key) ?? []), file.replace(/\.liquid$/, '')]);
  }

  const derived = [...groups.values()]
    .filter((members) => members.length > 1)
    .map((members) => members.sort().join(', '))
    .sort();

  const table = doc.slice(doc.indexOf('| Identical schema | Copies | Which |'));
  const rows = table.slice(0, table.indexOf('\n\n')).split('\n').filter((line) => /^\| /.test(line)).slice(2);

  const stated = rows
    .map((row) => {
      const cells = row.split('|').map((cell) => cell.trim());
      const members = backticked(cells[3]).sort();
      const copies = Number(cells[2].replace(/\*/g, ''));
      assert.equal(
        members.length,
        copies,
        `the table says ${copies} copies but lists ${members.length}: ${members.join(', ')}`
      );
      return members.join(', ');
    })
    .sort();

  assert.deepEqual(
    stated,
    derived,
    'the duplication table disagrees with the schemas it claims to be parsed from'
  );
});

test('stage 2 points at the kit', () => {
  const structure = readFileSync(join(root, 'docs/page-design-structure.md'), 'utf8');
  const stage2 = structure.slice(
    structure.indexOf('### Stage 2'),
    structure.indexOf('### Stage 3')
  );
  assert.match(stage2, /\(component-kit\.md\)/, 'stage 2 should link to the component kit');
});
