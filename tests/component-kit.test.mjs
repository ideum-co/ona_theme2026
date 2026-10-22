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
 * A section that contains a {% form %}, reads a metafield, or loads its own script is doing
 * something no generic block does -- those are the three probes the document names, so the
 * test runs all three rather than the first two. Leaving one out of the plan is how a live
 * form, a metafield-backed counter or a slider gets quietly replaced by a text block.
 *
 * Being accounted for means a row that decides the section: a row of the behavioural table, a
 * Known gaps row that names it, or a row of the composite table (four script-backed sections
 * are panel-plus-slider composites and share one collective gap row). Mere presence somewhere
 * in the kit is not enough, and that is what this used to ask: every one of these sections is
 * already named in the kit's mapping cells, so a form added to an already-mapped section --
 * ona-inner-banner, say -- left the suite green. The later coverage test already guarantees the
 * name appears somewhere; this one has to ask something that test does not.
 */
test('every section carrying a form, a metafield or its own script is accounted for', () => {
  const sections = readdirSync(join(root, 'sections')).filter(
    (file) => file.startsWith('ona-') && file.endsWith('.liquid')
  );
  const sourceOf = (file) => readFileSync(join(root, 'sections', file), 'utf8');
  const nameOf = (file) => file.slice(0, -'.liquid'.length);

  const posts = sections.filter((file) => /\{%-?\s*form\s/.test(sourceOf(file))).map(nameOf);
  const reads = sections
    .filter((file) => /(?:shop|page|product)\.metafields/.test(sourceOf(file)))
    .map(nameOf);
  const scripted = sections
    .filter(
      (file) =>
        /\.js['"]\s*\|\s*asset_url/.test(sourceOf(file)) || /<script[^>]*src=/.test(sourceOf(file))
    )
    .map(nameOf);

  for (const [label, found] of [['form', posts], ['metafield', reads], ['script', scripted]]) {
    assert.ok(found.length > 0, `the ${label} probe found no sections, so it is broken`);
  }

  const behavioural = [...new Set([...posts, ...reads, ...scripted])].sort();

  /* The lead-in quotes the size of the derived set, so a new behavioural section forces the
     paragraph that disposes of them to be rewritten rather than quietly falling out of date. */
  const scope = between('## What the kit does not cover', '## Known gaps');
  assert.ok(
    new RegExp(`Those three\\s+probes find \\*\\*${behavioural.length}\\*\\* sections`).test(scope),
    `the lead-in should say the three probes find ${behavioural.length} sections`
  );

  /* Scoped to table rows, not to the span. A name mentioned in the surrounding prose is a
     mention; a name in a row is a decision about that section, which is what being accounted
     for means here. */
  const rowsNaming = (text) =>
    text
      .split('\n')
      .filter((line) => line.startsWith('|'))
      .flatMap((line) => [...line.matchAll(/`(ona-[a-z0-9-]+)`/g)].map((match) => match[1]));

  const gaps = between('## Known gaps', '## Page by page');
  const compositeTable = between('### The dominant shape is a composite', 'Each renders a titled panel');
  const decided = new Set([...rowsNaming(scope), ...rowsNaming(gaps), ...rowsNaming(compositeTable)]);
  assert.ok(decided.size > 5, 'no decision rows were found at all, so the probe is broken');

  const unaccounted = behavioural.filter((name) => !decided.has(name)).sort();
  assert.deepEqual(
    unaccounted,
    [],
    'these sections post a form, read a metafield or load a script, and no behavioural, gap or composite row decides them'
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

/*
 * Three places quote how many of the eight media/text variants media-with-content cannot hold:
 * the sentence above the table, the sentence below it, and the kit's component 1 row. Nothing
 * derived them, and they drifted -- all three said four while the table's "Fits the slot?"
 * column said no five times. The fifth, ona-expericences-content, is a no for a reason the
 * other four are not: its one image fits the slot, but a live form sits beside it. Leaving it
 * out of the count is how its two-group shell drops out of the migration scope while the
 * behavioural table still assigns that shell to component 1.
 *
 * So the count is read off the column rather than repeated, and ona-careers stays out of it:
 * its cell opens "yes for the photo", a yes with a decorative-layer caveat, not a no.
 */
test('the media-slot count is the number of no rows in the table above it', () => {
  const scope = between('### The media slot holds less than the sections do', '### Read the markup, not the schema');
  const rows = scope
    .split('\n')
    .filter((line) => line.startsWith('| `ona-'))
    .map((line) => line.split('|').map((cell) => cell.trim()));
  assert.equal(rows.length, 8, `the media table has ${rows.length} rows, not eight`);

  const misfits = rows.filter((cells) => /^no\b/i.test(cells[3]));
  const word = NUMBER_WORDS[misfits.length];
  assert.ok(misfits.length > 1, 'the "Fits the slot?" column parsed as almost no misfits; the probe is broken');

  assert.ok(
    new RegExp(`${word} of the eight do not fit it`).test(scope),
    `the sentence above the table should say ${word} of the eight do not fit`
  );
  assert.ok(
    new RegExp(`Those ${word} go to component 1`).test(scope),
    `the sentence below the table should say those ${word} go to component 1`
  );
  assert.ok(
    kitRows.some((row) => row.join(' ').includes(`the ${word} media/text variants`)),
    `component 1's row should claim the ${word} media/text variants`
  );

  /* The one the count used to lose. It is a misfit, and the paragraph has to say why it is a
     different kind of misfit from the other four, or the shell silently leaves the scope. */
  assert.ok(
    misfits.some((cells) => cells[1] === '`ona-expericences-content`'),
    'ona-expericences-content is no longer a misfit row; the exception paragraph is now wrong'
  );
  assert.ok(
    /`ona-expericences-content` is\s+the fifth for a different reason/.test(scope),
    'the paragraph no longer separates the form-bearing variant from the four media misfits'
  );
});

/*
 * page-header is the one section the kit says to write, and step 1 moves ona-page-title and
 * ona-sr-heading onto it. Both derive the H1 from page.title when their own setting is blank
 * -- ona-sr-heading.liquid:5 through a default filter chain, ona-page-title.liquid:14 through
 * an if/else -- and most of the instances in templates/ are blank, so the fallback is what is
 * actually rendering those headings today, not the settings.
 *
 * page.bookings.json is why this is a contract and not a note: the bookings suffix is
 * shop-wide and serves three separately titled pages, so no literal heading is right for all
 * of them. A contract that lists settings without the fallback lets step 1 convert a blank
 * instance to literal text and relabel two live pages, which is exactly the kind of silent
 * regression stage 2 is supposed to exclude. The blank count is derived so the prose cannot
 * drift from the templates.
 */
test('the page-header contract keeps the dynamic title fallback', () => {
  const dynamic = { 'ona-sr-heading': 'text', 'ona-page-title': 'title2' };
  const templates = join(root, 'templates');
  const blanks = [];

  for (const file of readdirSync(templates)) {
    if (!file.endsWith('.json')) continue;
    let parsed;
    try {
      parsed = JSON.parse(stripBanner(readFileSync(join(templates, file), 'utf8')));
    } catch {
      continue;
    }
    for (const section of Object.values(parsed.sections ?? {})) {
      const setting = dynamic[section.type];
      if (!setting) continue;
      const value = (section.settings ?? {})[setting];
      if (value === undefined || String(value).trim() === '') blanks.push(`${file}:${section.type}`);
    }
  }

  assert.ok(blanks.length > 0, 'no blank heading instances found at all, so the probe is broken');
  assert.ok(
    new RegExp(`\\*\\*${NUMBER_WORDS[blanks.length]} of the six instances leave the setting blank\\*\\*`).test(doc),
    `the contract should say ${NUMBER_WORDS[blanks.length]} instances are blank, for ${blanks.join(', ')}`
  );

  /* The fallback each of those blanks relies on, cited where it lives. */
  for (const [section, line] of [['ona-sr-heading', 5], ['ona-page-title', 14]]) {
    const source = readFileSync(join(root, 'sections', `${section}.liquid`), 'utf8').split('\n')[line - 1];
    assert.match(source, /page\.title/, `${section}.liquid:${line} no longer derives the title; the citation is stale`);
    assert.ok(doc.includes(`sections/${section}.liquid:${line}`), `the contract should cite ${section}.liquid:${line}`);
  }

  assert.ok(
    /must fall back to the resource title when its setting is blank/.test(doc),
    'the page-header contract no longer requires the fallback'
  );
  assert.ok(
    blanks.includes('page.bookings.json:ona-sr-heading') && /bookings` suffix is shop-wide and serves \*\*three\*\*/.test(doc),
    'the contract no longer explains why one template serving three titled pages forbids a literal heading'
  );
});

/*
 * The document's own thesis is "read the markup, not the schema" -- three mappings in its first
 * draft were wrong because they were derived from {% schema %} rather than from what renders.
 * It then cited sections/ona-training-image-text.liquid:30-36 as the proof that three booking
 * links must be carried; lines 30-36 are the "Title" label inside that section's schema, and
 * the <ul class="courses"> loop is at 16-21. The citation committed the error the section two
 * headings later warns about, and an implementer following it to check what must survive would
 * have found metadata.
 *
 * So every sections/*.liquid line citation is checked against the file's schema span. No
 * citation in the document legitimately points into a schema, so there is no exception list --
 * if one is ever needed, the right fix is to say in prose that the schema is what is meant.
 */
test('no Liquid citation points inside a schema block', () => {
  const cites = [...doc.matchAll(/sections\/([a-z0-9.-]+\.liquid):(\d+)(?:-(\d+))?/g)].map((m) => ({
    file: m[1],
    from: Number(m[2]),
    to: Number(m[3] ?? m[2]),
  }));
  assert.ok(cites.length > 5, `only ${cites.length} Liquid citations found; the probe is broken`);

  const offenders = [];
  for (const cite of cites) {
    const path = join(root, 'sections', cite.file);
    assert.ok(existsSync(path), `the document cites sections/${cite.file}, which does not exist`);
    const lines = readFileSync(path, 'utf8').split('\n');
    const opens = lines.findIndex((line) => /\{%-?\s*schema/.test(line)) + 1;
    const closes = lines.findIndex((line) => /\{%-?\s*endschema/.test(line)) + 1;
    if (!opens || !closes) continue;
    if (cite.from >= opens && cite.to <= closes) {
      offenders.push(`sections/${cite.file}:${cite.from}-${cite.to} (schema is ${opens}-${closes})`);
    }
    assert.ok(
      cite.to <= lines.length,
      `sections/${cite.file}:${cite.from}-${cite.to} runs past the end of the file (${lines.length} lines)`
    );
  }
  assert.deepEqual(offenders, [], 'these citations point at schema metadata, not at rendered markup');
});

/*
 * The paragraph on deliberately-absent components justified excluding slideshow by saying the
 * composites "go to carousel". They do not: component row 4 rules carousel out for exactly
 * those five sections, and the analysis above gives them no verified target. A rationale that
 * contradicts the row it sits under is how a rejected conversion comes back -- an implementer
 * reading only this paragraph learns that the composites have a home.
 */
test('the absent-components rationale does not revive the carousel mapping', () => {
  /* Scoped to the slideshow sentence, not to the section. The first version of this guard ran
     to the next heading, 192 lines on, and "no verified target" appears eight times in that
     span -- seven of them about other pages, any one of which kept it green however the
     slideshow rationale was worded. The claim has to be read where it is made. */
  const absent = between('Two components that looked like matches are deliberately absent.', '**`marquee`**');
  assert.ok(absent.length < 1000, `the slideshow rationale scope is ${absent.length} chars; it has stopped being one paragraph`);

  const carouselRow = kitRows.find((row) => row.join(' ').includes('`carousel`'));
  assert.ok(carouselRow, 'the kit no longer has a carousel row');
  assert.match(
    carouselRow.join(' '),
    /\*\*Not\*\* the five panel-plus-slider sections/,
    'the carousel row no longer rules out the composites, so this guard is checking nothing'
  );

  assert.ok(
    !/composites\s+go to `carousel`/.test(absent),
    'the absent-components paragraph says the composites go to carousel, which row 4 denies'
  );
  assert.ok(
    /no verified target/.test(absent),
    'the absent-components paragraph should say the composites have no verified target'
  );
});

/*
 * The near-identical family sentence quotes how many of its six members carry a video variant.
 * It said four; three do. The media table further down already says which -- it is the same
 * drift as the media-slot count, a number repeated in prose with nothing reading it off the
 * sections. Derived here from the schemas, because that is what "has a video variant" means:
 * a section can expose video settings without the live template using them, so the live media
 * column is the wrong source for this particular claim even though it agrees today.
 */
test('the video-variant count is derived from the family schemas', () => {
  const sentence = between('Beyond the exact matches are families', '**The layout fragments collapse');
  const tokens = [...sentence.matchAll(/`(-?[a-z0-9-]+)`/g)].map((match) => match[1]);
  assert.equal(tokens.length, 6, `the family sentence names ${tokens.length} sections, not six`);

  const files = readdirSync(join(root, 'sections')).filter((file) => file.endsWith('.liquid'));
  const resolved = tokens.map((token) => {
    if (!token.startsWith('-')) return token;
    /* Abbreviated members like `-text-two-images` are written against the family stem. Resolve
       them against the filesystem rather than assuming the stem, so a rename fails loudly. */
    const matches = files.filter((file) => file.endsWith(`${token}.liquid`)).map((f) => f.slice(0, -'.liquid'.length));
    assert.equal(matches.length, 1, `"${token}" resolves to ${matches.length} sections: ${matches.join(', ')}`);
    return matches[0];
  });

  const withVideo = resolved.filter((name) => {
    const source = readFileSync(join(root, 'sections', `${name}.liquid`), 'utf8');
    const schema = source.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema/);
    const settings = schema ? JSON.parse(schema[1]) : {};
    const ids = [...(settings.settings ?? []), ...(settings.blocks ?? []).flatMap((b) => b.settings ?? [])];
    return ids.some((setting) => /video|embed|iframe|youtube/i.test(`${setting.id ?? ''} ${setting.type ?? ''}`));
  });

  assert.ok(withVideo.length > 0, 'no video-capable section found in the family; the probe is broken');
  assert.ok(
    new RegExp(`${NUMBER_WORDS[withVideo.length]} of them with a video\\s+variant`).test(sentence),
    `the family sentence should say ${NUMBER_WORDS[withVideo.length]} carry a video variant, for ${withVideo.join(', ')}`
  );
});

/*
 * The media table described ona-training-text-image-bg as an iframe "over a background image".
 * It is two columns: the embed sits in the text column, the photo in the other, and nothing is
 * layered. The row also missed that the "Watch videos" anchor above the embed is inert -- which
 * matters the other way round from how it reads, because an implementer who believes there is a
 * lightbox will try to rebuild one that never worked.
 *
 * Both halves are derived. The columns come from the Liquid; the inertness comes from the
 * absence of any rule or handler for the three classes involved, which is a claim about the
 * whole theme and so has to be re-checked rather than remembered -- the day someone styles
 * .video-link, this document stops being true and should fail.
 */
test('the text-image-bg row describes the markup and the dead trigger', () => {
  const file = join(root, 'sections', 'ona-training-text-image-bg.liquid');
  const source = readFileSync(file, 'utf8');

  /* Two sibling columns, not a layered background. */
  assert.match(source, /<div class="text[^"]*">[\s\S]*?<div class="data-video">[\s\S]*?<\/div>[\s\S]*?<\/div>\s*<div class="image/,
    'the embed and the image are no longer sibling columns; the media row needs rewriting');
  assert.match(source, /href="javascript:void\(0\);"/, 'the Watch videos anchor changed; the row calls it inert');

  /* Inert means: no rule in any stylesheet, no handler in any script, anywhere in the theme. */
  const bodies = (dir, exts) =>
    readdirSync(join(root, dir))
      .filter((f) => exts.some((e) => f.endsWith(e)))
      .map((f) => readFileSync(join(root, dir, f), 'utf8'));
  const css = bodies('assets', ['.css']).join('\n');
  const js = bodies('assets', ['.js']).join('\n');
  assert.ok(css.length > 1000 && js.length > 1000, 'the asset probe read almost nothing; it is broken');

  for (const klass of ['training-bg', 'video-link', 'a-link']) {
    assert.ok(!new RegExp(`\\.${klass}\\b`).test(css), `.${klass} now has CSS; the row says it has none`);
    assert.ok(!new RegExp(`\\.${klass}\\b`).test(js), `.${klass} is now scripted; the row says the anchor is inert`);
  }

  /* The comparison the note draws: .play-video is styled but equally unhandled. */
  assert.ok(/\.play-video\b/.test(css), 'the note says .play-video has CSS in legacy-page-layout.css, and it no longer does');
  assert.ok(!/play-video/.test(js), 'the note says .play-video has no handler, and it now does');

  assert.ok(
    /\*\*not\*\* a background image/.test(doc) && /the anchor is a removal, not behaviour to reproduce/.test(doc),
    'the document no longer corrects the background-image reading or says the anchor is a removal'
  );
});

/*
 * The Learn row has been wrong twice, in two different ways, and the second way is the one
 * worth guarding.
 *
 * First it sent ona-brewguides-and-training to _product-card. Its two live tiles link to a page
 * and a blog, and _product-card reads only closest.product while the card snippet hard-wires
 * href to product.url and emits no link at all in the onboarding state a page template puts it
 * in -- so both destinations vanish while the tiles still render as placeholders.
 *
 * Then it sent them to _card, which has exactly the right settings and is still wrong: the
 * leading underscore marks a private type. blocks/product-tab.liquid:7-8 states the convention
 * in this theme's own words -- a private type is not offered in "Add block" -- and the only
 * parent admitting _card is _carousel-content. A merchant could not build the tree, and
 * merchant-editable is the test stage 2 is held to, so a correct-looking block tree that cannot
 * be assembled in the editor fails for the same reason a ported ona-* section does.
 *
 * So the target has to be checked for reachability, not just for settings. group is public,
 * carries the link, the background image and the overlay, and takes @theme children.
 */
test('the Learn tiles map to a block a merchant can actually add', () => {
  const schemaOf = (dir, name) => {
    const src = readFileSync(join(root, dir, `${name}.liquid`), 'utf8');
    const match = src.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema/);
    return match ? JSON.parse(match[1]) : null;
  };

  const learn = JSON.parse(stripBanner(readFileSync(join(root, 'templates', 'page.learn.json'), 'utf8')));
  const tiles = Object.values(learn.sections)
    .filter((section) => section.type === 'ona-brewguides-and-training')
    .flatMap((section) => Object.values(section.blocks ?? {}))
    .map((block) => (block.settings ?? {}).url)
    .filter(Boolean);
  assert.equal(tiles.length, 2, `the Learn section has ${tiles.length} linked tiles, not two`);
  for (const url of tiles) {
    assert.ok(!/^shopify:\/\/products\//.test(url), `a Learn tile now points at a product (${url})`);
  }

  /* Why not _product-card. */
  assert.match(readFileSync(join(root, 'blocks', '_product-card.liquid'), 'utf8'), /assign product = closest\.product/,
    '_product-card no longer sources closest.product; the row cites that it does');
  const snippet = readFileSync(join(root, 'snippets', 'product-card.liquid'), 'utf8');
  assert.match(snippet, /href="\{\{ product\.url \}\}"/, 'product-card no longer hard-wires product.url');
  assert.match(snippet, /assign onboarding = true/, 'product-card no longer has an onboarding state');

  /* Why not _card: private, and reachable from one parent only. */
  assert.match(readFileSync(join(root, 'blocks', 'product-tab.liquid'), 'utf8'),
    /a private type \(an underscore prefix\) is not offered in "Add block"/,
    'the theme no longer states the private-type convention the row relies on');
  const admits = [...readdirSync(join(root, 'blocks')), ...readdirSync(join(root, 'sections'))]
    .filter((file) => file.endsWith('.liquid'));
  const cardParents = admits.filter((file) => {
    const dir = existsSync(join(root, 'blocks', file)) ? 'blocks' : 'sections';
    const schema = schemaOf(dir, file.slice(0, -'.liquid'.length));
    return (schema?.blocks ?? []).some((block) => block.type === '_card');
  });
  assert.deepEqual(cardParents, ['_carousel-content.liquid'],
    `_card is now admitted by ${cardParents.join(', ')}; the row says only _carousel-content does`);

  /* The target: public, and carrying the tile. */
  const group = schemaOf('blocks', 'group');
  const ids = new Map((group.settings ?? []).map((setting) => [setting.id, setting.type]));
  assert.equal(ids.get('link'), 'url', 'group no longer has an arbitrary url link');
  assert.equal(ids.get('background_image'), 'image_picker', 'group no longer takes a background image');
  assert.equal(ids.get('toggle_overlay'), 'checkbox', 'group no longer has the overlay the .a-box needs');
  assert.ok((group.blocks ?? []).some((block) => block.type === '@theme'),
    'group no longer accepts @theme children, so it cannot hold the tile heading');
  assert.ok((group.presets ?? []).length > 0, 'group has no preset, so it is not offered in Add block');
  assert.ok(!(group.blocks ?? []).some((block) => block.type === '_card'),
    'group now admits _card, so the row reasoning needs revisiting');

  const row = doc.split('\n').find((line) => line.startsWith('| `/pages/learn`'));
  assert.ok(row, 'the Learn row is gone from the page plan');
  assert.ok(/one `group` per tile/.test(row), 'the Learn row no longer maps the tiles to group');
  assert.ok(/\*\*Not\*\* `_product-card`/.test(row) && /\*\*Not\*\* `_card` either/.test(row),
    'the Learn row no longer rules out both rejected cards');
});

/*
 * The behavioural table said a subject setting was what stood between the three legacy forms
 * and Horizon's contact-form. It is necessary and not sufficient. The legacy forms mark name,
 * email and body required and label them visibly; blocks/contact-form.liquid has no required
 * attribute on any field, hides every label behind visually-hidden in favour of placeholders,
 * and adds a tel phone field. Swapping would relax validation, change the rendered form and
 * add a field nobody asked for -- after the documented blocker was cleared, which is the worst
 * time to discover it.
 *
 * Each of the three gap rows has to carry this itself. A reader lands on one row, and a
 * blocker recorded only in the shared paragraph is a blocker that row does not have.
 */
test('the contact-form gap rows record the validation mismatch', () => {
  const legacy = ['ona-gust-r', 'ona-training-form', 'ona-expericences-content'];

  for (const name of legacy) {
    const source = readFileSync(join(root, 'sections', `${name}.liquid`), 'utf8');
    for (const field of ['name', 'email', 'body']) {
      const input = new RegExp(`<(?:input|textarea)[^>]*\\brequired\\b[^>]*name="contact\\[${field}\\]"`);
      const reversed = new RegExp(`<(?:input|textarea)[^>]*name="contact\\[${field}\\]"[^>]*\\brequired\\b`);
      assert.ok(
        input.test(source) || reversed.test(source),
        `${name} no longer marks contact[${field}] required; the gap rows claim all three are`
      );
    }
    assert.match(source, /<label for="ona-/, `${name} no longer has visible labels; the gap rows claim it does`);

    /* What the visitor gets back after submitting. The legacy forms announce; contact-form
       moves focus and reports one field. */
    assert.match(
      source,
      /role="status"/,
      `${name} no longer announces its success line in a live region; the gap rows claim it does`
    );
    assert.match(
      source,
      /role="alert"[\s\S]{0,80}default_errors/,
      `${name} no longer renders every error through default_errors in an alert; the gap rows claim it does`
    );
  }

  const horizon = readFileSync(join(root, 'blocks', 'contact-form.liquid'), 'utf8');
  /* A boolean attribute is normally written bare, so matching `required=` would miss the very
     edit this is here to catch. aria-required="true" is present and is not validation. */
  assert.deepEqual(
    horizon.match(/(?<!aria-)\brequired\b/g) ?? [],
    [],
    'contact-form now has a required attribute; the gap rows say it has none on any field'
  );
  assert.match(horizon, /class="visually-hidden"/, 'contact-form no longer hides its labels; the gap rows say it does');
  assert.match(horizon, /type="tel"/, 'contact-form no longer has the phone field the gap rows cite');
  assert.match(horizon, /name="contact\[phone\]"/, 'contact-form no longer posts contact[phone]');

  /* The response states. `default_errors` renders every error; contact-form never calls it and
     prints the email field alone, so a missing name or message comes back with nothing shown. */
  assert.ok(
    !/default_errors/.test(horizon),
    'contact-form now renders default_errors; the gap rows say it reports only the email error'
  );
  assert.match(horizon, /form\.errors\.messages\.email/, 'contact-form no longer reports the email error the gap rows cite');
  assert.deepEqual(
    horizon.match(/role="(?:status|alert)"/g) ?? [],
    [],
    'contact-form now has a live-region role; the gap rows say it announces nothing and moves focus instead'
  );
  assert.match(horizon, /autofocus/, 'contact-form no longer moves focus to its response; the gap rows cite that behaviour');

  /* Every one of the three rows states it, not just the shared paragraph. */
  const gaps = between('## Known gaps', '## Page by page');
  for (const name of legacy) {
    const row = gaps.split('\n').find((line) => line.startsWith(`| \`${name}\``));
    assert.ok(row, `the Known gaps row for ${name} is gone`);
    assert.ok(
      /\*\*The field set and validation differ too\*\*/.test(row),
      `the ${name} gap row no longer records the validation mismatch on its own`
    );
    assert.ok(
      /\*\*The response states differ too\*\*/.test(row),
      `the ${name} gap row no longer records the success/error mismatch on its own`
    );
  }

  assert.ok(
    /A subject setting is necessary and\s+\*\*not sufficient\*\*/.test(doc),
    'the behavioural summary is back to implying a subject setting is all that is needed'
  );

  /* The blocker has to travel to wherever someone acts on it. Recording it in the gap rows and
     leaving the page plans and the order of work saying "the subject setting has to exist
     first" is how it gets cleared and the forms change anyway. Rather than list the places,
     derive them: every unit of the document that raises contact[subject] as a prerequisite has
     to raise the field set too. A table row is a unit; so is a paragraph or a numbered step. */
  const units = [];
  let buffer = [];
  for (const line of doc.split('\n')) {
    if (line.startsWith('|')) {
      if (buffer.length) { units.push(buffer.join('\n')); buffer = []; }
      units.push(line);
    } else if (line.trim() === '') {
      if (buffer.length) { units.push(buffer.join('\n')); buffer = []; }
    } else {
      buffer.push(line);
    }
  }
  if (buffer.length) units.push(buffer.join('\n'));

  /* Keyed on the token name at first, which missed the wholesale row -- it raises the same
     blocker in words ("the subject and business fields"). The population is any unit that
     names one of the three forms and talks about the subject at all. */
  const prerequisite = units.filter(
    (unit) => legacy.some((name) => unit.includes(name)) && /subject/i.test(unit)
  );
  assert.ok(prerequisite.length >= 4, `only ${prerequisite.length} units raise the subject blocker; the probe is broken`);
  const silent = prerequisite.filter((unit) => !/required/.test(unit));
  assert.deepEqual(
    silent.map((unit) => unit.split('\n')[0].slice(0, 70)),
    [],
    'these units raise the fixed subject as a blocker without the field-set and validation mismatch beside it'
  );

  /* Same rule for the response states, and for the same reason: the gap rows recorded them while
     the two page plans still ended their prerequisite list at the field set, so following the
     plan would have cleared every listed blocker and still changed what a visitor sees after
     submitting (Codex, #247). */
  /* Matched on the tokens *or* the words, the same lesson the subject check learned above: the
     table rows state the mismatch in prose ("only the email error", "no live-region role")
     rather than naming `role="status"`, and keying on the tokens alone missed them. */
  const quiet = prerequisite.filter(
    (unit) => !/role="status"|role="alert"|default_errors|response state|live.region|only the email (error|field)/i.test(unit)
  );
  assert.deepEqual(
    quiet.map((unit) => unit.split('\n')[0].slice(0, 70)),
    [],
    'these units raise the fixed subject as a blocker without the success/error mismatch beside it'
  );
});

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

/* Same walk, but yielding the node. A probe that sees only settings cannot tell which block
   type holds them, which is how the drift list came to call the blocks `custom_liquid` -- the
   setting key -- when the type is `custom-liquid` (Codex, #247). */
const everyNode = function* (sections) {
  for (const node of Object.values(sections ?? {})) {
    yield node;
    yield* everyNode(node.blocks);
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
  const INLINE_STYLE_TYPE = 'custom-liquid';
  let inline = 0;
  /* The occurrence count alone understates the work: it was read as "one block duplicated four
     ways", when the four product templates each hold four *different* styled blocks. Distinct
     bodies are the number of decisions; occurrences are only how many places they land in. */
  const bodies = new Map();
  const strays = [];
  for (const [file, parsed] of eachTemplate()) {
    for (const node of everyNode(parsed.sections)) {
      const settings = node.settings ?? {};
      const styled = Object.values(settings).some(
        (value) => typeof value === 'string' && value.includes('<style')
      );
      if (!styled) continue;
      if (node.type !== INLINE_STYLE_TYPE) {
        strays.push(`${file}: ${node.type}`);
        continue;
      }
      inline += 1;
      /* Keyed on the styled value itself, not on one setting name: keying on `custom_liquid`
         would collapse every block to a single `undefined` bucket if a style ever moved to a
         different setting, quietly deflating the distinct-body count. */
      const body = Object.entries(settings)
        .filter(([, value]) => typeof value === 'string' && value.includes('<style'))
        .map(([key, value]) => `${key}=${value}`)
        .join('\u0000');
      bodies.set(body, (bodies.get(body) ?? 0) + 1);
    }
  }

  assert.ok(inline > 0, 'the probe found no inline <style>, so it is broken');
  /* Restricting the count to one type would hide a styled block of another; this says so. */
  assert.deepEqual(strays, [], `these styled blocks are not ${INLINE_STYLE_TYPE}, so the drift list undercounts`);
  assert.ok(
    existsSync(join(root, 'blocks', `${INLINE_STYLE_TYPE}.liquid`)),
    `${INLINE_STYLE_TYPE} is not a real block type; the name in the drift list would send an implementer nowhere`
  );
  assert.match(
    doc,
    new RegExp(`\\*\\*${inline} \\\`${INLINE_STYLE_TYPE}\\\` blocks carry an inline \\\`<style>\\\`\\*\\*`),
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
 * The declared-gap population is not just the rows that start with a name. Two gap rows are
 * collective -- "the five panel-plus-slider composites" and "every media/text section carrying
 * `.animated-svg` -- **15 of them**" -- and reading only named rows let a page plan drop
 * `ona-traning-supported`, one of the five, with the suite green (Codex, #247). Derive the
 * members rather than listing them: the composites from the table that defines them, the
 * decorative-layer sections from the filesystem, the same grep the gap row quotes.
 */
const between = (from, to) => doc.slice(doc.indexOf(from), doc.indexOf(to));

const gappedSections = () => {
  const gaps = between('## Known gaps', '## Page by page');
  /* Read every backticked ona-* name out of the row's SUBJECT cell, not just a name the row
     happens to start with. Rows whose subject is descriptive -- "the Learn tiles
     (`ona-brewguides-and-training`)", "the four wholesale anchor targets — ...", "the five
     silent-embed sections — ..." -- were invisible to the old prefix match, so a section gapped
     only by one of those counted as ungapped and could be claimed as a clean mapping. */
  const named = gaps
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .flatMap((line) => [...(line.split('|')[1] ?? '').matchAll(/`(ona-[a-z0-9-]+)`/g)].map((m) => m[1]));

  const compositeTable = between(
    '### The dominant shape is a composite',
    '### The media slot holds less than the sections do'
  );
  const composites = [...compositeTable.matchAll(/^\| `(ona-[a-z0-9-]+)` \|/gm)].map((m) => m[1]);
  assert.equal(composites.length, 5, `the composite table lists ${composites.length} sections, not five`);
  assert.ok(
    gaps.includes('the five panel-plus-slider composites'),
    'Known gaps no longer carries the collective row for the panel-plus-slider composites'
  );

  const carriers = readdirSync(join(root, 'sections'))
    .filter((file) => file.startsWith('ona-') && file.endsWith('.liquid'))
    .filter((file) => readFileSync(join(root, 'sections', file), 'utf8').includes('animated-svg'))
    .map((file) => file.replace(/\.liquid$/, ''));
  assert.ok(carriers.length > 1, 'the .animated-svg probe found almost nothing; it is broken');
  assert.ok(
    gaps.includes(`carrying \`.animated-svg\` — **${carriers.length} of them**`),
    `the collective gap row should say ${carriers.length}`
  );

  const all = new Set([...named, ...composites, ...carriers]);
  assert.ok(all.size > 15, `only ${all.size} gapped sections found; the probe is broken`);
  return all;
};

/*
 * A section with a Known-gaps row is, by definition, not a clean mapping -- but the kit table
 * is what an implementer follows, and `ona-faq-lists` sat in a Replaces cell with no marker at
 * all while its gap row said the replacement could not be invisible (Codex, #247). The two
 * tables have to agree in this direction too: naming a gapped section as a replacement is only
 * honest if the cell says so.
 *
 * The first version of this asked whether the *cell* carried a marker, which is useless: rows
 * 2, 5 and 6 already contain "blocked", so all three became permanently exempt and a new
 * unqualified mapping could be appended to any of them with the suite still green. Row 6 is
 * the row this guard was written for, and giving it its marker is what exempted it. Demonstrated
 * by appending `ona-awards` to row 2 as a straight swap: 23/23 pass. The marker has to attach
 * to the *name*, so the clause each gapped name sits in is the unit, not the cell.
 *
 * `**Not**` counts as a treatment: row 4 already uses that idiom to exclude a target, and an
 * explicit exclusion is the opposite of an unqualified mapping, not an instance of one.
 */
test('no kit row offers a gapped section as an unqualified replacement', () => {
  const kit = between('## The kit', '### Why `media-with-content` carries the weight');
  const gapped = gappedSections();

  /* `\|` is a literal pipe inside a cell; splitting on every pipe would truncate the cell at
     the escape and scan neither the names nor the markers after it. */
  const cells = (row) => row.split(/(?<!\\)\|/);
  const TREATED = /\bblocked\b|Known gaps|no verified target/i;

  /* Three span-shaped versions of this were each defeated by a one-line edit: cell-level let a
     name be appended anywhere in an already-marked row, sentence-level let it be inserted before
     the period of a marked sentence, comma-level let it be joined on with "and" (Codex, #247,
     three rounds). Spans are the wrong unit. A marker is evidence about the name it sits beside.

     So each name owns the text from itself to the next section name, or to the end of the cell:
     a marker that qualifies an earlier name cannot reach across the name that follows it. The
     one qualifier that legitimately *precedes* a name is `**Not**`, so that is matched in a
     short lookbehind -- short enough that it cannot reach a distant marker. */
  const unqualified = [];
  for (const row of kit.split('\n').filter((line) => /^\| \d+ \|/.test(line))) {
    const replaces = cells(row).at(-2) ?? '';
    const names = [...replaces.matchAll(/`(ona-[a-z0-9-]+)`/g)];

    for (const [index, match] of names.entries()) {
      if (!gapped.has(match[1])) continue;
      const territory = replaces.slice(match.index, names[index + 1]?.index ?? replaces.length);
      const lookbehind = replaces.slice(Math.max(0, match.index - 12), match.index);
      if (TREATED.test(territory) || /\*\*Not\*\*\s*$/.test(lookbehind)) continue;
      unqualified.push(match[1]);
    }
  }

  assert.deepEqual(
    unqualified,
    [],
    `these sections have a declared gap but are offered as a plain replacement in the kit table: ${unqualified.join(', ')}`
  );
});

/*
 * Two page-plan rows omitted a gapped section that is live on the page: `/pages/barista-courses`
 * left out `ona-training-form` (blocked by its fixed contact subject, not only by the blob) and
 * the bookings row left out `ona-faq-lists` -- the very instance the kit row had just flagged as
 * never checked (Codex, #247). Both were found by reading, which is the wrong way to find them:
 * the page plan is derivable from the templates, so derive it.
 *
 * PAGE_ROWS is explicit because a page's URL is not in the repository -- Shopify maps page to
 * template by templateSuffix, which is shop-side. The enumeration risk that creates is closed
 * below: every page template carrying a gapped live section must appear here, so a new one
 * cannot be quietly left out of the plan by being left out of this table.
 */
const PAGE_ROWS = [
  ['templates/page.wholesale.json', '| `/pages/wholesale` |'],
  ['templates/page.learn.json', '| `/pages/learn` |'],
  ['templates/page.training.json', '| `/pages/barista-courses` |'],
  ['templates/page.about.json', '| `/pages/about` |'],
  ['templates/page.bookings.json', '| bookings ×3 |'],
  ['templates/page.private-courses-and-experiences.json', '| `/pages/private-courses-and-experiences` |']
];

test('every page plan names the gapped sections live on that page', () => {
  const gapped = gappedSections();
  const compositeTable = between(
    '### The dominant shape is a composite',
    '### The media slot holds less than the sections do'
  );
  const composites = [...compositeTable.matchAll(/^\| `(ona-[a-z0-9-]+)` \|/gm)].map((m) => m[1]);

  /* Live means in `order` and not disabled -- a parked section is not work this page owes. */
  const liveGapped = (file) => {
    const parsed = JSON.parse(stripBanner(readFileSync(join(root, file), 'utf8')));
    const order = new Set(parsed.order ?? []);
    return [
      ...new Set(
        Object.entries(parsed.sections ?? {})
          .filter(([id, section]) => order.has(id) && !section.disabled && gapped.has(section.type))
          .map(([, section]) => section.type)
      )
    ].sort();
  };

  /* The table has to cover every page template that owes work, or omitting a row from the
     table would hide the same omission this test exists to catch. */
  const owes = readdirSync(join(root, 'templates'))
    .filter((file) => /^page\..+\.json$/.test(file))
    .map((file) => join('templates', file))
    .filter((file) => liveGapped(file).length);
  const listed = new Set(PAGE_ROWS.map(([file]) => file));
  assert.deepEqual(
    owes.filter((file) => !listed.has(file)),
    [],
    'these page templates carry a gapped live section but are not in PAGE_ROWS, so their plan row is unchecked'
  );

  /* A plan row is allowed to treat a group collectively -- it does, for the sourcing clones and
     the panel-plus-slider composites, and spelling out nine names per row would make the plan
     unreadable. But a collective mention only covers the group if the row says how many of that
     group are on *this* page: that is what makes dropping one member detectable. Drop
     `ona-traning-supported` from the barista row and the composites live there fall from one to
     zero, so the row no longer carries a count that matches. */
  const COLLECTIVES = [
    {
      what: 'sourcing clones',
      members: (name) => /^ona-(wholesale-|traning-)?sourcing(-v\d+)?$/.test(name),
      stated: (row, n) => new RegExp(`\\*\\*${NUMBER_WORDS[n]}\\*\\* sourcing sections`, 'i').test(row)
    },
    {
      what: 'panel-plus-slider composites',
      members: (name) => composites.includes(name),
      stated: (row, n) => new RegExp(`the ${NUMBER_WORDS[n]} panel-plus-slider composites?`, 'i').test(row)
    }
  ];

  const missing = [];
  for (const [file, marker] of PAGE_ROWS) {
    const row = doc.split('\n').find((line) => line.startsWith(marker));
    assert.ok(row, `the page-plan row ${marker} is gone or renamed`);

    const live = liveGapped(file);
    const covers = (name) =>
      row.includes(`\`${name}\``) ||
      COLLECTIVES.some(
        (group) => group.members(name) && group.stated(row, live.filter(group.members).length)
      );

    for (const group of COLLECTIVES) {
      const onThisPage = live.filter(group.members);
      if (!onThisPage.length) continue;
      if (onThisPage.every((name) => row.includes(`\`${name}\``))) continue;
      if (!group.stated(row, onThisPage.length)) {
        missing.push(
          `${marker} leans on the ${group.what} collectively but does not say ${NUMBER_WORDS[onThisPage.length]} are on this page`
        );
      }
    }

    missing.push(...live.filter((name) => !covers(name)).map((name) => `${marker} omits ${name}`));
  }

  assert.deepEqual(
    missing,
    [],
    `these pages run a section with a declared gap that their plan row does not mention: ${missing.join('; ')}`
  );
});

/*
 * Step 2 solves the decorative layer and steps 3-5 then convert the pages. Some sections carry
 * the blob *and* are blocked by something the blob decision does not touch, so step 2 does not
 * release them -- and an ordered plan that says "the same prerequisite" hands an implementer a
 * page that is still blocked. Step 4 did exactly that with `ona-training-form`, whose fixed
 * `contact[subject]` survives any decision about the blob (Codex, #247).
 *
 * The first version of this derived the set as "carries a blob AND has a named gap row", which
 * over-generated and made me write a false claim into step 5: `ona-careers` and `ona-content`
 * both match that intersection, and both gap rows say in their own words that the blob IS the
 * blocker -- `ona-careers` even has its destination setting already (`blocks/button.liquid`
 * carries the `link` its "VIEW LISTING" url needs). Presence in two populations is not evidence
 * about the content of a row (Codex, #247, again).
 *
 * So the marker is authored, and the guard checks it both ways: a marked row may not also say
 * the blob is what blocks it, and a carrier row that is *not* marked must say so explicitly, so
 * a genuinely independent blocker cannot be hidden by leaving the marker off.
 */
const ORDER_STEPS = [
  ['templates/page.wholesale.json', /^3\. \*\*Wholesale\*\*/],
  ['templates/page.training.json', /^4\. \*\*Barista courses\*\*/],
  ['templates/page.about.json', /^5\. \*\*About\*\*/]
];

test('an order-of-work step names the blockers step 2 does not clear', () => {
  const order = between('## Order of work', '## Rules');
  const gaps = between('## Known gaps', '## Page by page');
  const namedRows = gaps
    .split('\n')
    .filter((line) => /^\| `ona-[a-z0-9-]+`/.test(line))
    .map((line) => line.match(/^\| `(ona-[a-z0-9-]+)`/)[1]);

  const carriers = readdirSync(join(root, 'sections'))
    .filter((file) => file.startsWith('ona-') && file.endsWith('.liquid'))
    .filter((file) => readFileSync(join(root, 'sections', file), 'utf8').includes('animated-svg'))
    .map((file) => file.replace(/\.liquid$/, ''));

  const INDEPENDENT = '**independent of the decorative layer**';
  const BLOB_IS_THE_BLOCKER = /Blocked on the blob|needs the blob solved first/i;
  const gapRow = (name) =>
    gaps.split('\n').find((line) => line.startsWith(`| \`${name}\``)) ?? '';

  const doubly = namedRows.filter((name) => carriers.includes(name) && gapRow(name).includes(INDEPENDENT));
  assert.ok(doubly.length > 0, 'no independently-blocked carrier found; the marker or the probe is broken');

  /* Both directions. A row cannot claim independence and also say the blob is the blocker, and
     a carrier row without the marker has to say the blob is the blocker rather than just
     omitting the question -- otherwise dropping the marker would quietly shrink this set. */
  for (const name of doubly) {
    assert.doesNotMatch(
      gapRow(name),
      BLOB_IS_THE_BLOCKER,
      `${name} is marked ${INDEPENDENT} but its gap row also says the blob is what blocks it`
    );
  }
  /* A third state exists now that blocks/image.liquid carries the shape: released. A row may
     only claim it when the section actually has an image for the shape to sit behind -- that is
     the whole of the ona-content exception, and reading it off the section rather than trusting
     the row is what stops "released" becoming a word anyone can type. */
  const RELEASED = /\*\*Released by the shape\*\*/;
  const hasImage = (name) => {
    const source = readFileSync(join(root, 'sections', `${name}.liquid`), 'utf8');
    return /<img\b/.test(source) || /"type":\s*"image_picker"/.test(source);
  };

  for (const name of namedRows.filter((section) => carriers.includes(section) && !doubly.includes(section))) {
    if (hasImage(name)) {
      assert.match(
        gapRow(name),
        RELEASED,
        `${name} carries a blob and an image, so the shape reaches it -- its gap row should say so rather than leaving it blocked`
      );
      assert.doesNotMatch(
        gapRow(name),
        BLOB_IS_THE_BLOCKER,
        `${name} has an image the shape can sit behind, so the blob is no longer what blocks it`
      );
    } else {
      assert.match(
        gapRow(name),
        BLOB_IS_THE_BLOCKER,
        `${name} carries a blob, has no image for the shape to attach to, and its row neither claims an independent blocker nor says the blob is the blocker`
      );
      assert.doesNotMatch(
        gapRow(name),
        RELEASED,
        `${name} has no image, so the shape cannot reach it and its row may not claim release`
      );
    }
  }

  /* Steps are numbered list items: from the marker to the next top-level number. */
  const stepText = (marker) => {
    const lines = order.split('\n');
    const start = lines.findIndex((line) => marker.test(line));
    assert.ok(start >= 0, `the order-of-work step ${marker} is gone or renumbered`);
    const rest = lines.slice(start + 1).findIndex((line) => /^\d+\. /.test(line));
    return lines.slice(start, rest === -1 ? undefined : start + 1 + rest).join('\n');
  };

  /* Step 2 restates this set in the prose an implementer actually reads, and the first time I
     corrected it I corrected step 5 and left step 2 saying all four carriers "carry their own
     gap rows for other reasons as well" (Codex, #247). One fact, two places, so check they
     agree rather than fixing the one that was quoted at me. */
  /* The doc is hard-wrapped at ~75 characters, so the marker is routinely split across a line
     break and a literal `includes` on the raw text fails on a reflow that changed nothing.
     Collapse the whitespace first: the claim is about the words, not where the lines end. */
  const stepTwo = stepText(/^2\. \*\*Solve the decorative layer\*\*/).replace(/\s+/g, ' ');
  const claim = stepTwo
    .split(/(?<=\.)\s+/)
    .find((sentence) => sentence.includes(INDEPENDENT));
  assert.ok(claim, `step 2 no longer says which carriers are ${INDEPENDENT}`);

  const claimed = [...claim.matchAll(/`(ona-[a-z0-9-]+)`/g)].map((match) => match[1]).sort();
  assert.deepEqual(
    claimed,
    [...doubly].sort(),
    'step 2 names a different set of independently-blocked carriers than the gap rows mark'
  );

  const missing = [];
  for (const [file, marker] of ORDER_STEPS) {
    const parsed = JSON.parse(stripBanner(readFileSync(join(root, file), 'utf8')));
    const ids = new Set(parsed.order ?? []);
    const live = new Set(
      Object.entries(parsed.sections ?? {})
        .filter(([id, section]) => ids.has(id) && !section.disabled)
        .map(([, section]) => section.type)
    );
    const step = stepText(marker);
    for (const name of doubly.filter((section) => live.has(section))) {
      if (!step.includes(`\`${name}\``)) missing.push(`${marker.source} omits ${name}`);
    }
  }

  assert.deepEqual(
    missing,
    [],
    `these steps present step 2 as sufficient for a section that is blocked for a second, ` +
      `unrelated reason: ${missing.join('; ')}`
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
  /* indexOf, not lastIndexOf: taking from the *last* mention would shrink the clause to
     nothing if a second mention were added later in the row, and the test would fail for the
     wrong reason. Pin the count so a second mention is a deliberate change. */
  const mentions = planRow.match(/`ona-gust-r`/g) ?? [];
  assert.equal(mentions.length, 1, `the wholesale row mentions ona-gust-r ${mentions.length} times; this guard assumes one`);
  const clause = planRow.slice(planRow.indexOf('`ona-gust-r`'));
  /* This used to require the clause to call for a `two-column container`, which pinned a layout
     the page does not have: the form wrapper closes at `sections/ona-gust-r.liquid:55` and the
     promo is the sibling <section> at 57, stacked below it. Enforcing the old claim would have
     made correcting the page fail the suite, so the guard now holds the two things that are
     actually true -- the promo is separate, and what is left blocking is the form. */
  assert.doesNotMatch(
    clause,
    /two-column container|beside the form/i,
    'the wholesale plan still puts the promo beside the form; it is a sibling section stacked below it'
  );
  assert.match(
    clause,
    /subject and business fields/i,
    'the wholesale plan no longer names the subject and business fields, which are what block this section'
  );
  assert.match(
    clause,
    /field set and validation/i,
    'the wholesale plan no longer names the field set and validation gap'
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

/*
 * The Learn row claimed a `group` reproduces "the live tile exactly". It does not: the legacy
 * tile wraps the heading and "Learn more" inside the anchor, which is where the link gets its
 * accessible name, while `snippets/group.liquid` emits the anchor empty and as a sibling of the
 * content (Codex, #247). Both halves are derived, so the doc follows the theme in both
 * directions -- if the anchor ever wraps its children or gains a label, the gap row is the
 * stale thing, not the snippet.
 */
test('the Learn tile gap tracks what snippets/group.liquid emits', () => {
  const snippet = readFileSync(join(root, 'snippets/group.liquid'), 'utf8');
  const anchor = snippet.match(/<a\b[\s\S]*?class="group-block__link"[\s\S]*?<\/a>/);
  assert.ok(anchor, 'snippets/group.liquid no longer emits a group-block__link anchor; the probe is broken');

  const legacy = readFileSync(join(root, 'sections/ona-brewguides-and-training.liquid'), 'utf8');
  const legacyAnchor = legacy.match(/<a\b[^>]*class="list-box"[\s\S]*?<\/a>/);
  assert.ok(legacyAnchor, 'the legacy tile no longer has a list-box anchor; the probe is broken');
  assert.match(
    legacyAnchor[0],
    /block\.settings\.title/,
    'the legacy tile anchor no longer wraps its heading; the contrast this gap rests on is gone'
  );

  const schema = readFileSync(join(root, 'blocks/group.liquid'), 'utf8');
  const labelSetting = [...schema.matchAll(/"id":\s*"([^"]*label[^"]*)"/gi)].map((match) => match[1]);
  const named = !/>\s*<\/a>\s*$/.test(anchor[0]) || /aria-label/.test(anchor[0]) || labelSetting.length > 0;

  const gapRow = doc
    .split('\n')
    .find((line) => line.startsWith('| the Learn tiles (`ona-brewguides-and-training`)'));

  if (named) {
    assert.equal(
      gapRow,
      undefined,
      `the group link can now be named (${labelSetting.join(', ') || 'the anchor wraps its content'}); the Learn gap row is stale`
    );
    return;
  }

  assert.ok(gapRow, 'the group link is still unnamed, but the Learn tiles have no gap row');
  /* Locating the row by its opening words and never reading it let the body be replaced with
     "nothing blocking, actually." and still pass. */
  assert.match(gapRow, /group-block__link/, 'the Learn gap row does not cite the markup it rests on');
  assert.match(gapRow, /accessible name|aria-label|unnamed link/i, 'the Learn gap row no longer says what is lost');
  assert.ok(
    !doc.includes('the live tile exactly'),
    'the Learn row still claims the group reproduces the live tile exactly, while the anchor carries no accessible name'
  );
  const planRow = doc.split('\n').find((line) => line.startsWith('| `/pages/learn`'));
  assert.ok(planRow, 'the Learn page plan row is gone; the probe is broken');
  assert.match(
    planRow,
    /Known gaps/,
    'the Learn plan row does not send the reader to the gap row that blocks its tile mapping'
  );
});

/*
 * `media_type: embed` reads like a working video and is not one: every non-Vimeo URL falls to an
 * empty `<div>` that no script in the theme drives, so the live page shows a cover image and a
 * dead play button. Mapping those sections to a `video` block starts a video that does not play
 * today -- with `autoplay` already set in the template -- which is a behaviour change ONA has to
 * decide on, not a reproduction (Codex, #247). The population is derived from the live templates
 * so a third instance cannot be added without a gap row.
 */
test('every live embed that renders nothing is recorded as a behaviour change', () => {
  /* Seven of the nine configured instances are set on BLOCKS, not on the section, so a probe
     that reads section-level settings finds two and reports the gap as a fraction of its real
     size. That is what the first version did, and its own comment claimed a third instance
     could not be added without a gap row. */
  const silent = [];
  for (const file of readdirSync(join(root, 'templates')).filter((name) => name.endsWith('.json'))) {
    const data = JSON.parse(stripBanner(readFileSync(join(root, 'templates', file), 'utf8')));
    const walk = (node, owner, off) => {
      const settings = node.settings ?? {};
      const type = owner ?? node.type;
      /* A block inside a disabled section is not live either, so the flag travels down. */
      const disabled = off || Boolean(node.disabled);
      if (settings.media_type === 'embed' && !String(settings.video_url ?? '').includes('vimeo')) {
        const liquid = readFileSync(join(root, 'sections', `${type}.liquid`), 'utf8');
        if (/<div id="\{\{ player_id \}\}"[^>]*><\/div>/.test(liquid)) {
          silent.push({ type, disabled, autoplay: Boolean(settings.autoplay), onBlock: owner !== undefined });
        }
      }
      for (const child of Object.values(node.blocks ?? {})) walk(child, type, disabled);
    };
    for (const section of Object.values(data.sections ?? {})) walk(section, undefined, false);
  }

  const handled = readdirSync(join(root, 'assets'))
    .filter((name) => name.endsWith('.js'))
    /* (?<!auto) so assets/autoplay-video.js, which exists and is unrelated, cannot trip this. */
    .some((name) => /(?<!auto)play-video|iframe_api|YT\.Player|player_id/.test(readFileSync(join(root, 'assets', name), 'utf8')));

  if (handled) {
    assert.fail('a script now drives the legacy embeds; the "nothing plays" gap row no longer holds');
  }

  /* Exact, not a lower bound. The lower bound passed while the document claimed eight total,
     six on blocks and seven enabled, when the template holds nine configured -- two on sections
     and seven on blocks, one of the `ona-exclusive-access` blocks disabled, so eight live
     (Codex, #247). A floor cannot keep a migration inventory honest; adding a tenth would have
     left the count stale and still green. */
  const live = silent.filter((instance) => !instance.disabled);
  /* Read out of the sentence rather than repeated here. Hardcoding the numbers in the test
     would let the prose drift from them in exactly the way the lower bound already allowed --
     the document would say eight, the test would say nine, and both would be green. */
  const claim = doc
    .replace(/\s+/g, ' ')
    .match(/There are (\w+) configured — two on sections and (\w+) on blocks — one of the `ona-exclusive-access` blocks is disabled, so \*\*(\w+) are live\*\*, and all (\w+) carry `autoplay: true`\./);
  assert.ok(claim, 'the silent-embed sentence has changed shape; this guard reads its numbers out of it');

  const WORDS = { six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11 };
  const [, totalWord, blockWord, liveWord, autoplayWord] = claim;
  assert.equal(silent.length, WORDS[totalWord], `the template holds ${silent.length} configured silent embeds; the document says ${totalWord}`);
  assert.equal(silent.filter((i) => i.onBlock).length, WORDS[blockWord], `${silent.filter((i) => i.onBlock).length} are set on blocks; the document says ${blockWord}`);
  assert.equal(live.length, WORDS[liveWord], `${live.length} are live; the document says ${liveWord}`);
  assert.equal(
    live.filter((instance) => instance.autoplay).length,
    WORDS[autoplayWord],
    `${live.filter((i) => i.autoplay).length} live embeds carry autoplay: true; the document says ${autoplayWord}`
  );

  /* Matched against the whitespace-normalised document: the first version keyed on the exact
     line wrap of the deleted claim, so restoring it as one unwrapped line passed. */
  assert.ok(
    !doc.replace(/\s+/g, ' ').includes('Same layout, same media'),
    'the component-1 paragraph still promises the same media for sections whose video does not play'
  );

  /* Scoped to the gap table. Read over the whole document, the /pages/wholesale plan row --
     which lists every section on the page -- was one phrase away from answering for the row
     that decides. */
  const gapsOnly = between('## Known gaps', '## Page by page');
  const gapRows = gapsOnly
    .split('\n')
    .filter((line) => /^\|/.test(line) && /behaviour change/i.test(line) && /autoplay/.test(line));
  const unrecorded = [...new Set(silent.map((instance) => instance.type))].filter(
    (name) => !gapRows.some((row) => row.includes(`\`${name}\``))
  );
  assert.deepEqual(unrecorded, [], 'these silent embed sections have no gap row calling the swap a behaviour change');
});

/*
 * The wholesale page navigates to itself: `ona-icon-and-content` links to four `#anchors`, and
 * each is the `id` *setting* of another section on the same page, emitted on its wrapper.
 * Horizon's `section` has no anchor setting, so replacing any of those four breaks a link on the
 * same page -- a blocker independent of each section's own gap, and one the kit did not record
 * (Codex, #247). The population is derived from the templates, so a fifth anchor cannot be
 * added without a gap row, and the probe ignores anchors that resolve some other way (the
 * homepage's `#coffee-quiz` is a hardcoded id in `sections/coffee-quiz.liquid`, not a setting).
 */
test('every in-page anchor owned by a section setting is recorded as a blocker', () => {
  const HEX = /^#[0-9a-f]{3,8}$/i;
  /* Pairs, not a map keyed by type: the same section type can own different anchors in two
     templates, and a map would keep only the last. */
  const owners = new Set();
  for (const [, parsed] of eachTemplate()) {
    const sections = Object.values(parsed.sections ?? {});
    const byAnchor = new Map();
    for (const section of sections) {
      const anchor = (section.settings ?? {}).id;
      if (typeof anchor === 'string' && anchor) byAnchor.set(anchor, section.type);
    }
    for (const node of everyNode(parsed.sections)) {
      for (const value of Object.values(node.settings ?? {})) {
        if (typeof value !== 'string' || !value.startsWith('#') || HEX.test(value)) continue;
        const target = byAnchor.get(value.slice(1));
        if (target) owners.add(`${target}\u0000${value.slice(1)}`);
      }
    }
  }

  assert.ok(owners.size >= 4, `only ${owners.size} setting-owned anchors found; the probe is broken`);

  /* The row and the theme have to agree about whether this gap is still open. It was written
     while `section` had no anchor setting; #284 added one, so the row now says solved. If the
     setting is ever removed the row becomes a false all-clear, which is the worse direction --
     so this checks both ways round rather than asserting one state. */
  const target = readFileSync(join(root, 'sections/section.liquid'), 'utf8');
  const schema = JSON.parse(target.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/)[1]);
  const anchorSetting = (schema.settings ?? []).find((setting) => /^(id|anchor|section_id)$/.test(setting.id ?? ''));
  const anchorRow = between('## Known gaps', '## Page by page')
    .split('\n')
    .filter((line) => /^\|/.test(line))
    .find((row) => /anchor/i.test(row.split('|')[1] ?? '')) ?? '';
  const claimsSolved = /\*\*Solved\*\*/.test(anchorRow);
  assert.equal(
    claimsSolved,
    anchorSetting !== undefined,
    anchorSetting
      ? 'sections/section.liquid has an anchor setting but the gap row still reads as an open blocker'
      : 'the gap row says the anchor is solved but sections/section.liquid has no anchor setting'
  );
  if (anchorSetting) {
    /* `group` alone is too loose a marker -- the row names group blocks for other reasons, so
       an alternation on it stayed green when the caveat itself was deleted. Require the claim. */
    assert.match(
      anchorRow,
      /top-level `section`/,
      'the solved row no longer says each target must stay its own top-level section'
    );
    assert.match(
      anchorRow,
      /`group`[^|]*(break|reach only)|(?:break|reach only)[^|]*`group`/,
      'the solved row no longer says collapsing the four into group blocks breaks the links'
    );
  }

  /* Same shape, for the decorative layer. The row was written while nothing could carry the
     blob; `blocks/image.liquid` can now, so the row says solved. Checked both ways round, so
     removing the setting turns the row into a false all-clear rather than going unnoticed. */
  const imageSchema = JSON.parse(
    readFileSync(join(root, 'blocks/image.liquid'), 'utf8').match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/)[1]
  );
  const shapeSetting = (imageSchema.settings ?? []).find((setting) => setting.id === 'decorative_shape');
  const carriersWithShape = readdirSync(join(root, 'sections'))
    .filter((file) => file.endsWith('.liquid'))
    .filter((file) => readFileSync(join(root, 'sections', file), 'utf8').includes('animated-svg'));
  const blobRow = between('## Known gaps', '## Page by page')
    .split('\n')
    .filter((line) => /^\|/.test(line))
    .find((row) => /animated-svg/.test(row.split('|')[1] ?? '')) ?? '';
  assert.ok(blobRow, 'the decorative-layer gap row is gone');
  assert.equal(
    /\*\*Solved\b/.test(blobRow),
    shapeSetting !== undefined,
    shapeSetting
      ? 'blocks/image.liquid carries a decorative shape but the gap row still reads as an open blocker'
      : 'the gap row says the decorative layer is solved but blocks/image.liquid has no shape setting'
  );
  if (shapeSetting) {
    /* The caveat is the whole value of the row now: the setting is on the public `image`
       block, so these sections go to component 1 and row 2 of the kit is stale for them. */
    assert.match(
      blobRow,
      /component 1/,
      'the solved row no longer says the conversion target moves to component 1'
    );

    /* And the exception. An image block cannot carry the layer for a section with no image,
       so the row has to name the ones that are still blocked rather than claim all 15. The
       count is measured, not quoted, so adding an image to ona-content moves it on its own. */
    const imageless = readdirSync(join(root, 'sections'))
      .filter((file) => file.endsWith('.liquid'))
      .filter((file) => readFileSync(join(root, 'sections', file), 'utf8').includes('animated-svg'))
      .filter((file) => !/<img\b|"type":\s*"image_picker"/.test(readFileSync(join(root, 'sections', file), 'utf8')))
      .map((file) => file.replace(/\.liquid$/, ''));
    assert.ok(imageless.length >= 1, 'every .animated-svg section now has an image; the exception probe is broken');
    assert.match(
      blobRow,
      new RegExp(`Solved for ${carriersWithShape.length - imageless.length} of the ${carriersWithShape.length}`),
      `the row does not say how many of the ${carriersWithShape.length} are solved; ${imageless.length} carry no image for the shape to attach to`
    );
    /* Naming it ANYWHERE in the row is not enough -- the row already lists `ona-content` among
       the sections that share a colour, so a plain `includes` stayed green when the exception
       clause itself was deleted. The name has to sit next to the claim that it is blocked. */
    for (const section of imageless) {
      const named = new RegExp(
        `\`${section}\`[^.|]{0,90}(?:blocked|exception)|(?:blocked|exception)[^.|]{0,90}\`${section}\``
      );
      assert.match(
        blobRow,
        named,
        `${section} carries the layer and has no image, so an image block cannot hold it -- the row has to name it as still blocked, not merely mention it`
      );
    }
  }

  /* The document has to state the OWNERSHIP, not merely mention both names somewhere in one
     row. Two earlier versions were satisfied by a row that happened to contain every section
     and every anchor -- first the wholesale plan row, then the gap row itself -- under which a
     mis-paired "#supported → ona-exclusive-access" would read as correct and send an
     implementer to rewrite the wrong link. So the row carries explicit `#anchor` → `section`
     arrows and this reads them back. */
  const gaps = between('## Known gaps', '## Page by page');
  const gapRows = gaps.split('\n').filter((line) => /^\|/.test(line));
  assert.ok(gapRows.length > 5, `only ${gapRows.length} gap rows found; the probe is broken`);

  /* From the row that is ABOUT the anchors, not from anywhere in the table. Scanning the whole
     table let the dedicated row be deleted and its arrows reappear as a trailing clause on the
     unrelated .animated-svg row -- where the information technically survives and the finding
     does not, since nobody rebuilding ona-supported reads the decorative-layer row. */
  const anchorRows = gapRows.filter((row) => /anchor/i.test(row.split('|')[1] ?? ''));
  assert.equal(
    anchorRows.length,
    1,
    `${anchorRows.length} gap rows are about anchors; the pairs belong in exactly one row of their own`
  );
  const stated = new Set(
    [...anchorRows[0].matchAll(/`#([\w-]+)`\s*→\s*`(ona-[a-z0-9-]+)`/g)].map((m) => `${m[2]}\u0000${m[1]}`)
  );
  assert.ok(stated.size >= 4, `the anchor row states ${stated.size} anchor→section pairs; the probe is broken`);

  const show = (pair) => pair.replace('\u0000', ' owns #');
  assert.deepEqual(
    [...owners].filter((pair) => !stated.has(pair)).map(show),
    [],
    'these live anchor/section pairs are not stated in the gap table'
  );
  assert.deepEqual(
    [...stated].filter((pair) => !owners.has(pair)).map(show),
    [],
    'the gap table states anchor/section pairs that are not what the templates actually hold'
  );

  /* The section has to actually emit the setting, or the finding rests on nothing. */
  for (const pair of owners) {
    const name = pair.split('\u0000')[0];
    const liquid = readFileSync(join(root, 'sections', `${name}.liquid`), 'utf8');
    assert.match(liquid, /id="\{\{ section\.settings\.id \}\}"/, `${name} no longer emits its id setting; the anchor row is stale`);
  }
});

/*
 * The ona-training gap row judged the section against `media-with-content` while the mapping
 * above sends it to component 1, and concluded its accordion and CTA had no target. They do
 * (Codex, #247). A gap row that overstates sends the implementer to design functionality the
 * theme already ships, so this checks the parts exist and that the row says so.
 */
test('the ona-training gap row is measured against the target the mapping gives it', () => {
  const schemaOf = (file) =>
    JSON.parse(readFileSync(join(root, file), 'utf8').match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/)[1]);

  const accepts = (file) => (schemaOf(file).blocks ?? []).some((entry) => entry.type === '@theme');
  assert.ok(accepts('sections/section.liquid'), 'section no longer accepts @theme; the probe is broken');
  assert.ok(accepts('blocks/group.liquid'), 'group no longer accepts @theme; the probe is broken');

  const accordion = schemaOf('blocks/accordion.liquid');
  assert.ok(existsSync(join(root, 'blocks/accordion.liquid')), 'accordion is gone');
  assert.ok((accordion.presets ?? []).length > 0, 'accordion has no preset, so it is not offered in Add block');
  assert.ok(
    (accordion.blocks ?? []).some((entry) => entry.type === '_accordion-row'),
    'accordion no longer takes _accordion-row children'
  );
  const button = schemaOf('blocks/button.liquid').settings.map((setting) => setting.id);
  assert.ok(button.includes('link') && button.includes('label'), 'button lost its link or label; the CTA has no target after all');

  const row = doc.split('\n').find((line) => line.startsWith('| `ona-training` (wholesale) |'));
  assert.ok(row, 'the ona-training gap row is gone');
  assert.ok(
    !/A `media-with-content` text slot drops both/.test(row),
    'the ona-training row still measures the section against media-with-content, not the component it is mapped to'
  );
  assert.match(row, /`[^`]*accordion[^`]*`/, 'the row does not name the accordion the composition actually offers');
  assert.match(row, /`[^`]*button[^`]*`/, 'the row does not name the button the CTA maps to');
  /* Naming the blocks is not the same as saying they work: "accordion and button cannot hold
     this" satisfies the two matches above and means the opposite. */
  assert.match(
    row,
    /component 1 holds both|a build, not a design problem/,
    'the row names the blocks but no longer says the composition holds the interaction'
  );
});

/*
 * The gap row and the tables are read by different people for different reasons, so marking the
 * decorative layer solved in one place while three others still said "blocked" left the kit
 * telling an engineer to defer exactly the sections the new block releases. The row was right
 * and the tables were stale, and nothing connected them. Codex, #293.
 *
 * This matches any claim that the decorative layer currently blocks something, and requires
 * ona-content -- the one section the shape cannot reach -- to be named alongside it. Claims in
 * the past tense ("the layer that blocked them is solved", "was the 11th of the blocked set")
 * are not current claims and do not match; re-adding a present-tense one does.
 */
test('no table still says the decorative layer blocks a section the shape reaches', () => {
  const BLOB = String.raw`blob|animated-svg|decorative[- ]layer`;
  /* "blocked ON the blob" is the claim that went stale. "blocked FOR a second reason, not the
     blob" is a different and still-true claim about ona-training-form, and proximity alone
     cannot tell them apart -- the preposition can. */
  const CLAIM = new RegExp(String.raw`blocked\**[\s,]*(?:on|by)\b[^.]{0,80}?(?:${BLOB})`, 'gi');

  for (const match of doc.matchAll(CLAIM)) {
    const window = doc.slice(Math.max(0, match.index - 250), match.index + match[0].length + 250);
    assert.match(
      window,
      /ona-content/,
      `"${match[0].trim()}" claims the decorative layer still blocks something, without naming ` +
        'ona-content -- the only section it does block. Reconcile it with the gap row.'
    );
  }
});

/*
 * The released sections convert to component 1, not to media-with-content: the shape is a
 * setting on the public `image` block, and media-with-content's media slot is the private
 * `_media-without-appearance`, which has none. A table sending them to component 2 would send
 * an engineer to a target that drops the decoration again.
 */
test('the kit does not route a decorated section to media-with-content', () => {
  const row = doc.split('\n').find((line) => /^\| 2 \|/.test(line));
  assert.ok(row, 'no row 2 in the component table');
  assert.ok(
    !/\*\*all 11 blocked\*\*/.test(row),
    'row 2 still calls the 11 decorated sections blocked on the decorative layer'
  );
  assert.match(
    row,
    /component 1/i,
    'row 2 should hand the decorated sections to component 1, which carries the shape'
  );
});

/*
 * A doc that says one of its own tables is wrong is a doc with a bug in it, and the warning
 * outlives the fix: row 2 was rewritten in this same PR while the gap row still told readers to
 * disregard it (Codex, #293, twice in a row). The fix for "table X is stale" is to update table
 * X, never to annotate it from somewhere else -- so the annotation itself is the failure.
 */
test('the kit does not tell its readers that part of the kit is wrong', () => {
  const SELF_CONTRADICTION = [
    /\b(?:row|table|step|section) \d+[^.]{0,60}\bis wrong\b/i,
    /\buntil it is rewritten\b/i,
    /\bdisregard the (?:row|table|step)\b/i,
  ];
  for (const pattern of SELF_CONTRADICTION) {
    const hit = doc.match(pattern);
    assert.equal(
      hit,
      null,
      `the kit contains "${hit?.[0]}" -- update the part it points at instead of warning about it`
    );
  }
});
