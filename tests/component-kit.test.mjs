import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
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

test('stage 2 points at the kit', () => {
  const structure = readFileSync(join(root, 'docs/page-design-structure.md'), 'utf8');
  const stage2 = structure.slice(
    structure.indexOf('### Stage 2'),
    structure.indexOf('### Stage 3')
  );
  assert.match(stage2, /\(component-kit\.md\)/, 'stage 2 should link to the component kit');
});
