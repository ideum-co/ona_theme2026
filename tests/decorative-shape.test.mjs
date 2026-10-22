import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const schemaOf = (file) => JSON.parse(read(file).match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/)[1]);

/*
 * The decorative blob is what blocks the biggest conversion on the board. Fifteen legacy
 * sections draw an `svg.animated-svg` behind their photo -- including all ten members of the
 * theme's largest duplication group, six of them on /pages/wholesale -- and every Horizon
 * target drops it. Stage 2 requires the swap to be invisible, so until an image can carry the
 * shape, none of those fifteen can move.
 *
 * `snippets/decorative-shape.liquid` carries it. The shapes in it are not a redraw: each one
 * is lifted from the section that draws it today, and these tests are what make that claim
 * checkable rather than a sentence in a commit message.
 *
 * Despite the class name, nothing animates. `.start`, `.medium` and `.end` have no rule in any
 * stylesheet and no script binds them, so the three paths paint in one colour and the page
 * shows their union -- which is why reproducing the union is reproducing the element.
 */

/* Which legacy section each shape was taken from. This map is the test: it is what lets the
   snippet be compared against something rather than against itself. */
const SOURCES = {
  sourcing: 'sections/ona-wholesale-sourcing-v2.liquid',
  about: 'sections/ona-content.liquid',
  awards: 'sections/ona-awards.liquid',
  careers: 'sections/ona-careers.liquid',
  training: 'sections/ona-training-image-text.liquid',
  enquiry: 'sections/ona-training-form.liquid',
};

const snippet = read('snippets/decorative-shape.liquid');

/* The paths for one shape: everything between its `{% if %}`/`{% elsif %}` and the next one. */
const branchOf = (shape) => {
  const start = snippet.search(new RegExp(`\\{%-?\\s*(?:els)?if\\s+shape == '${shape}'`));
  assert.ok(start >= 0, `snippets/decorative-shape.liquid has no branch for ${shape}`);
  const rest = snippet.slice(start + 1);
  const next = rest.search(/\{%-?\s*(?:elsif|endif)\b/);
  return rest.slice(0, next < 0 ? undefined : next);
};

const pathsIn = (text) => [...text.matchAll(/<path[^>]*?\sd="([^"]+)"/g)].map((match) => match[1]);

const legacy = (file) => {
  const svg = read(file).match(/<svg[^>]*animated-svg[\s\S]*?<\/svg>/)[0];
  const fills = new Set([...svg.matchAll(/<path[^>]*?\sfill="([^"]+)"/g)].map((match) => match[1]));
  assert.equal(fills.size, 1, `${file} draws its shape in ${fills.size} colours; this probe assumes one`);
  return {
    viewBox: svg.match(/viewBox="([^"]+)"/)[1],
    paths: pathsIn(svg),
    fill: [...fills][0],
  };
};

test('every shape is the one the legacy section draws, path for path', () => {
  const cases = [...snippet.matchAll(/when '([^']+)'[\s\S]*?assign view_box = '([^']+)'[\s\S]*?assign shape_fill = '([^']+)'/g)];
  assert.deepEqual(
    cases.map((match) => match[1]).sort(),
    Object.keys(SOURCES).sort(),
    'the snippet and this test disagree about which shapes exist'
  );

  for (const [, shape, viewBox, fill] of cases) {
    const source = legacy(SOURCES[shape]);
    assert.equal(viewBox, source.viewBox, `${shape}: viewBox drifted from ${SOURCES[shape]}`);
    assert.equal(fill, source.fill, `${shape}: fill drifted from ${SOURCES[shape]}`);
    /* In order, because these are stacked layers: reordering them is a different picture. */
    assert.deepEqual(pathsIn(branchOf(shape)), source.paths, `${shape}: path data drifted from ${SOURCES[shape]}`);
  }

  /* The claim the whole snippet rests on. If a rule ever lands on these classes the paths stop
     being three copies of one colour, and lifting their union stops reproducing the section. */
  const styled = readdirSync(join(root, 'assets'))
    .filter((name) => name.endsWith('.css'))
    .filter((name) => /\.(?:start|medium|end)(?:-2)?\s*[,{]/.test(read(join('assets', name))));
  assert.deepEqual(styled, [], 'something now styles the blob paths, so they no longer paint as one shape');
});

test('the shape is decoration, and says so', () => {
  assert.match(snippet, /aria-hidden="true"/, 'the decorative shape is not hidden from assistive technology');
  assert.match(snippet, /focusable="false"/, 'the decorative shape is focusable, so it lands in the tab order in some browsers');

  /* An unrecognised shape must render nothing at all -- not an empty `<svg>`, which would
     still occupy the stacking context and the accessibility tree. */
  assert.match(
    snippet,
    /assign view_box = blank[\s\S]*?endcase[\s\S]*?\{%-?\s*if view_box != blank\s*-?%\}/,
    'the snippet emits its <svg> without first checking that the shape is one it knows'
  );
});

test('an image can carry a shape, and an undecorated one is untouched', () => {
  const block = read('blocks/image.liquid');
  const settings = schemaOf('blocks/image.liquid').settings;

  const select = settings.find((entry) => entry.id === 'decorative_shape');
  assert.ok(select, 'blocks/image.liquid has no decorative_shape setting');
  assert.equal(select.default, 'none', 'the shape setting does not default to none; every image in the theme would grow a blob');
  assert.deepEqual(
    select.options.map((option) => option.value),
    ['none', ...Object.keys(SOURCES)],
    'the options offered to a merchant are not the shapes the snippet can render'
  );

  const color = settings.find((entry) => entry.id === 'decorative_shape_color');
  assert.ok(color, 'the shape colour setting is gone');
  assert.ok(!Object.hasOwn(color, 'default'), 'the colour setting declares a default, which would override every shape own colour');
  assert.match(color.visible_if ?? '', /decorative_shape != 'none'/, 'the colour setting shows even when no shape is set');

  /* The block renders the image twice -- linked and unlinked -- and shipping the decoration
     into only one of them is the easy mistake. */
  const renders = block.match(/\{\{ decoration \}\}/g) ?? [];
  assert.equal(renders.length, 2, `the decoration is rendered ${renders.length} times; the block has a linked and an unlinked branch`);

  /* Positioning is gated on the modifier, so an image with no shape keeps the box it had. */
  assert.match(
    block,
    /\.image-block--decorated\s*\{[^}]*position:\s*relative/,
    'the containing block is not gated on the decorated modifier, so every image in the theme changes its positioning'
  );
  assert.match(
    block,
    /\.image-block \.decorative-shape\s*\{[^}]*z-index:\s*-1/,
    'the shape is not painted behind the image'
  );
  assert.match(block, /image-block--decorated/g, 'the modifier class is never emitted');
  assert.equal(
    (block.match(/image-block--decorated/g) ?? []).length,
    3,
    'the decorated modifier is not emitted on both branches and used once in CSS'
  );
});
