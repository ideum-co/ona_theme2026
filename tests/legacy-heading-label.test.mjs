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
 * Every rule in the stylesheet that targets this class, in cascade order.
 *
 * Three separate checks here each reached for the one rule they expected and measured that:
 * the contrast check read the base `.subtitle` rule, so a later
 * `#MainContent .add-image-and-text-slider .subtitle { opacity: 0.6; }` muted those eyebrows
 * with everything green; the empty-state check read the first matching rule, so a second
 * `.subtitle:empty { display: block; }` won in the browser and passed here; the layout check
 * asked whether any rule said `display: block`, so a later `display: inline` passed too
 * (Codex, #300). What the reader sees is the declaration that wins, so these all resolve the
 * cascade -- specificity first, then source order -- and read the winner.
 */
const specificity = (selector) => {
  const ids = (selector.match(/#[\w-]+/g) ?? []).length;
  const classes = (selector.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[a-z-]+(?:\([^)]*\))?/gi) ?? []).length;
  const elements = (
    selector.replace(/[#.][\w-]+|\[[^\]]*\]|::?[a-z-]+(?:\([^)]*\))?/gi, ' ').match(/[a-z][\w-]*/gi) ?? []
  ).length;
  return ids * 10000 + classes * 100 + elements;
};

/*
 * The stylesheet flattened into rules, carrying whatever at-rules each one sits inside.
 *
 * A flat `selector { ... }` regex cannot see into a nested block: it matched `@media(...)`
 * as the selector and swallowed the rules inside as declarations, so an eyebrow declaration
 * in a media query was invisible to every check here and
 * `@media(max-width:749px){ .subtitle{opacity:.6} }` muted the mobile eyebrow with the suite
 * green (Codex, #300). There are nine media blocks in this stylesheet.
 */
const flatten = (text) => {
  const out = [];
  let order = 0;

  const walk = (body, conditions) => {
    let at = 0;
    while (at < body.length) {
      const open = body.indexOf('{', at);
      if (open === -1) break;
      let depth = 1;
      let close = open + 1;
      for (; close < body.length && depth > 0; close += 1) {
        if (body[close] === '{') depth += 1;
        else if (body[close] === '}') depth -= 1;
      }
      const prelude = body.slice(at, open).trim();
      const inner = body.slice(open + 1, close - 1);

      if (prelude.startsWith('@')) {
        /* Conditional groups hold rules; @font-face and @keyframes hold declarations, and
           nothing in them can target a label. */
        if (/^@(media|supports|layer|container|scope)\b/i.test(prelude)) {
          walk(inner, [...conditions, prelude.replace(/\s+/g, ' ')]);
        }
      } else if (prelude) {
        order += 1;
        out.push({ conditions, selectorList: prelude, declarations: inner, at: order });
      }
      at = close;
    }
  };

  walk(text, []);
  return out;
};

const flat = flatten(css);

const rulesFor = (name) => {
  const escaped = name.replace(/-/g, '\\-');
  const target = new RegExp(`\\.${escaped}(?![\\w-])`);
  const found = [];
  for (const { conditions, selectorList, declarations, at } of flat) {
    for (const branch of splitSelectors(selectorList)) {
      if (!target.test(branch)) continue;
      /* `!important` reorders the cascade in a way none of this models, so it fails rather
         than being silently mis-resolved. Nothing in the stylesheet uses it today. */
      assert.ok(
        !/!important/.test(declarations),
        `.${name} is styled with !important ("${branch.trim()}"), which this cascade model ` +
          'does not resolve -- extend it rather than trusting the result'
      );

      /* The ancestors the rule asks for, and what it asks of the label itself. A rule applies
         wherever another one does when everything it asks for is also present there, which is
         what keeps two mutually exclusive sections from resolving as one element. */
      /* Descendant combinators only, and not the spaces inside `:is(a, b)`. */
      const compounds = (branch.trim().match(/(?:[^\s(]+(?:\([^)]*\))?)+/g) ?? []).filter(Boolean);
      const own = compounds.findIndex((compound) => target.test(compound));
      const label = compounds[own];
      /* `:not(:empty)` selects a label that HAS text. Reading it as an empty-state rule threw
         the declaration away, so `:not(:empty) { opacity: 0.6 }` muted every visible eyebrow
         with nothing failing (Codex, #300). The negation is stripped before the test. */
      const needsFilled = /:not\(\s*:empty\s*\)/.test(label);
      const needsEmpty = /:empty/.test(label.replace(/:not\([^)]*\)/g, ''));

      found.push({
        selector: branch.trim().replace(/\s+/g, ' '),
        declarations,
        ancestors: compounds.slice(0, own),
        conditions,
        needsEmpty,
        needsFilled,
        weight: specificity(branch),
        at,
      });
    }
  }
  return found.sort((a, b) => a.weight - b.weight || a.at - b.at);
};

/*
 * One resolution per markup context.
 *
 * Merging every rule that mentions the class treated mutually exclusive sections as one
 * element, so `.add-image-and-text-slider .subtitle { display: inline }` followed by
 * `.add-image-and-text .subtitle { display: block }` resolved to block and the slider's
 * eyebrows stayed inline with the suite green (Codex, #300). Each rule names a context; the
 * rules that apply there are the ones whose ancestors are all present in it.
 */
/*
 * Two media blocks can both match the same viewport and their declarations stack: 0.75
 * opacity under one and 0.75 alpha under another render at 0.5625. Building one context per
 * rule never measured a combination (Codex, #300), so the powerset of the constraints a
 * label carries is generated instead -- minus the combinations no viewport can satisfy,
 * since this stylesheet pairs `max-width:749px` with `min-width:750px`.
 */
/*
 * Split a selector list on its real commas.
 *
 * `split(',')` tore `:is(.add-image-and-text, .not-rendered)` in half and kept only the
 * branch that matches nothing, so an override written that way muted the partnership
 * eyebrow with all four tests green (Codex, #300). This stylesheet already uses `:is()`.
 */
const splitSelectors = (list) => {
  const out = [];
  let depth = 0;
  let current = '';
  for (const character of list) {
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      out.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  out.push(current);
  return out.filter((branch) => branch.trim() !== '');
};

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param',
  'source', 'track', 'wbr',
]);

/*
 * The ancestor classes a label really has, read off the section markup.
 *
 * The powerset unions ancestor constraints, and two alternative section roots are not one
 * element: `.add-image-and-text-slider .subtitle` and `.add-image-and-text .subtitle`
 * describe different sections, so an invented context carrying both was measured and failed
 * on a state no page renders (Codex, #300). A union counts only where some section renders
 * it. Everything legacy renders inside #MainContent, which is why each chain starts there.
 */
const ancestriesFor = (name) => {
  const found = [];
  for (const file of readdirSync(join(root, 'sections'))) {
    if (!file.startsWith('ona-') || !file.endsWith('.liquid')) continue;
    const markup = readFileSync(join(root, 'sections', file), 'utf8')
      .split(/\{%-?\s*schema\s*-?%\}/)[0]
      .replace(/\{%-?[\s\S]*?-?%\}/g, ' ')
      .replace(/\{\{[\s\S]*?\}\}/g, 'x');

    const open = [];
    for (const [tag, closing, element, attributes] of markup.matchAll(
      /<(\/?)([a-zA-Z][\w-]*)\b([^>]*)>/g
    ).map((match) => [match[0], match[1], match[2].toLowerCase(), match[3]])) {
      if (closing) {
        const at = open.map((entry) => entry.element).lastIndexOf(element);
        if (at !== -1) open.length = at;
        continue;
      }
      const classes = (attributes.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean);
      if (classes.includes(name)) {
        /* An inline `style` outranks every rule in the stylesheet, and reading only the
           classes off this element meant `style="display:inline;opacity:.6"` on the
           partnership eyebrow lost both its layout and its contrast with the suite green
           (Codex, #300). It is carried with the chain and applied last. */
        found.push({
          chain: new Set(['#MainContent', ...open.flatMap((entry) => entry.classes).map((c) => `.${c}`)]),
          inline: attributes.match(/style="([^"]*)"/)?.[1] ?? '',
          section: file.slice(0, -'.liquid'.length),
        });
      }
      if (!VOID_TAGS.has(element) && !/\/\s*$/.test(attributes)) open.push({ element, classes });
    }
  }
  return found;
};

/*
 * A compound selector is present in a chain when every part of it is -- except that `:is()`
 * and `:where()` are alternations, where one branch is enough, and `:not()` is the reverse.
 * Treating `:is(.add-image-and-text, .not-rendered)` as a list of required classes would
 * have missed the branch that really matches.
 */
const partsOf = (text) => text.match(/[#.][\w-]+/g) ?? [];

const presentIn = (compound, ancestry) => {
  const anyOf = [...compound.matchAll(/:(?:is|where)\(([^)]*)\)/gi)];
  const noneOf = [...compound.matchAll(/:not\(([^)]*)\)/gi)];
  const bare = compound.replace(/:(?:is|where|not)\([^)]*\)/gi, '');

  return (
    partsOf(bare).every((part) => ancestry.has(part)) &&
    anyOf.every((match) =>
      splitSelectors(match[1]).some((branch) => partsOf(branch).every((part) => ancestry.has(part)))
    ) &&
    noneOf.every((match) =>
      splitSelectors(match[1]).every((branch) => !partsOf(branch).every((part) => ancestry.has(part)))
    )
  );
};

const satisfiable = (conditions) => {
  let low = 0;
  let high = Infinity;
  for (const condition of conditions) {
    for (const [, feature, value] of condition.matchAll(/\((min|max)-width\s*:\s*(\d+)px\)/g)) {
      if (feature === 'min') low = Math.max(low, Number(value));
      else high = Math.min(high, Number(value));
    }
  }
  return low <= high;
};

const contextsFor = (name) => {
  const all = rulesFor(name);
  const ancestries = ancestriesFor(name);
  assert.ok(
    ancestries.length > 0,
    `cannot find .${name} in any section's markup, so there is no way to tell which ancestor ` +
      'combinations are real -- the contexts would be invented'
  );

  const constraints = [];
  const seen = new Set();
  for (const rule of all) {
    const key = JSON.stringify([rule.ancestors, rule.conditions]);
    if (seen.has(key)) continue;
    seen.add(key);
    constraints.push(rule);
  }
  /* The powerset is exponential, so an unexpectedly branchy stylesheet stops the test rather
     than quietly measuring a subset of the combinations. */
  assert.ok(
    constraints.length <= 12,
    `.${name} is styled under ${constraints.length} distinct contexts, too many to enumerate ` +
      'the combinations of -- narrow the model rather than leaving combinations unchecked'
  );

  const out = [];
  const built = new Set();
  for (let mask = 1; mask < 1 << constraints.length; mask += 1) {
    const chosen = constraints.filter((_, at) => mask & (1 << at));
    const ancestors = [...new Set(chosen.flatMap((rule) => rule.ancestors))];
    const conditions = [...new Set(chosen.flatMap((rule) => rule.conditions))];
    if (!satisfiable(conditions)) continue;

    const here = ancestries.filter((entry) =>
      ancestors.every((compound) => presentIn(compound, entry.chain))
    );

    /* A rule applies here when everything it asks for is present here -- its ancestors, and
       the at-rules it sits inside. An unconditional rule applies in every context; a media
       rule only in the contexts that carry that condition. */
    const applicable = all.filter(
      (rule) =>
        rule.ancestors.every((ancestor) => ancestors.includes(ancestor)) &&
        rule.conditions.every((condition) => conditions.includes(condition))
    );
    if (applicable.length === 0) continue;

    /* One entry per element the union describes, because the inline style belongs to the
       element rather than to the selector. */
    for (const entry of here) {
      const key = JSON.stringify([[...ancestors].sort(), [...conditions].sort(), entry.section]);
      if (built.has(key)) continue;
      built.add(key);

      out.push({
        where: [entry.section, ...conditions].join(' inside '),
        inline: entry.inline,
        filled: applicable.filter((rule) => !rule.needsEmpty),
        empty: applicable.filter((rule) => !rule.needsFilled),
      });
    }
  }
  return out;
};

/* Inline last: it outranks every rule, and the resolvers take the final declaration. */
const merge = (rules, inline = '') => [...rules.map((rule) => rule.declarations), inline].join(';');

test('the eyebrow above a heading is a class the stylesheet actually styles', () => {
  assert.ok(labels.size > 0, 'no section puts a labelled element above a heading any more');

  for (const [name, sections] of labels) {
    /* Not `selects(name)`: that counts `.name:empty { display: none; }` as styling, so a new
       eyebrow class carrying only the hide rule passed while the label a shopper actually
       reads got nothing (Codex, #300). Only rules that paint the non-empty element count. */
    assert.ok(
      contextsFor(name).some((context) => context.filled.length > 0),
      `.${name} introduces the heading in ${sections.size} section(s) ` +
        `(${[...sections].sort().slice(0, 3).join(', ')}...) and no rule in ` +
        'assets/legacy-page-layout.css selects it, so it renders as plain body copy'
    );
  }
});

/* `display:none` removes the box; so does a `content-visibility`-less zero-everything, but
   nothing here does that, so the rule is the plain one. */
const REMOVES_BOX = 'none';

test('an eyebrow with nothing in it takes up no room', () => {
  for (const [name, sections] of labels) {
    for (const context of contextsFor(name)) {
      /* The element ships whether or not its setting has a value -- four of the seven on
         /pages/wholesale render empty -- and an empty inline box still occupies a line box. */
      assert.ok(
        context.empty.some((rule) => rule.needsEmpty),
        `.${name} is rendered unconditionally by ${[...sections].sort()[0]}, so it can be ` +
          `empty, but in ${context.where} no rule hides it when it is`
      );
      /* Not "an :empty rule exists" and not "the first match hides it": a second
         `.subtitle:empty { display: block; }` wins in the browser and used to pass here
         (Codex, #300). The winner is what decides whether the box is there. */
      const winner = lastValue(merge(context.empty, context.inline), 'display');
      assert.equal(
        (winner ?? '').trim(),
        REMOVES_BOX,
        `.${name} when empty resolves to display:${winner ?? '<unset>'} in ${context.where} ` +
          `across ${JSON.stringify(context.empty.map((rule) => rule.selector))}, so an empty ` +
          'eyebrow still occupies a line'
      );
    }
  }
});

test('the eyebrow sits on its own line above the heading', () => {
  for (const [name] of labels) {
    for (const context of contextsFor(name)) {
      if (context.filled.length === 0) continue;
      /* `.some()` passed while a later `display: inline` won in the browser (Codex, #300). */
      const winner = lastValue(merge(context.filled, context.inline), 'display');
      assert.equal(
        (winner ?? '').trim(),
        'block',
        `a span is inline by default, so .${name} needs to resolve to display:block -- in ` +
          `${context.where}, across ` +
          `${JSON.stringify(context.filled.map((rule) => rule.selector))}, it resolves to ` +
          `${winner ?? '<unset>'}, and the eyebrow runs into the heading on the same line`
      );
    }
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
    const contexts = contextsFor(name);
    assert.ok(contexts.length > 0, `no rule paints .${name}`);

    /* One resolution per context rather than a walk over every rule: a context is a real
       element state, so the declaration that wins there is what the reader sees. Resolving
       them all together let a rule for one section mask a regression in another, and walking
       them in sequence failed on states no element is ever in (Codex, #300). */
    for (const context of contexts) {
      if (context.filled.length === 0) continue;
      const { alpha, literal, how } = painted(merge(context.filled, context.inline));

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
          `${ground_name} is ${ground}, and .${name} in ${context.where} ` +
            `(${how}${alpha < 1 ? ` at ${alpha} opacity` : ''}) lands at ${ratio.toFixed(2)}:1 ` +
            'on it -- under 4.5:1'
        );
      }
    }
  }
});
