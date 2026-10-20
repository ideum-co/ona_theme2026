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

const backticked = (text) => [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
const resolve = (name) =>
  ['sections', 'blocks'].map((dir) => join(root, dir, `${name}.liquid`)).find(existsSync);

test('the kit names eight components', () => {
  assert.equal(kitRows.length, 8);
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
  const stripBanner = (text) => text.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
  const referenced = new Set();

  const templates = join(root, 'templates');
  for (const file of readdirSync(templates)) {
    if (!file.endsWith('.json')) continue;
    const parsed = JSON.parse(stripBanner(readFileSync(join(templates, file), 'utf8')));
    for (const section of Object.values(parsed.sections ?? {})) {
      if (section.type?.startsWith('ona-')) referenced.add(section.type);
    }
  }

  const onDisk = new Set(
    readdirSync(join(root, 'sections'))
      .filter((file) => file.startsWith('ona-') && file.endsWith('.liquid'))
      .map((file) => file.slice(0, -'.liquid'.length))
  );

  const orphaned = [...referenced].filter((type) => !onDisk.has(type)).sort();
  assert.deepEqual(orphaned, [], 'a template references an ona-* section that does not exist');

  const unused = [...onDisk].filter((type) => !referenced.has(type)).sort();
  assert.deepEqual(unused, [], 'an ona-* section has no remaining use and should go in the PR that removed it');
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

test('stage 2 points at the kit', () => {
  const structure = readFileSync(join(root, 'docs/page-design-structure.md'), 'utf8');
  const stage2 = structure.slice(
    structure.indexOf('### Stage 2'),
    structure.indexOf('### Stage 3')
  );
  assert.match(stage2, /\(component-kit\.md\)/, 'stage 2 should link to the component kit');
});
