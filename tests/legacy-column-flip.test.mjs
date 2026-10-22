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

/* The selectors the rule moves, taken from the rule itself. */
const flipTargets = (() => {
  const rule = css.match(/>\s*\.content[^>]*>\s*:is\(([^)]*)\)\s*\{[^}]*order\s*:\s*2/);
  assert.ok(rule, 'cannot read the flip rule targets out of the stylesheet');
  return rule[1].split(',').map((target) => target.trim());
})();

test('the rule moves the grid item that holds the media, not a descendant of it', () => {
  const matches = ({ tag, classes }) =>
    flipTargets.some((target) =>
      target.startsWith('.') ? classes.includes(target.slice(1)) : tag.toLowerCase() === target
    );

  for (const { name, markup } of flipping) {
    const children = gridChildren(markup);
    assert.equal(
      children.length,
      2,
      `${name}: the grid has ${children.length} direct children [${children
        .map((child) => child.tag)
        .join(', ')}], so order:2 does not simply swap two columns`
    );
    assert.ok(
      matches(children[0]),
      `${name}: the first grid item is <${children[0].tag} class="${children[0].classes.join(' ')}">, ` +
        `which none of the rule's targets (${flipTargets.join(', ')}) match -- the flip is a no-op here`
    );
    assert.ok(
      children[1].classes.includes('text'),
      `${name}: the second grid item is not .text, so there is nothing to flip against`
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
