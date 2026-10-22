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

  /* Each name is followed by its templates in parentheses. Comparing only how MANY are listed
     would stay green when a section moves between templates without changing its number of uses,
     so the names are compared too. The doc shortens a filename to a readable prefix
     ("private-courses" for page.private-courses-and-experiences.json), which is why each
     nickname is resolved against the slugs rather than matched whole -- and resolving it is
     itself an assertion, since a nickname that fits two templates, or none, is also a defect. */
  const slug = (file) => file.replace(/^page\./, '').replace(/\.json$/, '');
  const claimed = [...sentence[2].matchAll(/`([^`]+)`\s*\(([^)]*)\)/g)].map((match) => [
    match[1],
    match[2].split(',').map((part) => part.trim()).filter(Boolean),
  ]);

  const resolved = claimed.map(([type, nicknames]) => {
    const files = shared.find(([name]) => name === type)?.[1];
    assert.ok(files, `the kit lists ${type} as shared, but no two templates reference it`);
    return [
      type,
      nicknames
        .map((nickname) => {
          /* Exact first: "faq" is also a prefix of "faq-subscriptions", so prefix matching alone
             is ambiguous wherever one template's name extends another's. */
          const names = [...files].map(slug);
          const hits = names.includes(nickname)
            ? [nickname]
            : names.filter((name) => name.startsWith(nickname));
          assert.equal(
            hits.length,
            1,
            `the kit says ${type} is used by "${nickname}", which matches ${hits.length} of the templates that reference it`
          );
          return hits[0];
        })
        .sort(),
    ];
  });

  assert.deepEqual(
    resolved.sort(),
    shared.map(([type, files]) => [type, [...files].map(slug).sort()]).sort(),
    'the shared-section list names different templates from the ones that reference those sections'
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

/*
 * The three "drift" figures were measured once, on 2026-10-20, and written into prose. #276
 * then added three product templates and every one of them moved -- the custom presets by 46,
 * the inline <style> blocks by 12, the section total by 34 -- while the suite stayed green,
 * because nothing derived them. A number a reader is invited to plan from has to be guarded
 * the way the inventory is, so these three derive from templates/*.json and read the figure
 * back out of the prose.
 */
const eachTemplate = () =>
  readdirSync(join(root, 'templates'))
    .filter((file) => file.endsWith('.json'))
    .map((file) => [file, JSON.parse(stripBanner(readFileSync(join(root, 'templates', file), 'utf8')))]);

/* A template's settings live on the section and on blocks nested to any depth, and both carry
   type_preset -- counting only one of them is how 84 reads as 77. */
const everySettings = function* (sections) {
  for (const node of Object.values(sections ?? {})) {
    yield node.settings ?? {};
    yield* everySettings(node.blocks);
  }
};

test('the custom type_preset count is what the templates hold', () => {
  const counts = new Map();
  for (const [, parsed] of eachTemplate()) {
    for (const settings of everySettings(parsed.sections)) {
      const preset = settings.type_preset;
      if (preset) counts.set(preset, (counts.get(preset) ?? 0) + 1);
    }
  }
  const custom = counts.get('custom') ?? 0;

  assert.ok(custom > 0, 'the probe found no custom presets, so it is broken');
  assert.match(
    doc,
    new RegExp(`\\*\\*${custom} settings sit on \`type_preset: "custom"\`\\*\\*`),
    `the drift list does not say ${custom} custom presets`
  );

  /* They are settings, not blocks: seven of them sit on the section itself. Saying "blocks"
     sent the cleanup at 70 of 77 and left the section-level ones standing, so the split is
     guarded alongside the total. */
  let sectionLevel = 0;
  for (const [, parsed] of eachTemplate()) {
    for (const section of Object.values(parsed.sections ?? {})) {
      if ((section.settings ?? {}).type_preset === 'custom') sectionLevel += 1;
    }
  }
  assert.ok(sectionLevel > 0, 'no section-level custom presets found; the split probe is broken');
  assert.ok(
    doc.includes(`**${custom - sectionLevel} are block settings and ${sectionLevel} are section settings**`),
    `the drift list should split ${custom} into ${custom - sectionLevel} block and ${sectionLevel} section settings`
  );

  /* The whole breakdown is quoted, not just the custom total, and guarding one number of six
     is how `rte` sat at 22 against an actual 18 through two rounds of correcting this very
     paragraph. Presets appear on section settings as well as nested blocks, and only `custom`
     and `rte` occur in both -- which is precisely why a probe that walks one population twice
     inflates those two and leaves the rest looking right. */
  const breakdown = [...counts.entries()]
    .filter(([preset]) => preset !== 'custom')
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5);

  const quoted = breakdown.map(([preset, n]) => `\`${preset}\` ${n}`).join(', ');
  assert.ok(doc.includes(`most common preset (${quoted})`), `the breakdown should read: ${quoted}`);
  assert.match(doc, new RegExp(`the ${custom} \`custom\` presets`), `step 6 does not say ${custom}`);

  /* The rule an implementer works from said "covers 77 blocks" while the inventory above it
     split the same 77 into 70 blocks and 7 sections, so following the rule leaves the
     section-level presets untouched (Codex, #247). The rule has to name both populations. */
  assert.match(
    doc,
    new RegExp(
      `covers ${custom} settings — ${custom - sectionLevel} on blocks and ${sectionLevel} on sections`
    ),
    `the token rule should say ${custom} settings, ${custom - sectionLevel} on blocks and ${sectionLevel} on sections`
  );
});

test('the inline <style> count is what the templates hold', () => {
  let inline = 0;
  /* The occurrence count alone understates the work: it was read as "one block duplicated four
     ways", when the four product templates each hold four *different* styled blocks. Distinct
     bodies are the number of decisions; occurrences are only how many places they land in. */
  const bodies = new Map();
  for (const [, parsed] of eachTemplate()) {
    for (const settings of everySettings(parsed.sections)) {
      const styled = Object.values(settings).filter(
        (value) => typeof value === 'string' && value.includes('<style')
      );
      if (!styled.length) continue;
      inline += 1;
      const body = styled.join('\\u0000');
      bodies.set(body, (bodies.get(body) ?? 0) + 1);
    }
  }

  assert.ok(inline > 0, 'the probe found no inline <style>, so it is broken');
  assert.match(
    doc,
    new RegExp(`\\*\\*${inline} \`custom_liquid\` blocks carry an inline \`<style>\`\\*\\*`),
    `the drift list does not say ${inline} inline <style> blocks`
  );
  assert.match(doc, new RegExp(`The ${inline} inline \`<style>\` blocks`), `step 7 does not say ${inline}`);

  assert.ok(bodies.size > 1, `the distinct-body probe collapsed to ${bodies.size}; it is broken`);
  assert.match(
    doc,
    new RegExp(`the ${inline}\\s+occurrences are \\*\\*${NUMBER_WORDS[bodies.size]} distinct styled blocks\\*\\*`),
    `the drift list should say ${NUMBER_WORDS[bodies.size]} distinct styled blocks for ${inline} occurrences`
  );
});

/*
 * Shopify refuses a template above 25 sections outright rather than dropping the extra, so the
 * homepage's remaining headroom is a number people plan against. It was written as "25 of 25,
 * eleven disabled" and is now 24 and nine.
 */
test('the homepage section count and its headroom are current', () => {
  const index = JSON.parse(stripBanner(readFileSync(join(root, 'templates/index.json'), 'utf8')));
  const sections = Object.values(index.sections ?? {});
  const disabled = sections.filter((section) => section.disabled).length;

  assert.ok(sections.length <= 25, `templates/index.json holds ${sections.length} sections, over Shopify's 25`);
  assert.match(
    doc,
    new RegExp(`is at ${sections.length} of Shopify's 25 sections`),
    `the kit does not say the homepage holds ${sections.length} sections`
  );
  assert.match(
    doc,
    new RegExp(`${NUMBER_WORDS[disabled] ?? disabled} of the ${sections.length} are\\s+disabled`, 'i'),
    `the kit does not say ${disabled} of them are disabled`
  );
});

/*
 * ona-bookings-top sat in one row with ona-training-iframe as "metafield-driven booking
 * iframes" and renders no iframe at all, which deferred a visible legacy layout behind a
 * provider change that has nothing to do with it. Keep the two apart by the thing that
 * separates them.
 */
test('the kit does not call ona-bookings-top an iframe', () => {
  const bookings = readFileSync(join(root, 'sections/ona-bookings-top.liquid'), 'utf8');
  const iframe = readFileSync(join(root, 'sections/ona-training-iframe.liquid'), 'utf8');

  /* Neither section writes an <iframe> tag: ona-training-iframe prints
     page.metafields.accentuate.iframe, and the markup lives in the metafield. So the thing
     that tells them apart is which metafield each one reads, not a literal tag -- checking
     for the tag reports both as iframe-free and proves nothing. */
  assert.match(iframe, /metafields\.accentuate\.iframe/, 'ona-training-iframe no longer reads the iframe metafield; the probe is stale');
  assert.ok(
    !/<iframe/i.test(bookings) && !/metafields\.accentuate\.iframe/.test(bookings),
    'ona-bookings-top now renders an iframe; the kit row needs rewriting'
  );
  assert.match(doc, /`ona-bookings-top` \(bookings\) \| \*\*no iframe at all\*\*/);
});

/*
 * The paragraph above these three calls all of them guarded, and for a while only two were:
 * nothing read a padding setting, so the 19 values and the ladder built on them could drift
 * while the suite stayed green. The document prints the values, not just the count, and the
 * values are the part a ladder is chosen from -- so assert the list.
 */
test('the padding inventory is what the templates hold', () => {
  /* "Between sections" is the claim, so the population is the block padding of TOP-LEVEL
     sections -- not every setting whose name contains "padding". The first version of this
     guard walked nested blocks too and matched on substring, which swept in button, badge and
     inline padding and inflated the inventory from 15 values to 19 (4, 10, 12 and 16 are
     component-internal). It passed, and it was certifying the wrong set -- a guard aimed at
     the wrong population is worse than none, because the number now looks checked. */
  const SECTION_PADDING = ['padding-block-start', 'padding-block-end'];
  const values = new Set();
  for (const [, parsed] of eachTemplate()) {
    for (const section of Object.values(parsed.sections ?? {})) {
      for (const key of SECTION_PADDING) {
        const value = (section.settings ?? {})[key];
        if (typeof value === 'number') values.add(value);
      }
    }
  }

  const sorted = [...values].sort((a, b) => a - b);
  assert.ok(sorted.length > 0, 'the probe found no padding values, so it is broken');

  /* The list wraps across lines in the document, so compare against a whitespace-collapsed
     copy rather than making the pattern guess where the breaks fall. */
  const flat = doc.replace(/\s+/g, ' ');
  assert.match(
    flat,
    new RegExp(`\\*\\*${sorted.length} distinct padding values\\*\\* between sections: ${sorted.join(', ')}\\.`),
    `the drift list does not match the ${sorted.length} padding values in use: ${sorted.join(', ')}`
  );
  assert.match(
    flat,
    new RegExp(`Pick one from the ${sorted.length} values in use`),
    `the spacing rule does not say ${sorted.length}`
  );

  /* The document tells the reader to "pick one from the N values in use", so every rung of
     the ladder it then proposes has to be one of them. The ladder was 0/16/32/48/64/96/120 and
     16 is not a section padding anywhere -- it only looked valid against the inflated set. */
  const ladder = flat.match(/the obvious ladder is \*\*([0-9 /]+)\*\*/);
  assert.ok(ladder, 'the spacing rule no longer proposes a ladder');
  for (const rung of ladder[1].split('/').map((part) => Number(part.trim()))) {
    assert.ok(values.has(rung), `the proposed ladder includes ${rung}, which no template uses`);
  }
});

/*
 * The kit argues for component 1 by saying these primitives are already the most-used thing in
 * the theme, and quoted 78/34/14/11 -- measured before #276 added three product templates, by
 * which point they were 116/40/20/14. The argument survives either way, which is exactly why
 * nobody would notice the figures rotting. Derive them.
 */
test('the Horizon block usage counts are what the templates hold', () => {
  const counts = new Map();
  const tally = (blocks) => {
    for (const block of Object.values(blocks ?? {})) {
      if (block.type) counts.set(block.type, (counts.get(block.type) ?? 0) + 1);
      tally(block.blocks);
    }
  };
  for (const [, parsed] of eachTemplate()) {
    for (const section of Object.values(parsed.sections ?? {})) tally(section.blocks);
  }

  const quoted = ['text', 'group', 'button', 'image'];
  for (const type of quoted) {
    assert.ok(counts.get(type) > 0, `no ${type} blocks found; the probe is broken`);
  }

  const expected = quoted.map((type) => `\`${type}\` ×${counts.get(type)}`).join(', ');
  assert.ok(
    doc.includes(`Already the most-used thing in the theme: ${expected}.`),
    `component 1 should cite ${expected}`
  );
});

/*
 * The three figures below sit inside sentences that say they are guarded, and until this test
 * they were not: the 150, the 11 font sizes and the 15 `.animated-svg` sections were all
 * read off a grep that nothing re-ran. That is the same shape as the padding and type_preset
 * misses -- a number that looks checked because it is standing next to numbers that are.
 */
test('the drift figures quoted as guarded are derived', () => {
  let sections = 0;
  const fontSizes = new Set();
  for (const [, parsed] of eachTemplate()) {
    sections += Object.keys(parsed.sections ?? {}).length;
    for (const settings of everySettings(parsed.sections)) {
      /* A `font_size` of "" is the setting present and unset -- 37 of them, all on presets other
         than `custom`. They restate no size, so they are not one of the literal values the
         sentence counts; including them reads 12 where the templates hold 11. */
      if (settings.font_size) fontSizes.add(String(settings.font_size));
    }
  }

  assert.ok(sections > 100, `only ${sections} sections found; the probe is broken`);
  assert.ok(fontSizes.size > 0, 'no font_size values found; the probe is broken');

  assert.ok(
    doc.includes(`measured across all ${sections} sections in`),
    `the drift preamble should say ${sections} sections`
  );
  assert.ok(
    doc.includes(`there are **${NUMBER_WORDS[fontSizes.size] ?? fontSizes.size}\n  distinct literal \`font_size\` values**`),
    `the kit should cite ${fontSizes.size} distinct font_size values`
  );
});

/*
 * `grep -l animated-svg sections/*.liquid` returns 15 is a claim about the filesystem, quoted
 * verbatim in the gap row. Run the grep.
 */
test('the .animated-svg section count is the grep it quotes', () => {
  const carriers = readdirSync(join(root, 'sections'))
    .filter((file) => file.endsWith('.liquid'))
    .filter((file) => readFileSync(join(root, 'sections', file), 'utf8').includes('animated-svg'));

  assert.ok(carriers.length > 1, 'the .animated-svg probe found almost nothing; it is broken');
  assert.ok(
    doc.includes(`carrying \`.animated-svg\` — **${carriers.length} of them**`),
    `the gap row should say ${carriers.length}`
  );
  assert.ok(
    doc.includes(`returns ${carriers.length}, and **all ten**`),
    `the quoted grep result should be ${carriers.length}`
  );
});

/*
 * The hole this closes: `ona-our-philosophy` and `ona-careers` were live, enabled sections on
 * page.about.json that the document named nowhere at all -- under a sentence asserting that
 * exactly one About section was unaccounted for. The existing coverage guard could not see them
 * because its population is sections carrying a form or a metafield, and neither has either.
 *
 * So guard the whole population instead of a property of it. A section that exists and is not
 * named anywhere in the kit is either a mapping nobody wrote down or a gap nobody declared, and
 * both are the failure this document exists to prevent.
 */
test('every ona-* section has a mapping or a declared gap', () => {
  const sections = readdirSync(join(root, 'sections'))
    .filter((file) => file.startsWith('ona-') && file.endsWith('.liquid'))
    .map((file) => file.replace(/\.liquid$/, ''));

  assert.ok(sections.length > 40, `only ${sections.length} ona-* sections found; the probe is broken`);

  /* Scope. This used to start at '## What the reviews actually found', which swept in the
     duplicate-schema table and the composite inventory -- tables that record what a section
     *is*, not what it converts to. `ona-supported` is backticked in both, so deleting its real
     guidance left this test green (Codex, #247). Coverage now comes only from the rows that
     carry guidance: the kit's Replaces column, the exclusion prose under the kit table, the
     media-slot table and the mapping that closes it, the not-covered table, the gap rows and
     the page plan. */
  const between = (from, to) => doc.slice(doc.indexOf(from), doc.indexOf(to));
  const kit = between('## The kit', '### Why `media-with-content` carries the weight');
  const kitTableRows = kit.split('\n').filter((line) => line.startsWith('| '));
  const replaces = kitTableRows.map((line) => line.split('|').at(-2) ?? '').join('\n');
  const lastRow = kitTableRows.at(-1);
  const exclusion = kit.slice(kit.lastIndexOf(lastRow) + lastRow.length);

  const guidance = [
    replaces,
    exclusion,
    between('### The media slot holds less than the sections do', '### Read the markup, not the schema'),
    between('## What the kit does not cover', '## Known gaps'),
    between('## Known gaps', '## Page by page'),
    between('## Page by page', '## The tokens that make it one design')
  ].join('\n');

  assert.ok(guidance.length > 5000, 'the guidance sections are no longer where this expects');
  assert.ok(
    !guidance.includes('| Persistent panel |'),
    'the composite inventory is back inside the coverage scope; it describes sections, it does not map them'
  );

  /* Boundary. `ona-training` is a prefix of `ona-training-form`, `ona-training-iframe` and four
     more, so a plain substring search lets an unmapped section be "covered" by a longer name
     that happens to start the same way. Match the backticked token the document writes. */
  const named = new Set([...guidance.matchAll(/`([a-z0-9-]+)`/g)].map((match) => match[1]));

  /* Two groups the document is allowed to treat collectively. Each is checked the same way: the
     collective phrase has to be present in the guidance, and the group has to be the size the
     phrase claims. */
  const clones = sections.filter((name) => /^ona-(wholesale-|traning-)?sourcing(-v\d+)?$/.test(name));
  assert.equal(clones.length, 10, 'the sourcing clone group is no longer ten sections');
  assert.ok(guidance.includes('the **10** `*-sourcing-v*` clones'), 'the kit row no longer states the group size');
  assert.ok(doc.includes('ten sourcing clones'), 'the order of work no longer names the sourcing clones as a group');

  /* The five panel-plus-slider composites carry one collective gap row rather than five of
     their own, so the composite table is what says who is in the group -- and the gap row has
     to agree on its size. */
  const compositeTable = between(
    '### The dominant shape is a composite',
    '### The media slot holds less than the sections do'
  );
  const composites = [...compositeTable.matchAll(/^\| `(ona-[a-z0-9-]+)` \|/gm)].map((match) => match[1]);
  assert.equal(composites.length, 5, `the composite table lists ${composites.length} sections, not five`);
  assert.ok(
    guidance.includes('the five panel-plus-slider composites'),
    'Known gaps no longer carries the collective row for the panel-plus-slider composites'
  );

  const covered = new Set([...named, ...clones, ...composites]);
  const missing = sections.filter((name) => !covered.has(name)).sort();
  assert.deepEqual(
    missing,
    [],
    `these sections have no mapping and no declared gap in docs/component-kit.md: ${missing.join(', ')}`
  );
});

/*
 * A section with a Known-gaps row is, by definition, not a clean mapping -- but the kit table
 * is what an implementer follows, and `ona-faq-lists` sat in a Replaces cell with no marker at
 * all while its gap row said the replacement could not be invisible (Codex, #247). The two
 * tables have to agree in this direction too: naming a gapped section as a replacement is only
 * honest if the cell says so.
 */
test('no kit row offers a gapped section as an unqualified replacement', () => {
  const between = (from, to) => doc.slice(doc.indexOf(from), doc.indexOf(to));
  const kit = between('## The kit', '### Why `media-with-content` carries the weight');
  const gaps = between('## Known gaps', '## Page by page');

  const gapped = new Set(
    gaps
      .split('\n')
      .filter((line) => /^\| `ona-[a-z0-9-]+`/.test(line))
      .map((line) => line.match(/^\| `(ona-[a-z0-9-]+)`/)[1])
  );
  assert.ok(gapped.size > 5, `only ${gapped.size} gap rows found; the probe is broken`);

  const unqualified = [];
  for (const row of kit.split('\n').filter((line) => /^\| \d+ \|/.test(line))) {
    const replaces = row.split('|').at(-2) ?? '';
    const named = [...replaces.matchAll(/`(ona-[a-z0-9-]+)`/g)].map((match) => match[1]);
    const marked = /blocked|Known gaps|no verified target/i.test(replaces);
    if (marked) continue;
    unqualified.push(...named.filter((name) => gapped.has(name)));
  }

  assert.deepEqual(
    unqualified,
    [],
    `these sections have a Known-gaps row but are offered as a plain replacement in the kit table: ${unqualified.join(', ')}`
  );
});

/*
 * The wholesale page plan reduced `ona-gust-r` to its missing form fields, while its gap row
 * says the fields are only the first of two problems -- the two-column YouTube promo beside the
 * form needs a container target as well (Codex, #247). An actionable row that drops half a gap
 * restarts the conversion too early, so the plan has to carry both halves.
 */
test('the wholesale plan carries both halves of the ona-gust-r gap', () => {
  const gapRow = doc.split('\n').find((line) => line.startsWith('| `ona-gust-r` |'));
  assert.ok(gapRow, 'the ona-gust-r gap row is gone');
  assert.match(gapRow, /not just a form/i, 'the gap row no longer records the second problem');

  const planRow = doc.split('\n').find((line) => line.startsWith('| `/pages/wholesale` |'));
  assert.ok(planRow, 'the wholesale page-plan row is gone');
  const clause = planRow.slice(planRow.lastIndexOf('`ona-gust-r`'));
  assert.match(
    clause,
    /two-column container/i,
    'the wholesale plan still reduces ona-gust-r to its form fields; the gap row needs a container target too'
  );
});

/*
 * The kit row and the gap row described the same dependency differently: the gap row recorded
 * #246 as merged and the café-name dependency satisfied, while the kit row still listed #246 as
 * a blocker, which sends an implementer to redo finished work (Codex, #247). Two places, one
 * fact -- so check they agree rather than fixing only the one that was read.
 */
test('the kit row and the gap row agree on the cafe-name dependency', () => {
  assert.ok(
    doc.includes('The café-name dependency is now **satisfied**: #246 has merged'),
    'the gap row no longer records #246 as merged'
  );

  const kitRow = doc.split('\n').find((line) => line.startsWith('| 5 | `press-quotes`'));
  assert.ok(kitRow, 'the press-quotes kit row is gone or renumbered');
  assert.ok(
    !/needs #246/.test(kitRow),
    'the kit row still lists #246 as a blocker although the gap row records it as merged'
  );
});

/*
 * "Seven sections carry behaviour" sat above a table of eight, and the prose below it
 * enumerated all eight -- three forms, three that stay, `ona-bookings-top` and
 * `ona-unique-coffees` -- while totalling them as seven. The table is the measurable thing.
 */
test('the behavioural count is the length of the table above it', () => {
  const scope = doc.slice(doc.indexOf('## What the kit does not cover'), doc.indexOf('## Known gaps'));
  const rows = scope.split('\n').filter((line) => /^\| `ona-[a-z-]+`/.test(line));

  assert.ok(rows.length > 3, `only ${rows.length} behavioural rows found; the probe is broken`);
  assert.ok(
    new RegExp(`${NUMBER_WORDS[rows.length]} sections carry behaviour`, "i").test(scope),
    `the summary should say ${NUMBER_WORDS[rows.length]} sections carry behaviour, for ${rows.length} table rows`
  );
});
