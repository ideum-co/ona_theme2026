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

const flipping = sections
  .map((section) => ({
    ...section,
    flipClass: rootClassesOf(section.markup).find((className) => FLIP_CLASSES.includes(className)),
  }))
  .filter((section) => section.flipClass);

const VOID = new Set(['img', 'br', 'input', 'source', 'hr', 'meta', 'link', 'path', 'use']);

/*
 * The grid container and its DIRECT children.
 *
 * `order` applies to the grid item. The first version of this test read the first
 * `<div class="img...">> in document order and was satisfied -- but ona-supported wraps that div
 * in a custom element, so the grid item is the wrapper and the `.img` is a grandchild `order`
 * cannot reach. The section carried `img-right`, stayed image-left, and the test said it was
 * fine (Codex, #297). Document order cannot see a wrapper; a depth walk can.
 */
const grid = (markup) => {
  const clean = markup.replace(/\{%[\s\S]*?%\}/g, '').replace(/\{\{[\s\S]*?\}\}/g, '');
  const tags = [...clean.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g)];

  let depth = null;
  let container = null;
  const children = [];
  for (const [, closing, tag, attrs, selfClosing] of tags) {
    const classes = (attrs.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean);

    if (depth === null) {
      if (!closing && classes.includes('content')) {
        depth = 0;
        container = classes;
      }
      continue;
    }
    if (closing) {
      depth -= 1;
      if (depth < 0) break;
      continue;
    }
    if (depth === 0) children.push({ tag, classes });
    if (!VOID.has(tag.toLowerCase()) && !selfClosing) depth += 1;
  }

  /* Two markup shapes exist: `.container > .content`, and a single `.content.container`. They
     need different selectors, and the rule carries a branch for each. */
  return { children, shape: container?.includes('container') ? 'combined' : 'nested' };
};

/*
 * The rule, parsed into one entry per comma-separated branch.
 *
 * Checking that a class merely occurs *somewhere* in the stylesheet is not enough: every
 * flipping section today uses the `.container > .content` branch, so dropping `.img-right` from
 * that branch while leaving it on the unused `.content.container` branch would stop all four
 * wholesale sections flipping with every test still green (Codex, #297). Each class has to be
 * checked against the branch that matches its own markup.
 */
const branches = (() => {
  const rule = css.match(/([^{}]*?:is\([^)]*\)[^{}]*?)\{\s*order\s*:\s*(-?\d+)\s*;?\s*\}/);
  assert.ok(rule, 'cannot find the flip rule in the stylesheet');
  const order = Number(rule[2]);

  /* Split on top-level commas only: `:is(.invert-columns,.img-r,.img-right)` carries its own. */
  const topLevel = [];
  let depth = 0;
  let current = '';
  for (const character of rule[1]) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      topLevel.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  topLevel.push(current);

  return topLevel
    .map((selector) => selector.trim())
    .filter(Boolean)
    .map((selector) => {
      const classes = (selector.match(/:is\(([^)]*)\)/)?.[1] ?? '')
        .split(',')
        .map((name) => name.trim().replace(/^\./, ''))
        .filter(Boolean);
      const shape = />\s*\.content\.container\s*>/.test(selector)
        ? 'combined'
        : />\s*\.container\s*>\s*\.content\s*>/.test(selector)
          ? 'nested'
          : null;
      const target = selector.split('>').pop().trim();
      return { selector, classes, shape, target, order };
    });
})();

test('every flipping section is covered by the branch that matches its own markup', () => {
  assert.ok(flipping.length > 0, 'no section carries a flip class -- has the markup changed?');

  for (const { name, markup, flipClass } of flipping) {
    const { shape } = grid(markup);
    const covering = branches.filter(
      (branch) => branch.classes.includes(flipClass) && branch.shape === shape
    );
    assert.ok(
      covering.length > 0,
      `${name} carries .${flipClass} and its grid is the "${shape}" shape, but no branch of the ` +
        `flip rule matches both. Branches: ${branches
          .map((branch) => `${branch.shape}[${branch.classes.join('|')}]`)
          .join(', ')}`
    );
  }
});

test('the branch that covers a section moves one of that section\'s real grid items', () => {
  for (const { name, markup, flipClass } of flipping) {
    const { children, shape } = grid(markup);
    assert.equal(
      children.length,
      2,
      `${name}: the grid has ${children.length} direct children [${children
        .map((child) => child.tag)
        .join(', ')}], so a single order declaration does not simply swap two columns`
    );

    const branch = branches.find((entry) => entry.classes.includes(flipClass) && entry.shape === shape);
    if (!branch) continue; // the test above owns that failure

    const matches = ({ tag, classes }) =>
      branch.target.startsWith('.')
        ? classes.includes(branch.target.slice(1))
        : tag.toLowerCase() === branch.target;

    const moved = children.findIndex(matches);
    assert.notEqual(
      moved,
      -1,
      `${name}: none of the grid items [${children
        .map((child) => `${child.tag}.${child.classes.join('.')}`)
        .join(', ')}] match "${branch.target}" -- the flip is a no-op here. A descendant match ` +
        'would not help: order applies to the grid item.'
    );

    /* Source order is media, then text. Moving the text to the front (order < 0) or the media
       to the back (order > 0) both yield media-right; doing neither yields nothing. */
    const movedIsText = children[moved].classes.includes('text');
    assert.ok(
      movedIsText ? branch.order < 0 : branch.order > 0,
      `${name}: the rule gives order:${branch.order} to the ${movedIsText ? 'text' : 'media'} ` +
        'column, which leaves it where it already was'
    );
  }
});

/*
 * The grid collapses to one column at 749px. If the flip applied there too, the image would be
 * pushed *below* the text on every phone -- a regression on the layout it is meant to improve,
 * and one that no desktop check would show.
 */
test('the flip is desktop-only, above the single-column breakpoint', () => {
  const blocks = [...css.matchAll(/@media\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\}/g)];
  const flipBlock = blocks.find(([, , body]) => /order\s*:\s*-?\d+/.test(body));
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
