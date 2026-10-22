import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'assets/legacy-page-layout.css'), 'utf8');

const FLIP_CLASSES = ['invert-columns', 'img-r', 'img-right'];

const sections = readdirSync(join(root, 'sections'))
  .filter((file) => file.startsWith('ona-') && file.endsWith('.liquid'))
  .map((file) => ({
    name: file.replace(/\.liquid$/, ''),
    markup: readFileSync(join(root, 'sections', file), 'utf8').split(/\{%-?\s*schema\s*-?%\}/)[0],
  }));

const rootClassesOf = (markup) => {
  const match = markup.match(/<(?:section|div)\b[^>]*class="([^"]+)"/);
  return match ? match[1].split(/\s+/).filter(Boolean) : [];
};

const flipping = sections.filter((section) =>
  rootClassesOf(section.markup).some((className) => FLIP_CLASSES.includes(className))
);

/*
 * These three classes sat on the markup with no rule behind them from the migration until this
 * change -- the same failure as `bg-red`, which still has none. A class the markup asks for and
 * the stylesheet never answers is invisible in review: the section looks fine, it is just not
 * the design. This fails if any of them loses its rule again.
 */
test('every flip class the markup carries has a rule behind it', () => {
  assert.ok(flipping.length > 0, 'no section carries a flip class -- has the markup changed?');
  for (const className of FLIP_CLASSES) {
    const used = flipping.some((section) => rootClassesOf(section.markup).includes(className));
    if (!used) continue;
    assert.match(
      css,
      new RegExp(`\\.${className}\\b`),
      `.${className} is on a section but nothing in the stylesheet answers it`
    );
  }
});

/*
 * `order: 2` moves whichever child it lands on. The rule targets `.img`, so a section that puts
 * its media in a differently-named child would flip nothing, or flip the text instead and leave
 * the image where it was. Measured off each flipping section rather than assumed.
 */
test('every flipping section puts its media in the child the rule moves', () => {
  for (const { name, markup } of flipping) {
    const columns = [...markup.matchAll(/<div class="((?:img|text)[^"]*)"/g)].map((match) =>
      match[1].split(/\s+/)[0]
    );
    assert.equal(
      columns[0],
      'img',
      `${name}: the first column is .${columns[0]}, so order:2 on .img does not flip it`
    );
    assert.ok(columns.includes('text'), `${name}: no .text column to flip against`);
  }
});

/*
 * The grid collapses to one column at 749px. If the flip applied there too, the image would be
 * pushed *below* the text on every phone -- a regression on the layout it is meant to improve,
 * and one that no desktop check would show.
 */
test('the flip is desktop-only, above the single-column breakpoint', () => {
  const blocks = [...css.matchAll(/@media\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\}/g)];
  const flipBlock = blocks.find(([, , body]) => /order\s*:\s*2/.test(body));
  assert.ok(flipBlock, 'the flip rule is not inside a media query, so it applies on mobile too');

  const width = flipBlock[1].match(/min-width\s*:\s*(\d+)px/);
  assert.ok(width, `the flip is gated on "${flipBlock[1]}", which is not a min-width`);

  const collapse = css.match(/@media\s*\(\s*max-width\s*:\s*(\d+)px\s*\)/);
  assert.ok(collapse, 'cannot find the breakpoint where the grid collapses to one column');
  assert.ok(
    Number(width[1]) > Number(collapse[1]),
    `the flip starts at ${width[1]}px but the grid is still single-column up to ${collapse[1]}px`
  );
});
