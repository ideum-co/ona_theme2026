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
    /* Liquid tags become a space, but an output becomes a character: the two are the
       difference between a slot that holds a label and a div that is empty by construction.
       ona-gust-r's pop-up form carries `<div class="title"></div>`, never populated and
       deliberately hidden since #249; stripping outputs too made it indistinguishable from
       `<span class="subtitle">{{ ... }}</span>` and put a permanently invisible element under
       the same typography and contrast bar as a label a shopper reads. */
    const markup = readFileSync(join(root, 'sections', file), 'utf8')
      .split(/\{%-?\s*schema\s*-?%\}/)[0]
      .replace(/\{%-?[\s\S]*?-?%\}/g, ' ')
      .replace(/\{\{[\s\S]*?\}\}/g, 'x');

    /* A one-element run of text, then a heading: the shape of an eyebrow. */
    const pattern = /<(span|p|div)\b[^>]*class="([^"]*)"[^>]*>([^<]*)<\/\1>\s*<h[1-6]\b/g;
    for (const [, , classes, content] of markup.matchAll(pattern)) {
      if (content.trim() === '') continue;
      for (const name of classes.split(/\s+/).filter(Boolean)) {
        if (!found.has(name)) found.set(name, new Set());
        found.get(name).add(file.slice(0, -'.liquid'.length));
      }
    }
  }
  return found;
})();

const selects = (name, suffix = '') => declarationsFor(name, suffix) !== null;

/*
 * Every rule that paints a non-empty eyebrow, in source order.
 *
 * The layout and contrast checks used to read the single base `.subtitle` rule and nothing
 * else, so appending a later, more specific `#MainContent .add-image-and-text-slider
 * .subtitle { opacity: 0.6; }` muted those eyebrows below the bar with all four tests green
 * (Codex, #300). What a reader sees is the cascade, so the cascade is what gets measured.
 */
const rulesFor = (name) => {
  const pattern = new RegExp(`([^{}]*\\.${name.replace(/-/g, '\\-')}(?![\\w-])[^{}]*)\\{([^}]*)\\}`, 'g');
  return [...css.matchAll(pattern)]
    .filter(([, selector]) => !/:empty/.test(selector))
    .map(([, selector, declarations]) => ({ selector: selector.trim().replace(/\s+/g, ' '), declarations }));
};

/* The body of the first rule whose selector matches, or null. */
function declarationsFor(name, suffix = '') {
  const found = css.match(
    new RegExp(`\\.${name.replace(/-/g, '\\-')}(?![\\w-])[^{,]*${suffix}[^{]*\\{([^}]*)\\}`)
  );
  return found ? found[1] : null;
}

test('the eyebrow above a heading is a class the stylesheet actually styles', () => {
  assert.ok(labels.size > 0, 'no section puts a labelled element above a heading any more');

  for (const [name, sections] of labels) {
    /* Not `selects(name)`: that counts `.name:empty { display: none; }` as styling, so a new
       eyebrow class carrying only the hide rule passed while the label a shopper actually
       reads got nothing (Codex, #300). Only rules that paint the non-empty element count. */
    assert.ok(
      rulesFor(name).length > 0,
      `.${name} introduces the heading in ${sections.size} section(s) ` +
        `(${[...sections].sort().slice(0, 3).join(', ')}...) and no rule in ` +
        'assets/legacy-page-layout.css selects it, so it renders as plain body copy'
    );
  }
});

/* `display:none` removes the box; so does a `content-visibility`-less zero-everything, but
   nothing here does that, so the rule is the plain one. */
const REMOVES_BOX = /display\s*:\s*none/;

test('an eyebrow with nothing in it takes up no room', () => {
  for (const [name, sections] of labels) {
    /* The element ships whether or not its setting has a value -- four of the seven on
       /pages/wholesale render empty -- and an empty inline box still occupies a line box. */
    const rule = declarationsFor(name, ':empty');
    assert.ok(
      rule !== null,
      `.${name} is rendered unconditionally by ${[...sections].sort()[0]}, so it can be empty, ` +
        'but no rule hides it when it is'
    );
    /* Asking only whether a matching selector exists lets `.subtitle:empty { display: block }`
       through with every test green and the empty eyebrows still holding a line (Codex, #300).
       The declaration is what removes the box, so the declaration is what gets checked. */
    assert.match(
      rule,
      REMOVES_BOX,
      `.${name}:empty is styled but not hidden -- its rule is "{${rule.trim()}}", which still ` +
        'leaves an empty eyebrow occupying a line'
    );
  }
});

test('the eyebrow sits on its own line above the heading', () => {
  for (const [name] of labels) {
    const applicable = rulesFor(name);
    assert.ok(
      applicable.some(({ declarations }) => /display\s*:\s*block/.test(declarations)),
      `a span is inline by default, so without an explicit display .${name} runs into the ` +
        `heading on the same line -- its rules are ${JSON.stringify(applicable.map((r) => r.selector))}`
    );
  }
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

/*
 * What the eyebrow is actually painted in.
 *
 * The first version of this test rejected three substrings in the rule's `color` and then
 * computed the ratio of whichever palette extreme *would* have worked -- so `opacity: 0.6`,
 * `rgb(var(--color-foreground-rgb) / 0.6)` or a low-contrast literal all passed while the
 * rendered label failed (Codex, #300). Resolve the declaration, then measure that.
 */
const opacityToken = (name) => {
  const tokens = readFileSync(join(root, 'snippets/theme-styles-variables.liquid'), 'utf8');
  const found = tokens.match(new RegExp(`--opacity-${name}-text:\\s*([0-9.]+)`));
  assert.ok(found, `cannot read --opacity-${name}-text`);
  return Number(found[1]);
};

/* The later declaration wins, so the resolver reads the last one rather than the first --
   otherwise a base `color` would mask the override that actually paints the label. */
const lastValue = (declarations, property) => {
  const all = [...declarations.matchAll(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'g'))];
  return all.length ? all[all.length - 1][1].trim() : null;
};

const painted = (declarations) => {
  /* An element's own opacity multiplies whatever colour it ends up with. A value this cannot
     read -- `opacity: var(--opacity-muted-text)` -- used to fall through to alpha 1 and report
     the label as fully opaque, so an opacity present and unresolved now fails (Codex, #300). */
  const faded = lastValue(declarations, 'opacity');
  let alpha = 1;
  if (faded) {
    const literal = faded.match(/^([0-9.]+)%?$/);
    assert.ok(
      literal,
      `cannot read the eyebrow's opacity from "${faded}" -- extend this resolver ` +
        'rather than treating the label as fully opaque'
    );
    alpha = faded.includes('%') ? Number(literal[1]) / 100 : Number(literal[1]);
  }

  const value = lastValue(declarations, 'color');
  if (value === null) return { alpha, literal: null, how: 'inherited' };

  const hex = value.match(/#([0-9a-f]{6})\b/i);
  if (hex) return { alpha, literal: [1, 3, 5].map((at) => parseInt(`#${hex[1]}`.slice(at, at + 2), 16)), how: value };

  /* Alpha after a slash inside a colour function. The first version matched only bare digits
     followed by `)`, so the perfectly valid `rgb(var(--color-foreground-rgb) / 60%)` fell
     through to the `inherits` check below, which accepted the foreground variable and left
     alpha at 1 (Codex, #300). Anything after the slash this cannot resolve now fails. */
  const slashed = value.match(/\/\s*([^)]+?)\s*\)/);
  if (slashed) {
    const part = slashed[1].trim();
    const literal = part.match(/^([0-9.]+)(%?)$/);
    if (literal) {
      alpha *= literal[2] ? Number(literal[1]) / 100 : Number(literal[1]);
    } else if (/--opacity-muted-text/.test(part)) {
      alpha *= opacityToken('muted');
    } else if (/--opacity-subdued-text/.test(part)) {
      alpha *= opacityToken('subdued');
    } else {
      assert.fail(
        `cannot read the eyebrow's alpha from "${part}" -- extend this resolver rather than ` +
          'treating the label as fully opaque'
      );
    }
  } else {
    if (/--opacity-muted-text/.test(value)) alpha *= opacityToken('muted');
    if (/--opacity-subdued-text/.test(value)) alpha *= opacityToken('subdued');
  }
  if (/--color-foreground-muted/.test(value)) alpha *= opacityToken('muted');
  if (/--color-foreground-subdued/.test(value)) alpha *= opacityToken('subdued');

  const inherits =
    /currentColor|inherit|--color-foreground(?![\w-])|--color-foreground-rgb|--color-foreground-muted|--color-foreground-subdued|--palette-(darkest|lightest)/.test(
      value
    );
  assert.ok(
    inherits,
    `cannot work out what colour the eyebrow is painted in from "${value}" -- extend this ` +
      'resolver rather than leaving the contrast unchecked'
  );
  return { alpha, literal: null, how: value };
};

test('the eyebrow clears 4.5:1 on every ground it is used on', () => {
  assert.ok(palette.foreground && palette.background, 'cannot read the palette');
  const where = grounds();

  for (const [name] of labels) {
    const applicable = rulesFor(name);
    assert.ok(applicable.length > 0, `no rule paints .${name}`);

    /* Walked in source order, carrying the declarations forward: the state after each rule is
       a state the label is really in, and every one of them has to clear the bar. Reading
       only the base rule let a later override through (Codex, #300). */
    let carried = '';
    for (const rule of applicable) {
      carried += `;${rule.declarations}`;
      const { alpha, literal, how } = painted(carried);

      for (const [ground_name, ground] of where) {
        const ink = rgb(ground);
        /* Inherited, the eyebrow takes the section's foreground, and the band snippet has
           already chosen the palette extreme that contrasts best with the band. */
        const inherited = [palette.foreground, palette.background]
          .map(rgb)
          .sort((a, b) => contrast(b, ink) - contrast(a, ink))[0];
        const ratio = contrast(over(literal ?? inherited, ink, alpha), ink);
        assert.ok(
          ratio >= 4.5,
          `${ground_name} is ${ground}, and .${name} as painted by "${rule.selector}" ` +
            `(${how}${alpha < 1 ? ` at ${alpha} opacity` : ''}) lands at ${ratio.toFixed(2)}:1 ` +
            'on it -- under 4.5:1'
        );
      }
    }
  }
});
