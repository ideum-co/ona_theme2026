import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Comments mention class names in prose; a rule has to actually select one. */
const css = readFileSync(join(root, 'assets/legacy-page-layout.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  ' '
);

/*
 * The label a legacy section puts directly above its heading -- the eyebrow.
 *
 * Eleven sections open with `<span class="subtitle">`. The class came over with the markup
 * during the migration; its rules did not, and nothing in the theme styled it, so on
 * /pages/wholesale seven eyebrows rendered as inline body copy butted against the `<h2>`
 * they introduce. Nothing failed -- a class with no rules is invisible to every other check
 * in this suite, which is why it survived.
 *
 * The set is derived from the markup rather than listed, so a section that arrives with a
 * differently named eyebrow is held to the same bar on the day it lands.
 */
const labels = (() => {
  const found = new Map();
  const files = readdirSync(join(root, 'sections')).filter(
    (file) => file.startsWith('ona-') && file.endsWith('.liquid')
  );

  for (const file of files) {
    const markup = readFileSync(join(root, 'sections', file), 'utf8')
      .split(/\{%-?\s*schema\s*-?%\}/)[0]
      .replace(/\{%-?[\s\S]*?-?%\}/g, ' ')
      .replace(/\{\{[\s\S]*?\}\}/g, ' ');

    /* A one-element run of text, then a heading: the shape of an eyebrow. */
    const pattern = /<(span|p|div)\b[^>]*class="([^"]*)"[^>]*>[^<]*<\/\1>\s*<h[1-6]\b/g;
    for (const [, , classes] of markup.matchAll(pattern)) {
      for (const name of classes.split(/\s+/).filter(Boolean)) {
        if (!found.has(name)) found.set(name, new Set());
        found.get(name).add(file.slice(0, -'.liquid'.length));
      }
    }
  }
  return found;
})();

const selects = (name, suffix = '') =>
  new RegExp(`\\.${name.replace(/-/g, '\\-')}(?![\\w-])[^{,]*${suffix}[^{]*\\{`).test(css);

test('the eyebrow above a heading is a class the stylesheet actually styles', () => {
  assert.ok(labels.size > 0, 'no section puts a labelled element above a heading any more');

  for (const [name, sections] of labels) {
    assert.ok(
      selects(name),
      `.${name} introduces the heading in ${sections.size} section(s) ` +
        `(${[...sections].sort().slice(0, 3).join(', ')}...) and no rule in ` +
        'assets/legacy-page-layout.css selects it, so it renders as plain body copy'
    );
  }
});

test('an eyebrow with nothing in it takes up no room', () => {
  for (const [name, sections] of labels) {
    /* The element ships whether or not its setting has a value -- four of the seven on
       /pages/wholesale render empty -- and an empty inline box still occupies a line box. */
    assert.ok(
      selects(name, ':empty'),
      `.${name} is rendered unconditionally by ${[...sections].sort()[0]}, so it can be empty, ` +
        'but no rule hides it when it is'
    );
  }
});

test('the eyebrow sits on its own line above the heading', () => {
  const rule = css.match(/#MainContent\s+\.subtitle\s*\{([^}]*)\}/);
  assert.ok(rule, 'cannot find the .subtitle rule');
  assert.match(
    rule[1],
    /display\s*:\s*block/,
    'a span is inline by default, so without an explicit display the eyebrow runs into the ' +
      'heading on the same line'
  );
});
