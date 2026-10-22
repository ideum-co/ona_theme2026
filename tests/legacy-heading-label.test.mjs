import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/*
 * What this test does and does not do.
 *
 * It reads the one stylesheet that owns the eyebrow rules and checks that those rules exist
 * and declare what the design calls for. It does NOT resolve the cascade: it cannot tell you
 * that a rule in another sheet, a media query, a pseudo-class state or an inline style does
 * not override one of these declarations in the browser. A companion test that does resolve
 * the cascade -- and with it the contrast of the label against each band it sits on -- is on
 * its own branch, because it is a much larger piece of machinery than the rules it guards.
 *
 * So a change that edits these rules is caught here; a change that defeats them from
 * somewhere else is not, until the companion lands.
 */
const SHEET = 'assets/legacy-page-layout.css';
const css = readFileSync(join(root, SHEET), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/*
 * The eyebrow classes are read off the markup rather than named here, so a section that
 * introduces its heading with some other class is held to the same bar instead of quietly
 * escaping it.
 *
 * An element whose content is empty once Liquid outputs are accounted for is not an eyebrow:
 * ona-gust-r ships a permanently-empty `<div class="title"></div>` that existing CSS already
 * hides, and reading it as a label would put a bar on a class that never shows text.
 */
const labels = (() => {
  const found = new Set();
  for (const file of readdirSync(join(root, 'sections')).filter((name) => /^ona-.*\.liquid$/.test(name))) {
    const source = readFileSync(join(root, 'sections', file), 'utf8');
    for (const [, , classes, content] of source.matchAll(
      /<(span|p|div)\b[^>]*class="([^"]*)"[^>]*>([^<]*)<\/\1>\s*<h[1-6]\b/g
    )) {
      if (!content.replace(/\{\{[\s\S]*?\}\}/g, 'x').trim()) continue;
      for (const name of classes.split(/\s+/).filter(Boolean)) found.add(name);
    }
  }
  return [...found];
})();

/* Rules in this sheet whose selector targets the label itself -- the label compound last, so
   `.subtitle span` (which paints a child, not the label) does not count as styling it. */
const rulesFor = (name) => {
  const matched = [];
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const branches = selectors.split(',').map((branch) => branch.trim()).filter(Boolean);
    const targets = branches.some((branch) => {
      const last = branch.split(/[\s>+~]+/).filter(Boolean).pop() ?? '';
      return last.split(/(?=[.:#[])/).includes(`.${name}`);
    });
    if (targets) matched.push({ selectors: selectors.trim(), body, branches });
  }
  return matched;
};

const declares = (body, property) => {
  const match = [...body.matchAll(new RegExp(`(?:^|;)\\s*${property}\\s*:([^;]+)`, 'g'))].pop();
  return match ? match[1].trim() : null;
};

/* The empty-state rule hides the box; every other rule paints the label that is there. */
const isEmptyRule = (rule) =>
  rule.branches.every((branch) => /:empty\b/.test(branch.replace(/:not\([^)]*\)/g, '')));

test('the eyebrow above a heading is a class the stylesheet styles', () => {
  assert.ok(labels.length > 0, 'no section introduces a heading with a label, so the probe is broken');

  for (const name of labels) {
    const painting = rulesFor(name).filter((rule) => !isEmptyRule(rule));
    assert.ok(
      painting.length > 0,
      `.${name} introduces a heading but ${SHEET} never styles it, so it renders as body copy ` +
        'butted against the heading'
    );
  }
});

test('an eyebrow with nothing in it takes up no room', () => {
  for (const name of labels) {
    const hiding = rulesFor(name).filter(isEmptyRule);
    assert.ok(
      hiding.length > 0,
      `.${name} has no :empty rule -- a section ships the element whether or not the setting ` +
        'has a value, and an empty inline box still occupies a line box'
    );
    assert.ok(
      hiding.some((rule) => declares(rule.body, 'display') === 'none'),
      `.${name}:empty does not set display:none, so an empty label still pushes the heading down`
    );
  }
});

test('the eyebrow sits on its own line above the heading', () => {
  for (const name of labels) {
    const painting = rulesFor(name).filter((rule) => !isEmptyRule(rule));

    const display = painting.map((rule) => declares(rule.body, 'display')).filter(Boolean).pop();
    assert.equal(display, 'block', `.${name} is not a block, so it sits inline beside the heading`);

    /* Shorthand or longhand, the bottom of the box is what separates it from the heading:
       in `margin: 0 0 14px` that is the third value, in `margin: 0` it is the only one. */
    const gaps = painting
      .map((rule) => {
        const shorthand = declares(rule.body, 'margin');
        if (shorthand) {
          const parts = shorthand.split(/\s+/);
          return parts[2] ?? parts[0];
        }
        return declares(rule.body, 'margin-bottom');
      })
      .filter(Boolean);
    const gap = gaps.pop();
    assert.ok(gap, `.${name} has no bottom margin, so the label butts against the heading`);
    assert.ok(
      parseFloat(gap) > 0,
      `.${name} leaves a bottom margin of "${gap}", so the label butts against the heading`
    );
  }
});

/*
 * The label inherits its colour on purpose.
 *
 * --color-foreground-muted reads as the obvious choice for a de-emphasised label, but it
 * composites the foreground at --opacity-muted-text (0.6), which puts 14px text at 4.42:1 on
 * the page's cream and 4.21:1 on the sand bands -- under the 4.5:1 that normal-size text
 * needs. The case and the tracking carry the de-emphasis instead, and inheriting means the
 * label follows whatever band it sits on rather than being pinned to one ground.
 *
 * This holds the shape of that decision, not a measurement of it. Measuring what the label is
 * actually painted in, on each band, needs the cascade resolver on the companion branch.
 */
test('the eyebrow takes its colour from the band it sits on', () => {
  for (const name of labels) {
    for (const rule of rulesFor(name)) {
      const colour = declares(rule.body, 'color');
      assert.equal(
        colour,
        null,
        `.${name} pins its colour to "${colour}" in "${rule.selectors}" -- the label has to ` +
          'inherit, or it stops following the band it sits on'
      );
      assert.ok(
        !/!important/.test(rule.body),
        `.${name} uses !important in "${rule.selectors}", which takes the rule out of reach of ` +
          'the band and of anything else that would override it'
      );
    }
  }
});

/*
 * One H1 per page.
 *
 * /pages/wholesale had a visually-hidden H1 (`ona-sr-heading`) because no section on it
 * exposed a visible one. Giving it a real page header is only an improvement if the hidden
 * one goes at the same time -- two H1s is worse than a hidden one.
 *
 * Several templates legitimately have none here, because their heading comes from the page's
 * own rich-text content rather than from a section, so the bound is one-sided.
 */
test('no page template renders more than one H1', () => {
  const headings = new Set(
    ['sections', 'blocks', 'snippets'].flatMap((dir) =>
      readdirSync(join(root, dir))
        .filter((file) => file.endsWith('.liquid'))
        .filter((file) =>
          /<h1\b/.test(readFileSync(join(root, dir, file), 'utf8').split(/\{%-?\s*schema\s*-?%\}/)[0])
        )
        .map((file) => file.slice(0, -'.liquid'.length))
    )
  );
  assert.ok(headings.size > 0, 'nothing in the theme renders an H1, so the probe is broken');

  for (const file of readdirSync(join(root, 'templates'))) {
    if (!file.endsWith('.json')) continue;
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(join(root, 'templates', file), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\//, ''));
    } catch {
      continue; // a .liquid-backed template, or one this parse cannot reach
    }
    const sections = parsed.sections ?? {};
    const rendered = (parsed.order ?? Object.keys(sections)).filter(
      (key) => sections[key] && !sections[key].disabled && headings.has(sections[key].type)
    );
    assert.ok(
      rendered.length <= 1,
      `${file} renders ${rendered.length} H1s (${rendered.map((key) => sections[key].type).join(', ')})`
    );
  }
});
