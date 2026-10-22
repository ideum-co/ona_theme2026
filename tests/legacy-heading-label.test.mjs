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

/*
 * The eyebrow is normal-size text, so it needs 4.5:1 against whatever it sits on.
 *
 * The first version of this rule reached for --color-foreground-muted, which looks like the
 * right token for a label and is not: it composites the foreground at --opacity-muted-text,
 * and at that opacity the eyebrow measured 4.42:1 on the page's cream and 4.21:1 on the sand
 * bands -- both under the bar, on text that is already small and widely tracked (Codex, #300).
 *
 * The ratio is computed here rather than asserted as a number, so this fails on a palette
 * change as well as on a rule change.
 */
const palette = (() => {
  const settings = JSON.parse(
    readFileSync(join(root, 'config/settings_data.json'), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\//, '')
  ).current;
  const colors = settings.color_palette?.[0]?.settings ?? settings.color_palette ?? {};
  return { background: colors.background, foreground: colors.foreground };
})();

const grounds = () => {
  const found = new Map([['the page background', palette.background]]);
  for (const file of readdirSync(join(root, 'templates'))) {
    if (!file.endsWith('.json')) continue;
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(join(root, 'templates', file), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\//, ''));
    } catch {
      continue;
    }
    for (const [key, section] of Object.entries(parsed.sections ?? {})) {
      const band = section.settings?.band_background;
      if (typeof band === 'string' && /^#[0-9a-f]{6}$/i.test(band)) found.set(`${file} ${key}`, band);
    }
  }
  return [...found];
};

const channel = (value) => {
  const unit = value / 255;
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
};
const rgb = (hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/* Opacity below 1 is the foreground composited over the ground, which is what a muted token is. */
const over = (fore, ground, alpha) => fore.map((value, at) => alpha * value + (1 - alpha) * ground[at]);

test('the eyebrow clears 4.5:1 on every ground it is used on', () => {
  const rule = css.match(/#MainContent\s+\.subtitle\s*\{([^}]*)\}/);
  assert.ok(rule, 'cannot find the .subtitle rule');

  const declared = rule[1].match(/(?:^|;)\s*color\s*:\s*([^;]+)/);
  assert.ok(
    !declared || !/muted|subdued|opacity/.test(declared[1]),
    `the eyebrow sets color: ${declared?.[1].trim()}. A token that reduces the foreground's ` +
      'opacity cannot clear 4.5:1 on this palette at this size'
  );

  assert.ok(palette.foreground && palette.background, 'cannot read the palette');
  for (const [where, ground] of grounds()) {
    /* Unbanded or light-banded, the eyebrow inherits the page foreground; on a dark band the
       band snippet flips it to the lightest palette colour. Either way it is a palette extreme
       at full opacity, so the darker of the two against this ground is the case to check. */
    const best = [palette.foreground, palette.background]
      .map((hex) => contrast(rgb(hex), rgb(ground)))
      .sort((a, b) => b - a)[0];
    assert.ok(
      best >= 4.5,
      `${where} is ${ground}, and the best the palette can do for text on it is ` +
        `${best.toFixed(2)}:1 -- under 4.5:1`
    );
  }
});
