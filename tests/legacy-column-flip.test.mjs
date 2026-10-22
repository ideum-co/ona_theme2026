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
 * `order` applies to the grid ITEM. The first version of this test read the section markup for
 * the first `<div class="img...">` in document order and was satisfied -- but in ona-supported
 * that div sits inside `<ona-slider>`, so the grid item is the slider and `order` on the `.img`
 * would move nothing. The section carried `img-right` and stayed image-left, and this test said
 * it was fine (Codex, #297).
 *
 * So the check is structural now: parse the direct children of the grid container out of the
 * markup, and require the first one to match a selector the rule actually targets -- read from
 * the stylesheet rather than restated here, so widening or narrowing the rule is reflected.
 */
const VOID = new Set(['img', 'br', 'input', 'source', 'hr', 'meta', 'link', 'path', 'use']);

/* Direct children of the first element whose class list contains `content`. */
const gridChildren = (markup) => {
  const clean = markup.replace(/\{%[\s\S]*?%\}/g, '').replace(/\{\{[\s\S]*?\}\}/g, '');
  const tags = [...clean.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g)];

  let depth = null;
  const children = [];
  for (const [, closing, tag, attrs, selfClosing] of tags) {
    const classes = (attrs.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean);

    if (depth === null) {
      if (!closing && classes.includes('content')) depth = 0;
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
  return children;
};

/* What the rule moves, and which way, read out of the rule itself. */
const flipRule = (() => {
  const match = css.match(/>\s*\.content(?:\.container)?\s*>\s*([^\s{]+)\s*\{[^}]*order\s*:\s*(-?\d+)/);
  assert.ok(match, 'cannot read the flip rule out of the stylesheet');
  return { target: match[1], order: Number(match[2]) };
})();

test('the rule moves a real grid item, and moves it the right way', () => {
  const matches = ({ tag, classes }) =>
    flipRule.target.startsWith('.')
      ? classes.includes(flipRule.target.slice(1))
      : tag.toLowerCase() === flipRule.target;

  for (const { name, markup } of flipping) {
    const children = gridChildren(markup);
    assert.equal(
      children.length,
      2,
      `${name}: the grid has ${children.length} direct children [${children
        .map((child) => child.tag)
        .join(', ')}], so a single order declaration does not simply swap two columns`
    );

    const moved = children.findIndex(matches);
    assert.notEqual(
      moved,
      -1,
      `${name}: nothing among the grid items [${children
        .map((child) => `${child.tag}.${child.classes.join('.')}`)
        .join(', ')}] matches "${flipRule.target}" -- the flip is a no-op here. ` +
        'A descendant match would not help: order applies to the grid item.'
    );

    /* Source order is media, then text. Moving the text to the front (order < 0) or the media
       to the back (order > 0) both yield media-right; doing neither yields nothing. */
    const movedIsText = children[moved].classes.includes('text');
    assert.ok(
      movedIsText ? flipRule.order < 0 : flipRule.order > 0,
      `${name}: the rule gives order:${flipRule.order} to the ` +
        `${movedIsText ? 'text' : 'media'} column, which leaves it where it already was`
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
