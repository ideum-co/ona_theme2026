import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Comments mention class names in prose; a rule has to actually select one. */
const decomment = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ');

/*
 * Every stylesheet that can reach a legacy eyebrow, in the order the browser applies them.
 *
 * Reading only legacy-page-layout.css missed the `{% style %}` and `{% stylesheet %}` blocks
 * the sections carry -- 139 of them -- which render after the asset and override it, so
 * `#MainContent .subtitle { opacity: .6 }` added to ona-wholesale-partnership muted every
 * eyebrow on the page with all four tests green (Codex, #300). Liquid is stripped the same
 * way it is in the markup, since a value it emits is not a selector.
 */
const sheets = (() => {
  /* Every stylesheet the layout loads, read off the layout rather than listed here, so a
     new global sheet is covered the day it is added. base.css was missing, and because the
     eyebrow rule does not reset `opacity`, a `.subtitle { opacity: .6 }` there rendered
     every label under the bar with all four tests green (Codex, #300). */
  const loaded = [];
  for (const file of ['snippets/stylesheets.liquid', 'layout/theme.liquid']) {
    let source;
    try {
      source = readFileSync(join(root, file), 'utf8');
    } catch {
      continue;
    }
    for (const [, asset] of source.matchAll(/'([\w.-]+\.css)'\s*\|\s*asset_url\s*\|\s*stylesheet_tag/g)) {
      if (!loaded.includes(asset)) loaded.push(asset);
    }
  }
  assert.ok(
    loaded.includes('legacy-page-layout.css'),
    'the layout no longer loads legacy-page-layout.css the way this scan reads it',
  );

  const out = loaded.map((asset) => ({
    origin: null,
    text: decomment(readFileSync(join(root, 'assets', asset), 'utf8')),
  }));

  const liquid = (text) =>
    decomment(text)
      .replace(/\{%-?[\s\S]*?-?%\}/g, ' ')
      .replace(/\{\{[\s\S]*?\}\}/g, 'x');

  for (const dir of ['sections', 'snippets']) {
    for (const file of readdirSync(join(root, dir))) {
      if (!file.endsWith('.liquid')) continue;
      const source = readFileSync(join(root, dir, file), 'utf8');

      /* Shopify concatenates every `{% stylesheet %}` into one asset served on every page,
         so these are global whether or not the section renders. */
      for (const [, body] of source.matchAll(
        /\{%-?\s*stylesheet[^%]*-?%\}([\s\S]*?)\{%-?\s*endstylesheet\s*-?%\}/g,
      )) {
        out.push({ origin: null, text: liquid(body) });
      }

      /* `{% style %}` renders inline where the section does, so it only reaches a page that
         renders that section. Pooling them globally let CSS from a section no template uses
         override a real regression (Codex, #300). A snippet can be rendered from anywhere,
         so those stay global. */
      for (const [, body] of source.matchAll(/\{%-?\s*style\s*-?%\}([\s\S]*?)\{%-?\s*endstyle\s*-?%\}/g)) {
        const origin = dir === 'sections' ? file.slice(0, -'.liquid'.length) : null;
        /* `#shopify-section-{{ section.id }}` names this section's own wrapper. Letting
           `liquid()` flatten the output to `x` left `#shopify-section-x`, which matches no
           ancestor at all, so the standard way to scope a section's CSS was dropped without
           a word. Resolved to the same stand-in the chain carries, before the flattening.

           This is the only dynamic selector form resolved here, and deliberately so: the
           theme has around fifty others -- `.color-custom-{{ ... }}`, `.media-fit-{{ ... }}`,
           `[data-option-id="{{ ... }}"]` -- almost all of them Horizon's own, and failing on
           every one would make this test unrunnable rather than more honest. They still
           flatten and still match nothing; that is a known gap, not a resolved one. */
        const scoped = origin
          ? body.replace(/#shopify-section-\{\{-?\s*section\.id\s*-?\}\}/g, `#shopify-section-${origin}`)
          : body;
        out.push({ origin, text: liquid(scoped) });
      }
    }
  }
  return out;
})();

/* Which sections share a page, so a section's inline styles reach only those eyebrows. */
const templates = (() => {
  const found = [];
  for (const file of readdirSync(join(root, 'templates'))) {
    if (!file.endsWith('.json')) continue;
    try {
      const parsed = JSON.parse(
        readFileSync(join(root, 'templates', file), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\//, ''),
      );
      const sections = parsed.sections ?? {};
      found.push({
        file,
        types: new Set(Object.values(sections).map((section) => section.type)),
        /* The order the browser sees, for the ordering guard below. */
        order: (parsed.order ?? Object.keys(sections))
          .map((key) => sections[key]?.type)
          .filter(Boolean),
      });
    } catch {
      continue;
    }
  }
  return found;
})();

/*
 * A section's `{% style %}` enters the cascade where the section renders, so between two of
 * them on one page the template's order decides, not the order `readdirSync` happened to
 * return. `flat` numbers them globally, which can resolve two such rules backwards
 * (Codex, #427).
 *
 * Rather than model per-template source order, this refuses the case: today no section's
 * `{% style %}` touches an eyebrow at all, and only two sections carry such a block, so the
 * ordering never arises. It fails loudly the day a second one does, which is the same stance
 * this file takes on `!important` and sibling combinators -- rather than quietly resolving
 * them the wrong way round.
 */
const assertInlineOrderUnambiguous = (name) => {
  const target = new RegExp(`\\.${name.replace(/-/g, '\\-')}(?![\\w-])`);
  const styling = new Set(
    sheets
      .filter((sheet) => sheet.origin && target.test(sheet.text))
      .map((sheet) => sheet.origin),
  );
  if (styling.size < 2) return;
  for (const { file, order } of templates) {
    const onPage = order.filter((type) => styling.has(type));
    assert.ok(
      new Set(onPage).size < 2,
      `${file} renders ${[...new Set(onPage)].join(' and ')}, and each styles .${name} from ` +
        'its own {% style %} block. Their source order follows this template, which this ' +
        'cascade model does not track -- give it per-template ordering rather than trusting ' +
        'the result',
    );
  }
};

/* Kept for the prose checks that only ask whether a name is mentioned at all. */
const css = sheets.map((sheet) => sheet.text).join('\n');

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
    (file) => file.startsWith('ona-') && file.endsWith('.liquid'),
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
  /* `:where()` contributes nothing and `:is()`/`:not()` contribute their most specific
     argument. Counting each functional pseudo as one class made
     `:where(.add-image-and-text-slider) .subtitle` tie with the plain descendant selector,
     so a later low-specificity rule appeared to mask a real regression (Codex, #300). */
  let rest = selector;
  let ids = 0;
  let classes = 0;
  let elements = 0;

  for (;;) {
    const found = rest.match(/:(is|where|not|has)\(([^()]*)\)/i);
    if (!found) break;
    const inner =
      found[1].toLowerCase() === 'where'
        ? 0
        : Math.max(0, ...splitSelectors(found[2]).map((branch) => specificity(branch)));
    ids += Math.floor(inner / 10000);
    classes += Math.floor((inner % 10000) / 100);
    elements += inner % 100;
    rest = rest.replace(found[0], ' ');
  }

  ids += (rest.match(/#[\w-]+/g) ?? []).length;
  classes += (rest.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[a-z-]+/gi) ?? []).length;
  elements += (rest.replace(/[#.][\w-]+|\[[^\]]*\]|::?[a-z-]+/gi, ' ').match(/[a-z][\w-]*/gi) ?? []).length;
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

  /* Top-level commas only; a comma inside parentheses belongs to whatever it is nested in.
     `splitSelectors` does this too but is defined further down, and `flat` runs at import. */
  const branchesOf = (selectorList) => {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let at = 0; at < selectorList.length; at += 1) {
      const character = selectorList[at];
      if (character === '(') depth += 1;
      else if (character === ')') depth = Math.max(0, depth - 1);
      else if (character === ',' && depth === 0) {
        parts.push(selectorList.slice(start, at));
        start = at + 1;
      }
    }
    parts.push(selectorList.slice(start));
    return parts.map((part) => part.trim()).filter((part) => part !== '');
  };

  /* A nested selector resolved against the rule it sits in: `&` is the parent, and without
     one the nesting means a descendant. Emitting the nested selector as written made it
     stand for every element on the page rather than the ones inside the parent. */
  const absolute = (selectorList, parent) =>
    parent === ''
      ? selectorList
      : /* The cross product of the two lists. Substituting the parent as one raw string put
           the nested suffix on its last branch alone, so `a, b { &:hover { … } }` came out
           as `a, b:hover` -- which restored every `a` unconditionally (Codex, #427). */
        branchesOf(parent)
          .flatMap((root) =>
            branchesOf(selectorList).map((branch) =>
              branch.includes('&') ? branch.replace(/&/g, root) : `${root} ${branch}`,
            ),
          )
          .join(', ');

  const walk = (body, conditions, parent = '') => {
    /* Declarations sitting directly in this body belong to the rule that encloses it. At the
       top level there is no such rule and loose text is not CSS, so it is dropped. */
    const flush = (text) => {
      if (parent === '' || !/[^\s;]/.test(text)) return;
      order += 1;
      out.push({ conditions, selectorList: parent, declarations: text, at: order });
    };

    let at = 0;
    while (at < body.length) {
      const open = body.indexOf('{', at);
      if (open === -1) {
        flush(body.slice(at));
        break;
      }
      let depth = 1;
      let close = open + 1;
      for (; close < body.length && depth > 0; close += 1) {
        if (body[close] === '{') depth += 1;
        else if (body[close] === '}') depth -= 1;
      }
      /* Everything before this block splits at the last `;`: declarations belonging to the
         enclosing rule, then the prelude of the block itself. */
      const head = body.slice(at, open);
      const broke = head.lastIndexOf(';');
      const loose = broke === -1 ? '' : head.slice(0, broke + 1);
      const prelude = head.slice(broke + 1).trim();
      const inner = body.slice(open + 1, close - 1);
      flush(loose);

      if (prelude.startsWith('@')) {
        /* Conditional groups hold rules; @font-face and @keyframes hold declarations, and
           nothing in them can target a label. */
        if (/^@(media|supports|layer|container|scope)\b/i.test(prelude)) {
          /* `parent` travels in. A conditional group nested inside a style rule holds that
             rule's declarations under an extra condition, and dropping the selector here
             left `#MainContent .subtitle { @media (min-width: 750px) { opacity: .6 } }`
             emitting nothing at all (Codex, #427). */
          walk(inner, [...conditions, prelude.replace(/\s+/g, ' ')], parent);
        }
      } else if (prelude) {
        /* Nested CSS: `a { color: red; &[x] { color: blue } }`. Treating the whole body as
           the parent's declarations would attribute the nested rule's colour to the parent,
           so the nested rule is walked as its own, under its own absolute selector. */
        walk(inner, conditions, absolute(prelude, parent));
      }
      at = close;
    }
  };

  walk(text, []);
  return out;
};

/* One source order across every sheet. flatten() counts from zero per sheet, and sorting the
   combined rules by that per-sheet number put a section's `{% style %}` before the asset it
   actually loads after, so a later rule resolved as the earlier one (Codex, #300). */
const flat = sheets
  .flatMap((sheet) => flatten(sheet.text).map((rule) => ({ ...rule, origin: sheet.origin })))
  .map((rule, index) => ({ ...rule, at: index + 1 }));

/*
 * Every rule in the sheets, as compounds.
 *
 * An ancestor's `opacity` composites the whole subtree and an ancestor's `color` is what the
 * label inherits, so a rule that never mentions the label can still decide how it reads:
 * `.add-image-and-text-slider .text { opacity: .6 }` put every sourcing eyebrow under the
 * bar with all four tests green (Codex, #300). Filtering on the label class missed them.
 */
let everyRuleCache = null;
const everyRule = () => {
  if (everyRuleCache) return everyRuleCache;
  const found = [];
  for (const { conditions, selectorList, declarations, at, origin } of flat) {
    for (const branch of splitSelectors(selectorList)) {
      if (PSEUDO_ELEMENT.test(branch)) continue;
      const parts = pathOf(branch);
      if (parts.length === 0) continue;
      found.push({
        selector: branch.trim().replace(/\s+/g, ' '),
        declarations,
        /* `raw` is the compound before `structural()` strips the state pseudos off it.
           `matchesPath` wants the structural form; the fill-state checks want `:empty`,
           and reading them off the stripped one classified an empty-only rule as applying
           to a label with text -- `#MainContent span:empty { display: none }` failed the
           layout test on an eyebrow it cannot touch (Codex, #427). `rulesFor` keeps the
           raw label for exactly this reason; the unnamed path now can too. */
        path: parts.map((part) => ({
          ...part,
          raw: part.compound,
          compound: structural(part.compound),
        })),
        siblings: parts.some((part) => part.combinator === '+' || part.combinator === '~'),
        conditions: [...conditions, ...statesOf(branch)],
        weight: specificity(branch),
        at,
        origin,
      });
    }
  }
  everyRuleCache = found.sort((a, b) => a.weight - b.weight || a.at - b.at);
  return everyRuleCache;
};

/* What the ancestors do to the label: opacity composites, so it multiplies; color is
   inherited, so the nearest ancestor that sets one supplies it. */
const ancestorEffects = (chain, conditions, live, inlines = []) => {
  let alpha = 1;
  let colour = null;
  /* Custom properties set anywhere above the label inherit down to it, so they are carried
     along the chain with the nearest definition winning. */
  const tokens = new Map();

  for (let index = 0; index < chain.length - 1; index += 1) {
    const applicable = everyRule().filter(
      (rule) =>
        live(rule) &&
        rule.conditions.every((condition) => conditions.includes(condition)) &&
        matchesPath(rule.path, chain, index),
    );
    /* The ancestor's own `style=""` beats every rule on it, so it goes last. Checked before
       the early return, since an inline style can be the only thing this ancestor does. */
    const inline = inlines[index] ?? '';
    if (applicable.length === 0 && inline === '') continue;

    /* The rejection in rulesFor() only covers selectors naming the label, so an ancestor's
       `opacity: .6 !important` was overridden here by a later `opacity: 1` the browser
       ignores (Codex, #300). Ancestor rules that reach the label get the same treatment. */
    for (const rule of applicable) {
      assert.ok(
        !/!important/.test(rule.declarations),
        `an ancestor of the label is styled with !important ("${rule.selector}"), which this ` +
          'cascade model does not resolve -- extend it rather than trusting the result'
      );
    }

    const body = merge(applicable, inline);
    const faded = lastValue(body, 'opacity');
    if (faded !== null) {
      const literal = faded.match(/^([0-9.]+)%?$/);
      assert.ok(
        literal,
        `cannot read an ancestor's opacity from "${faded}" -- extend this resolver rather ` +
          'than treating the label as fully opaque',
      );
      alpha *= faded.includes('%') ? Number(literal[1]) / 100 : Number(literal[1]);
    }
    /* The same rule as on the label, one level up and once per ancestor: `inherit` and
       `currentColor` take what this ancestor's own parent computed, and they override
       anything this ancestor said before them. Assigning the keyword through replaced a
       concrete colour from above with an unresolved word, which the contrast check then
       reads as whichever palette extreme suits each ground (Codex, #427). */
    /* This ancestor's own definitions apply to its own declarations, so they land first. */
    for (const [, name, value] of body.matchAll(/(?:^|;)\s*(--color-foreground[\w-]*)\s*:\s*([^;]+)/g)) {
      tokens.set(name, value.trim());
    }

    const above = colour;
    for (const [, value] of body.matchAll(/(?:^|;)\s*color\s*:\s*([^;]+)/g)) {
      const text = value.trim();
      colour = RESTATES_INHERITANCE.test(text) ? above : substituted(body, text, tokens);
    }
  }
  return { alpha, colour, tokens };
};

const rulesFor = (name) => {
  const escaped = name.replace(/-/g, '\\-');
  const target = new RegExp(`\\.${escaped}(?![\\w-])`);
  const found = [];
  for (const { conditions, selectorList, declarations, at, origin } of flat) {
    for (const branch of splitSelectors(selectorList)) {
      if (!target.test(branch) || PSEUDO_ELEMENT.test(branch)) continue;
      /* `!important` reorders the cascade in a way none of this models, so it fails rather
         than being silently mis-resolved. Nothing in the stylesheet uses it today. */
      assert.ok(
        !/!important/.test(declarations),
        `.${name} is styled with !important ("${branch.trim()}"), which this cascade model ` +
          'does not resolve -- extend it rather than trusting the result',
      );

      /* The ancestors the rule asks for, and what it asks of the label itself. A rule applies
         wherever another one does when everything it asks for is also present there, which is
         what keeps two mutually exclusive sections from resolving as one element. */
      const parts = pathOf(branch);
      const compounds = parts.map((part) => part.compound);
      const own = compounds.findIndex((compound) => target.test(compound));
      /* A sibling combinator describes a relationship this model has no chain for. Nothing
         in the theme uses one on a label today, so it fails rather than being guessed. */
      assert.ok(
        own === -1 || !parts.some((part) => part.combinator === '+' || part.combinator === '~'),
        `.${name} is selected through a sibling combinator ("${branch.trim()}"), which this ` +
          'model does not resolve -- extend it rather than dropping the rule',
      );
      /* Compounds after the label mean the rule targets a descendant of it, not the label:
         `#MainContent .subtitle span { display: block }` cannot change the eyebrow's own
         display, and discarding the trailing compound credited it with doing so, at a
         specificity that masked a real regression (Codex, #300). */
      if (own !== compounds.length - 1) continue;
      const label = compounds[own];
      /* `:not(:empty)` selects a label that HAS text. Reading it as an empty-state rule threw
         the declaration away, so `:not(:empty) { opacity: 0.6 }` muted every visible eyebrow
         with nothing failing (Codex, #300). The negation is stripped before the test. */
      const needsFilled = /:not\(\s*:empty\s*\)/.test(label);
      const needsEmpty = /:empty/.test(label.replace(/:not\([^)]*\)/g, ''));
      /* Anything else on the label -- `:hover`, `:focus-visible`, `:first-child`, `::before`
         -- only holds in that state, and treating such a rule as always applying let
         `.subtitle:hover { display: block }` mask a default-state `display: inline`
         (Codex, #300). A state is a qualifier like an at-rule, so it joins them.

         Read from the whole branch, not the label compound: a state on an ancestor holds the
         rule back just as one on the label does, and `structural()` strips it from the
         matching path, so reading only the label left `.text:hover .subtitle { opacity: 1 }`
         unconditional and the non-hovered cascade under it was never measured (Codex, #427).
         everyRule() already reads the branch; this is the same rule in the named path. */
      const states = statesOf(branch);

      found.push({
        selector: branch.trim().replace(/\s+/g, ' '),
        declarations,
        label: structural(label),
        path: parts.map((part) => ({
          ...part,
          compound: structural(part.compound),
        })),
        conditions: [...conditions, ...states],
        needsEmpty,
        needsFilled,
        weight: specificity(branch),
        at,
        origin,
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
/*
 * A pseudo-element is a separate box, not a state of the element that originates it.
 * Collected as a state and then stripped for structural matching, `::before`'s declarations
 * were resolved onto the eyebrow itself -- `.subtitle::before { content: ""; display: inline }`
 * failed both layout tests on a label whose own `display` never changes (Codex, #427).
 * Modelling those boxes is a different job; until someone does it, a rule that targets one is
 * not part of this element's cascade. Single-colon `:before` and friends are the legacy
 * spelling of the same thing.
 */
const PSEUDO_ELEMENT =
  /::[a-z-]|:(?:before|after|first-line|first-letter|selection|marker|placeholder|backdrop)\b/i;

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
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
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
/*
 * The links above every section: what `layout/theme.liquid` wraps the page in, read out of
 * the file rather than assumed.
 *
 * Each chain used to start at a bare `#MainContent`, which discarded `html`, `body`, and even
 * the main element's own tag and classes -- so `body .subtitle { opacity: .6 }`, which fades
 * every eyebrow on the site, matched nothing and passed (Codex, #427). A class written with
 * Liquid in it (`page-width-{{ ... }}`) is not a token any selector here can name, so only
 * the static ones are recorded.
 */
const LAYOUT_CHAIN = (() => {
  const source = readFileSync(join(root, 'layout', 'theme.liquid'), 'utf8');
  const tokensOf = (tag) => {
    const attributes = source.match(new RegExp(`<${tag}\\b([^>]*)>`))?.[1] ?? '';
    const classes = (attributes.match(/class="([^"]*)"/)?.[1] ?? '')
      .split(/\s+/)
      .filter((value) => value && !value.includes('{'));
    const identifier = attributes.match(/\bid="([^"{]*)"/)?.[1];
    return new Set([tag, ...classes.map((value) => `.${value}`), ...(identifier ? [`#${identifier}`] : [])]);
  };
  const main = tokensOf('main');
  assert.ok(
    main.has('#MainContent') && main.has('.content-for-layout'),
    'layout/theme.liquid no longer wraps the page in <main id="MainContent" class="content-for-layout">; ' +
      'this chain head is stale and every selector qualified by it is being dropped',
  );
  return [new Set(['html']), tokensOf('body'), main];
})();

const ancestriesFor = (name) => {
  const found = [];
  for (const file of readdirSync(join(root, 'sections'))) {
    if (!file.startsWith('ona-') || !file.endsWith('.liquid')) continue;
    const markup = readFileSync(join(root, 'sections', file), 'utf8')
      .split(/\{%-?\s*schema\s*-?%\}/)[0]
      .replace(/\{%-?[\s\S]*?-?%\}/g, ' ')
      .replace(/\{\{[\s\S]*?\}\}/g, 'x');

    const open = [];
    for (const [tag, closing, element, attributes] of markup
      .matchAll(/<(\/?)([a-zA-Z][\w-]*)\b([^>]*)>/g)
      .map((match) => [match[0], match[1], match[2].toLowerCase(), match[3]])) {
      if (closing) {
        const at = open.map((entry) => entry.element).lastIndexOf(element);
        if (at !== -1) open.length = at;
        continue;
      }
      const classes = (attributes.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean);
      /* `[data-x]` was treated as always matching, so a selector qualified by an attribute
         the element does not carry was credited to every eyebrow (Codex, #300). */
      const attrs = [...attributes.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].flatMap(([, key, value]) =>
        value === undefined ? [`[${key}]`] : [`[${key}]`, `[${key}="${value}"]`]
      );
      /* An id reaches an element two ways -- `#name` in a selector, `[id="name"]` in the
         attribute form -- and only the second was recorded, so `#MainContent #probe-label`
         could never match the element it names (Codex, #427). Both forms now, on ancestors
         and on the label, since `attrs` feeds each link of the chain. */
      const identifier = attributes.match(/\bid="([^"]*)"/)?.[1];
      if (identifier) attrs.push(`#${identifier}`);
      if (classes.includes(name)) {
        /* An inline `style` outranks every rule in the stylesheet, and reading only the
           classes off this element meant `style="display:inline;opacity:.6"` on the
           partnership eyebrow lost both its layout and its contrast with the suite green
           (Codex, #300). It is carried with the chain and applied last. */
        found.push({
          /* One entry per ancestor element, in order, each holding only its own classes.
             Flattening them into a single set lost which classes share an element, so
             `.add-image-and-text.text .subtitle` matched a page where those two classes sit
             on different ancestors, and an `opacity: 1` written that way cancelled a real
             muted rule that the browser keeps (Codex, #300). */
          /* The label itself is the last link. Recording only its ancestors meant an extra
             class in the label compound -- `.subtitle.not-rendered` -- was never checked
             against the real element, so a rule that selects nothing could be written to
             cancel a real regression (Codex, #300). */
          chain: [
            ...LAYOUT_CHAIN,
            /* Shopify wraps each section's output in
               `<div id="shopify-section-{id}" class="shopify-section">`, which is what
               `#shopify-section-{{ section.id }}` in a section's own `{% style %}` block
               selects. Without this link that selector -- the standard scoping pattern,
               already used by `snippets/ona-band.liquid` -- matched nothing and was silently
               dropped (Codex, #427). The id here stands in for the template key Shopify
               generates; the rewrite in `sheets` uses the same stand-in, so a section's
               scoped rule reaches its own eyebrows and no others. */
            new Set(['div', '.shopify-section', `#shopify-section-${file.slice(0, -'.liquid'.length)}`]),
            ...open.map(
              (entry) => new Set([entry.element, ...entry.classes.map((c) => `.${c}`), ...entry.attrs])
            ),
            new Set([element, ...classes.map((c) => `.${c}`), ...attrs]),
          ],
          /* An ancestor's own `style=""` outranks every stylesheet rule on that ancestor, and
             `opacity` there composites the label just as a rule would. Recording only the
             label's inline styles meant `style="opacity:0.6"` on the partnership wrapper
             faded its eyebrow below the bar with the suite green (Codex, #427). Parallel to
             `chain`, so index n is the inline style of chain[n]. */
          inlines: [
            ...LAYOUT_CHAIN.map(() => ''),
            '',
            ...open.map((entry) => entry.inline),
            attributes.match(/style="([^"]*)"/)?.[1] ?? '',
          ],
          inline: attributes.match(/style="([^"]*)"/)?.[1] ?? '',
          section: file.slice(0, -'.liquid'.length),
        });
      }
      if (!VOID_TAGS.has(element) && !/\/\s*$/.test(attributes))
        open.push({
          element,
          classes,
          attrs,
          inline: attributes.match(/style="([^"]*)"/)?.[1] ?? '',
        });
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

/* The pseudo-classes that make a rule hold only sometimes. `:is`, `:where` and `:not` are
   structural -- matchesElement resolves those against the element -- and `:empty` is the
   fill state, handled on its own. */
const PSEUDO_IN_ARGUMENT = /:(?!is\(|where\(|not\()[a-z-]+(?:\([^)]*\))?/i;

const statesOf = (compound) => {
  /*
   * A pseudo-class inside `:is()` or `:where()` gates the rule exactly as one written on the
   * compound: `:is(:hover)` holds only while hovered. Stripping the whole function lost that
   * condition while `structural()` stripped the inner pseudo, so the rule came out both
   * unconditional and unmatchable -- `.subtitle:is(:hover) { opacity: .6 }` was dropped with
   * the suite green (Codex, #427). The function is kept whole as one condition, which is the
   * honest reading of an alternation: it holds when any argument does.
   *
   * `:not()` is deliberately left as it was. `:not(:hover)` holds in the default state, which
   * is the context this model builds first, so reading it as unconditional is right there and
   * over-applies only in the state it excludes. 73 selectors in the theme put a pseudo-class
   * inside a `:not()`, and giving each the negation of a condition -- along with the rule that
   * a context cannot hold both a state and its negation -- is a larger change than this one.
   */
  const nested = (compound.match(/:(?:is|where)\([^)]*\)/gi) ?? []).filter((fn) =>
    PSEUDO_IN_ARGUMENT.test(fn.replace(/^:(?:is|where)\(/i, '').replace(/\)$/, '')),
  );
  const direct =
    compound
      .replace(/:(?:is|where|not)\([^)]*\)/gi, '')
      .replace(/:empty\b/gi, '')
      .match(/::?[a-z-]+(?:\([^)]*\))?/gi) ?? [];
  return [...nested, ...direct].map((state) => state.toLowerCase().replace(/\s+/g, ''));
};

/* A compound with its state pseudos removed, leaving what identifies the element. A function
   emptied by that -- `:is(:hover)` becoming `:is()` -- goes too, since an empty argument list
   matches nothing and would drop the rule the states above have just qualified. */
const structural = (compound) =>
  compound
    .replace(/:empty\b/gi, '')
    .replace(/:(?!is\(|where\(|not\()[a-z-]+(?:\([^)]*\))?/gi, '')
    .replace(/:(?:is|where|not)\(([^)]*)\)/gi, (whole, args) =>
      args.split(',').every((part) => part.trim() === '') ? '' : whole,
    );

/* Bare element names in a compound. Without these, `text-component { color: transparent }`
   -- a selector with no class or id at all -- matched every ancestor, because a compound
   with no parts vacuously satisfied every one of them. */
const tagsOf = (text) =>
  (text.replace(/[#.][\w-]+|\[[^\]]*\]|::?[a-z-]+(?:\([^)]*\))?|&/gi, ' ').match(/[a-z][\w-]*/gi) ?? []).map(
    (tag) => tag.toLowerCase(),
  );

const bracketsOf = (text) => text.match(/\[[^\]]*\]/g) ?? [];

/*
 * One bracketed attribute selector against one element: true, false, or null for undecidable.
 *
 * `[class~="subtitle"]` selects exactly what `.subtitle` selects, so it is answered as a
 * class. The substring operators cannot be answered from the tokens this model records, and
 * the normalisation this replaced turned every one of them into a string no element set ever
 * holds -- which reads as "no match" and drops the rule without saying so. That is how
 * `#MainContent [class~="subtitle"] { opacity: .6 }` faded every eyebrow with all five tests
 * green (Codex, #427). Undecidable now means undecidable, and matchesElement fails on it
 * rather than guessing.
 */
const TRACKED_ATTRIBUTES = new Set(['class', 'id']);

const attrMatch = (token, element) => {
  const parsed = token.match(/^\[\s*([\w-]+)\s*(?:([~^|$*]?=)\s*["']?([^\]"']*)["']?\s*)?\]$/);
  if (parsed === null) return null;
  const [, key, operator, value] = parsed;

  /* The element sets hold tags, classes and ids and nothing else, so a selector narrowing on
     any other attribute names elements this model cannot identify, and is read as reaching
     none of them -- the same answer as before this change, now a stated limit rather than a
     silent one. Twelve compounds in the theme land here with everything else about them
     matching (`[data-add-form]`, `[data-slider-track]`, `[product-grid-view='default']`,
     `html[scroll-lock]` and eight more), nearly all bare attribute selectors whose other
     parts constrain nothing at all. Carrying attributes down the chain is what it would take
     to answer them, and that is a larger change than this one. */
  if (!TRACKED_ATTRIBUTES.has(key)) return false;

  /* Every element whose classes or id this model records has one. */
  if (!operator) {
    const mark = key === 'class' ? '.' : '#';
    return [...element].some((part) => part.startsWith(mark));
  }
  if (key === 'class' && operator === '~=') return element.has(`.${value}`);
  if (key === 'id' && operator === '=') return element.has(`#${value}`);
  return null;
};

/*
 * Whether one compound selects one element.
 *
 * The arguments of `:is()`, `:where()` and `:not()` are compounds in their own right, so they
 * are matched by the same function rather than by a classes-and-ids reading of their text. On
 * that reading `:not(div)` carried no parts at all, every branch vacuously matched, and the
 * whole rule was dropped -- so `#MainContent .subtitle:not(div) { opacity: 0.6 }` muted every
 * `<span>` eyebrow with all five tests green, and `:is(div)` would have matched them in the
 * same breath (Codex, #427). Types and attributes inside an argument now constrain it exactly
 * as they do outside one.
 */
const matchesElement = (compound, element) => {
  const anyOf = [...compound.matchAll(/:(?:is|where)\(([^)]*)\)/gi)];
  const noneOf = [...compound.matchAll(/:not\(([^)]*)\)/gi)];
  const bare = compound.replace(/:(?:is|where|not)\([^)]*\)/gi, '');

  const attributes = bracketsOf(bare).map((token) => attrMatch(token, element));
  if (attributes.includes(false)) return false;

  const rest =
    partsOf(bare).every((part) => element.has(part)) &&
    tagsOf(bare).every((tag) => element.has(tag)) &&
    anyOf.every((match) =>
      splitSelectors(match[1]).some((branch) => matchesElement(branch, element)),
    ) &&
    noneOf.every((match) =>
      splitSelectors(match[1]).every((branch) => !matchesElement(branch, element)),
    );
  if (!rest) return false;

  /* Everything this can read says the compound selects the element, so an attribute it
     cannot read is the only thing standing between the rule and the label. Dropping it here
     is the silent failure; saying so is not. */
  assert.ok(
    !attributes.includes(null),
    `cannot tell whether "${bare.trim()}" selects the label -- teach attrMatch this ` +
      'attribute selector rather than dropping the rule that carries it',
  );
  return true;
};

/*
 * Walk a selector against a chain, honouring the combinator between each compound.
 *
 * The tokenizer used to make `>` a compound of its own, which no compound could match, so a
 * real `#MainContent .text > .subtitle { opacity: .6 }` was dropped from the context and the
 * label measured without it (Codex, #300). `+` and `~` are sibling relationships this model
 * has no chain for, so they fail rather than being guessed at; nothing uses them today.
 */
const pathOf = (branch) => {
  /* Scanned rather than matched, because `~` is a sibling combinator outside brackets and
     part of the attribute operator inside them. The regex this replaced split
     `[class~="subtitle"]` into `[class`, `~` and `="subtitle"]`, and the sibling filter then
     dropped the rule -- so `#MainContent [class~="subtitle"] { opacity: .6 }` faded every
     eyebrow with all five tests green (Codex, #427). */
  const tokens = [];
  let current = '';
  let parens = 0;
  let brackets = 0;
  let quote = null;
  for (const character of branch.trim()) {
    if (quote !== null) {
      current += character;
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      current += character;
      continue;
    }
    if (character === '(') parens += 1;
    else if (character === ')') parens = Math.max(0, parens - 1);
    else if (character === '[') brackets += 1;
    else if (character === ']') brackets = Math.max(0, brackets - 1);
    const outside = parens === 0 && brackets === 0;
    if (outside && /\s/.test(character)) {
      if (current !== '') tokens.push(current);
      current = '';
      continue;
    }
    if (outside && /[>+~]/.test(character)) {
      if (current !== '') tokens.push(current);
      current = '';
      tokens.push(character);
      continue;
    }
    current += character;
  }
  if (current !== '') tokens.push(current);

  const parts = [];
  let combinator = ' ';
  for (const token of tokens) {
    if (/^[>+~]$/.test(token)) {
      combinator = token;
      continue;
    }
    parts.push({ combinator, compound: token });
    combinator = ' ';
  }
  return parts;
};

const matchesPath = (parts, chain, endIndex) => {
  if (parts.length === 0) return false;
  const walk = (at, index) => {
    if (index < 0) return false;
    if (!matchesElement(parts[at].compound, chain[index])) return false;
    if (at === 0) return true;
    const { combinator } = parts[at];
    if (combinator === '>') return walk(at - 1, index - 1);
    for (let above = index - 1; above >= 0; above -= 1) {
      if (walk(at - 1, above)) return true;
    }
    return false;
  };
  return walk(parts.length - 1, endIndex);
};

/* Top-level commas only: `@media (max-width: 749px), (min-width: 750px)` is two queries, but
   a comma inside parentheses belongs to whatever it is nested in. */
const alternativesOf = (condition) => {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let at = 0; at < condition.length; at += 1) {
    const character = condition[at];
    if (character === '(') depth += 1;
    else if (character === ')') depth = Math.max(0, depth - 1);
    else if (character === ',' && depth === 0) {
      parts.push(condition.slice(start, at));
      start = at + 1;
    }
  }
  parts.push(condition.slice(start));
  return parts.map((part) => part.trim()).filter((part) => part !== '');
};

/* `rem` and `em` both resolve against the root font size in a media query, which is the
   browser default -- a page `font-size` cannot change it there. Units beyond these are
   refused outright: returning false used to mean "cannot happen", so
   `@media (min-width: 40rem) { .subtitle { opacity: .6 } }` had every context holding it
   discarded and the suite stayed green while the label sat under the bar at matching
   viewports (Codex, #427). */
const widthIn = (value, where) => {
  const measure = String(value).trim().match(/^(-?[\d.]+)(px|rem|em)?$/i);
  assert.ok(
    measure,
    `cannot read the viewport width "${String(value).trim()}" in "${where}" -- ` +
      'extend this resolver rather than dropping every rule inside that query',
  );
  const ROOT_FONT_SIZE = 16;
  const unit = (measure[2] ?? 'px').toLowerCase();
  return Number(measure[1]) * (unit === 'px' ? 1 : ROOT_FONT_SIZE);
};

const regionOf = (conditions) => {
  let low = 0;
  let high = Infinity;
  const fixed = new Map();

  for (const condition of conditions) {
    /* Only a media query describes a viewport. A pseudo-class state arrives here as a
       condition too, and `:is(:hover, :focus-visible)` has parentheses of its own -- reading
       those as a media expression made the refusal below fire on a perfectly good state.
       `@supports` and `@container` likewise constrain nothing this models. */
    if (!/^@media\b/i.test(condition)) continue;

    /* `not` and `only` invert or gate the whole query, and reading the features inside one
       without honouring it gets the region backwards. Nothing in the theme uses either. */
    assert.ok(
      !/@media\s+(?:not|only)\b/i.test(condition),
      `"${condition}" uses a media qualifier this resolver does not honour -- teach it the ` +
        'inversion rather than reading the features inside as if they stood alone',
    );

    for (const group of condition.match(/\([^()]*\)/g) ?? []) {
      /* Range syntax: `(width >= 750px)`, `(750px <= width)`, `(400px < width <= 700px)`.
         The colon form below cannot see it, so `regionOf` read the query as constraining
         nothing, `falsifiable` found it true at every viewport, and every context where it
         was off was discarded -- `@media (width >= 750px)` masked a failing mobile opacity
         with the suite green (Codex, #427). */
      const both = group.match(
        /^\(\s*([\w.-]+)\s*(<=|>=|<|>|=)\s*([a-z-]+)\s*(<=|>=|<|>|=)\s*([\w.-]+)\s*\)$/i,
      );
      const after = group.match(/^\(\s*([a-z-]+)\s*(<=|>=|<|>|=)\s*([\w.-]+)\s*\)$/i);
      const before = group.match(/^\(\s*([\w.-]+)\s*(<=|>=|<|>|=)\s*([a-z-]+)\s*\)$/i);
      if (both || after || before) {
        const name = (both?.[3] ?? after?.[1] ?? before?.[3]).toLowerCase();
        assert.ok(
          name === 'width',
          `"${group}" compares ${name} as a range, which this resolver only does for width ` +
            '-- extend it rather than reading the query as constraining nothing',
        );
        /* `400px < width` is `width > 400px` read from the other side. */
        const FLIP = { '<': '>', '<=': '>=', '>': '<', '>=': '<=', '=': '=' };
        const bounds = both
          ? [[FLIP[both[2]], both[1]], [both[4], both[5]]]
          : after
            ? [[after[2], after[3]]]
            : [[FLIP[before[2]], before[1]]];

        for (const [operator, value] of bounds) {
          /* `width > 750px` is 751 and up at whole-pixel viewports, the granularity
             everything else here works in. */
          const pixels = widthIn(value, group);
          if (operator === '>=') low = Math.max(low, pixels);
          else if (operator === '>') low = Math.max(low, pixels + 1);
          else if (operator === '<=') high = Math.min(high, pixels);
          else if (operator === '<') high = Math.min(high, pixels - 1);
          else {
            low = Math.max(low, pixels);
            high = Math.min(high, pixels);
          }
        }
        continue;
      }

      /* A boolean feature test -- `(prefers-reduced-motion)` -- constrains nothing this
         model tracks, and the theme has one. Recognised here so the refusal below can be
         strict about everything it has not been taught. */
      if (/^\(\s*[a-z-]+\s*\)$/i.test(group)) continue;

      const parsed = group.match(/^\(\s*(?:(min|max)-)?([a-z-]+)\s*:\s*([^)]+)\)$/i);
      assert.ok(
        parsed,
        `cannot read the media expression "${group}" in "${condition}" -- teach this ` +
          'resolver its shape rather than letting the query constrain nothing',
      );
      const [, bound, feature, value] = parsed;
      const name = feature.toLowerCase();
      if (name === 'width' && bound) {
        /* `rem` and `em` both resolve against the root font size in a media query, which is
           the browser default -- a page `font-size` cannot change it there. Units beyond
           these are refused outright: returning false used to mean "cannot happen", so
           `@media (min-width: 40rem) { .subtitle { opacity: .6 } }` had every context
           holding it discarded and the suite stayed green while the label sat under the bar
           at matching viewports (Codex, #427). */
        const pixels = widthIn(value, condition);
        if (Number.isNaN(pixels)) return null;
        if (bound.toLowerCase() === 'min') low = Math.max(low, pixels);
        else high = Math.min(high, pixels);
        continue;
      }
      /* One feature cannot hold two values at once. This is how portrait and landscape are
         kept apart without naming either: `satisfiable` only understood widths, so two
         orientation rules were multiplied into a viewport that cannot exist (Codex, #300). */
      const normalised = String(value).trim().toLowerCase();
      const seen = fixed.get(name);
      if (seen !== undefined && seen !== normalised) return null;
      fixed.set(name, normalised);
    }
  }
  return low <= high ? { low, high, fixed } : null;
};

/*
 * Whether every condition left out of a context can be off at once inside the region the
 * selected ones describe.
 *
 * The powerset builds a context per subset and nothing checked that the omitted subsets could
 * actually be off there, so `@media (min-width: 0px)` -- which holds at every viewport there
 * is -- still produced a context without it, and the test failed CSS the browser never
 * applies (Codex, #427). Width is computed exactly. An omitted alternative that pins a
 * feature the selected conditions leave open is taken to be falsifiable by choosing another
 * value for that feature, which holds for one such condition at a time and is where this
 * model stops: two omitted conditions demanding opposite values of the same unpinned feature
 * would both be counted falsifiable when one of them must hold.
 */
const falsifiable = (region, omitted) => {
  const covered = [];
  for (const condition of omitted) {
    /* Only a media query is pinned down by the viewport. A pseudo-class state (`:root` and
       `:hover` both arrive here as conditions) and an `@supports` test are taken to be off
       whenever the context leaves them out, which is what every context did before this
       function existed. Reading them as width-less regions covering every viewport would
       have discarded every context that omits one. */
    if (!/^@media\b/i.test(condition)) continue;
    for (const alternative of alternativesOf(condition)) {
      const where = regionOf([alternative]);
      /* Already impossible on its own, so nothing to switch off. */
      if (where === null) continue;
      /* Off here either way: a feature pinned to something else by the selected conditions,
         or one they leave open and this can choose against. */
      const byFeature = [...where.fixed].some(([name, value]) => region.fixed.get(name) !== value);
      if (byFeature) continue;
      covered.push([Math.max(where.low, region.low), Math.min(where.high, region.high)]);
    }
  }

  const widths = new Set([region.low, region.high]);
  for (const [low, high] of covered) {
    for (const edge of [low - 1, low, low + 1, high - 1, high, high + 1]) {
      if (edge >= region.low && edge <= region.high) widths.add(edge);
    }
  }
  return [...widths].some((width) => covered.every(([low, high]) => width < low || width > high));
};

/*
 * A media query list is an alternation, not a conjunction. Intersecting the bounds of every
 * alternative made `@media (max-width: 749px), (min-width: 750px)` -- which covers every
 * viewport there is -- impossible, so every context holding a rule inside it was discarded
 * and the muting went unmeasured (Codex, #427). Each condition contributes one alternative
 * at a time, and the combination holds if any choice across all of them does.
 */
const satisfiable = (conditions, omitted = []) => {
  const choices = conditions.map(alternativesOf);
  const COMBINATIONS = 4096;
  const total = choices.reduce((count, options) => count * Math.max(1, options.length), 1);
  assert.ok(
    total <= COMBINATIONS,
    `${total} combinations of ${choices.length} media query lists -- too many to enumerate; ` +
      'narrow the conditions rather than letting this run away',
  );

  const walk = (at, picked) => {
    if (at === choices.length) {
      const region = regionOf(picked);
      return region !== null && falsifiable(region, omitted);
    }
    const options = choices[at].length === 0 ? [''] : choices[at];
    return options.some((option) => walk(at + 1, [...picked, option]));
  };
  return walk(0, []);
};

/*
 * A context is one real eyebrow, under one satisfiable combination of qualifiers.
 *
 * The previous shape took the powerset of the ancestors the rules mention, which invents
 * elements: a base-only subset is not a thing that renders when every eyebrow sits under a
 * section root that overrides it, so a perfectly accessible stylesheet failed on a state no
 * page is ever in (Codex, #300). The elements come from the markup instead, and only the
 * qualifiers -- at-rules and states -- are varied.
 */
const contextsFor = (name) => {
  const all = rulesFor(name);
  const ancestries = ancestriesFor(name);
  assert.ok(
    ancestries.length > 0,
    `cannot find .${name} in any section's markup, so there is no way to tell which rules ` +
      'reach it -- the contexts would be invented',
  );

  const out = [];
  for (const entry of ancestries) {
    /* The pages this section appears on. A section on no template still gets one context,
       where only its own inline styles are live. */
    const pages = templates.filter((page) => page.types.has(entry.section));
    const where =
      pages.length > 0 ? pages : [{ file: `${entry.section} alone`, types: new Set([entry.section]) }];

    for (const page of where) {
      const live = (rule) => rule.origin === null || page.types.has(rule.origin);

      const named = all.filter(
        (rule) => live(rule) && matchesPath(rule.path, entry.chain, entry.chain.length - 1),
      );

      /*
       * A rule does not have to name the class to paint the eyebrow. The label is a
       * `<span>`, so `#MainContent span { opacity: .6 }` fades all eleven of them -- and
       * filtering the label's own rules on `.subtitle` discarded it, leaving every test
       * green while the text sat under the contrast bar (Codex, #427).
       *
       * `matchesPath` against the last link in the chain is already the right question, and
       * `matchesElement` never required the class, so the same predicate over `everyRule()`
       * picks these up. Only the two fields `rulesFor` derives from the label compound have
       * to be recovered here.
       */
      const seenSelectors = new Set(named.map((rule) => `${rule.at}:${rule.selector}`));
      /* Only what these tests measure. Pulling in every rule that merely matches a `<span>`
         took ona-sourcing to 56 qualifier sets and tripped the powerset cap -- the model
         refused rather than mis-measuring, which is right, but it also stopped covering the
         case. A rule that sets none of these cannot change any answer here. */
      /* `--color-foreground*` for the same reason it is in AFFECTS_LABEL one block down: a
         rule that selects the label without naming its class and sets only the token was
         dropped here before `substituted` could see it, so `#MainContent span
         { --color-foreground: #fdfbf5 }` left every span eyebrow light on cream with the
         suite green (Codex, #427). */
      const MEASURED =
        /(?:^|;|\s)(?:display|color|opacity|margin|margin-bottom|--color-foreground[\w-]*)\s*:/;
      const unnamed = everyRule()
        .filter(
          (rule) =>
            live(rule) &&
            !seenSelectors.has(`${rule.at}:${rule.selector}`) &&
            !rule.siblings &&
            MEASURED.test(rule.declarations) &&
            matchesPath(rule.path, entry.chain, entry.chain.length - 1),
        )
        .map((rule) => {
          const label = rule.path[rule.path.length - 1].raw;
          assert.ok(
            !/!important/.test(rule.declarations),
            `.${name} is painted with !important through "${rule.selector}", which this ` +
              'cascade model does not resolve -- extend it rather than trusting the result',
          );
          return {
            ...rule,
            label,
            needsFilled: /:not\(\s*:empty\s*\)/.test(label),
            needsEmpty: /:empty/.test(label.replace(/:not\([^)]*\)/g, '')),
          };
        });

      const reaches = [...named, ...unnamed].sort((a, b) => a.weight - b.weight || a.at - b.at);
      if (reaches.length === 0) continue;

      /* Only the ancestor declarations that can reach the label need their own contexts --
       everything else an ancestor sets stays on the ancestor. Without that filter the
       powerset ran to 48 qualifier sets and tripped the cap.

       `opacity` and `color` composite and inherit; a foreground custom property inherits
       too, and leaving it out meant an ancestor that changed only the token inside a media
       query never had that query enumerated, so `ancestorEffects` was never called under it
       and the override went unapplied (Codex, #427). */
      const AFFECTS_LABEL = /(?:^|;|\s)(?:opacity|color|--color-foreground[\w-]*)\s*:/;
      const touching = everyRule().filter(
        (rule) =>
          live(rule) &&
          AFFECTS_LABEL.test(rule.declarations) &&
          entry.chain.slice(0, -1).some((_, at) => matchesPath(rule.path, entry.chain, at)),
      );

      const sets = [];
      const seen = new Set();
      for (const rule of [...reaches, ...touching]) {
        const key = JSON.stringify(rule.conditions);
        if (seen.has(key)) continue;
        seen.add(key);
        sets.push(rule.conditions);
      }
      /* The powerset is exponential, so an unexpectedly branchy stylesheet stops the test
       rather than quietly measuring a subset of the combinations. */
      assert.ok(
        sets.length <= 12,
        `.${name} in ${entry.section} is styled under ${sets.length} distinct qualifier sets, ` +
          'too many to enumerate the combinations of -- narrow the model rather than leaving ' +
          'combinations unchecked',
      );

      const built = new Set();
      for (let mask = 0; mask < 1 << sets.length; mask += 1) {
        const conditions = [...new Set(sets.filter((_, at) => mask & (1 << at)).flat())];
        /* The conditions this context leaves out have to be able to be off here, or the
           context is one the browser never reaches. */
        const omitted = [...new Set(sets.flat())].filter((condition) => !conditions.includes(condition));
        if (!satisfiable(conditions, omitted)) continue;

        const key = JSON.stringify([...conditions].sort());
        if (built.has(key)) continue;
        built.add(key);

        const applicable = reaches.filter((rule) =>
          rule.conditions.every((condition) => conditions.includes(condition)),
        );
        if (applicable.length === 0) continue;

        const fromAbove = ancestorEffects(entry.chain, conditions, live, entry.inlines);

        out.push({
          where: [`${entry.section} on ${page.file}`, ...conditions].join(' inside '),
          section: entry.section,
          page: page.file,
          inline: entry.inline,
          ancestorAlpha: fromAbove.alpha,
          ancestorColour: fromAbove.colour,
          ancestorTokens: fromAbove.tokens,
          filled: applicable.filter((rule) => !rule.needsEmpty),
          empty: applicable.filter((rule) => !rule.needsFilled),
        });
      }
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
        'assets/legacy-page-layout.css selects it, so it renders as plain body copy',
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
          `empty, but in ${context.where} no rule hides it when it is`,
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
          'eyebrow still occupies a line',
      );
    }
  }
});

test('the eyebrow sits on its own line above the heading', () => {
  for (const [name] of labels) {
    assertInlineOrderUnambiguous(name);
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
          `${winner ?? '<unset>'}, and the eyebrow runs into the heading on the same line`,
      );

      /* display:block alone only stops the label sharing a line; it still butts against the
         heading with no gap. The guard this replaced asserted a positive bottom margin and
         this one did not, so `margin: 0 0 14px` -> `margin: 0` passed (Codex, #427).
         Shorthand or longhand, the bottom of the box is what separates the two: in
         `margin: 0 0 14px` that is the third value, in `margin: 0` the only one. */
      const gap = bottomMargin(merge(context.filled, context.inline));
      assert.ok(
        gap,
        `.${name} in ${context.where} declares no bottom margin, so the label butts against ` +
          'the heading',
      );
      assert.ok(
        parseFloat(gap) > 0,
        `.${name} in ${context.where} leaves a bottom margin of "${gap}", so the label butts ` +
          'against the heading',
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
    readFileSync(join(root, 'config/settings_data.json'), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\//, ''),
  ).current;
  const colors = settings.color_palette?.[0]?.settings ?? settings.color_palette ?? {};
  return { background: colors.background, foreground: colors.foreground, all: colors };
})();

/*
 * `snippets/color-palette.liquid` picks --palette-lightest and --palette-darkest by running
 * `color_brightness` over every colour in the palette, so they are resolved the same way here
 * rather than guessed. Shopify's filter is the perceived-brightness weighting.
 */
const paletteExtreme = (which) => {
  const brightness = (hex) => {
    const [r, g, b] = rgb(hex);
    return (r * 299 + g * 587 + b * 114) / 1000;
  };
  const swatches = Object.values(palette.all).filter(
    (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value),
  );
  assert.ok(swatches.length > 0, 'the palette has no colours this can read');
  return swatches.reduce((best, value) =>
    which === 'lightest'
      ? brightness(value) > brightness(best)
        ? value
        : best
      : brightness(value) < brightness(best)
        ? value
        : best,
  );
};

/* The section types that render one of the derived eyebrows. */
const eyebrowed = new Set([...labels.values()].flatMap((sections) => [...sections]));

/*
 * Every ground an eyebrow is read on, each tagged with the section instance it belongs to.
 *
 * A band is painted on its own section's wrapper, so it is behind that section's eyebrow and
 * nobody else's. Measuring every label against every band failed an accessible colour:
 * `#6d6d6d` scoped to `ona-wholesale-partnership` is 4.64:1 on the page background it
 * actually sits on, and was rejected at 4.09:1 against `wholesale_sourcing_v2`'s sand band,
 * a ground that eyebrow never occupies (Codex, #427). The page background keeps `section:
 * null` and is read under every label, which is the cheap guard for a band setting being
 * cleared.
 */
const grounds = () => {
  const found = new Map([
    ['the page background', { colour: palette.background, section: null, file: null }],
  ]);
  for (const file of readdirSync(join(root, 'templates'))) {
    if (!file.endsWith('.json')) continue;
    let parsed;
    try {
      parsed = JSON.parse(
        readFileSync(join(root, 'templates', file), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\//, ''),
      );
    } catch {
      continue;
    }
    for (const [key, section] of Object.entries(parsed.sections ?? {})) {
      /* Only sections that render an eyebrow. The band setting is being renamed to Horizon's
         own `background_color` on a separate branch (#307), and the two can land in either
         order -- so this reads both ids. But `background_color` is Horizon's id too, and 256
         Horizon-native sections across these templates already carry it; keying on the name
         alone would measure the label against grounds it never sits on. The section type is
         what says whether it does. */
      if (!eyebrowed.has(section.type)) continue;
      const band = section.settings?.background_color ?? section.settings?.band_background;
      if (typeof band === 'string' && /^#[0-9a-f]{6}$/i.test(band))
        found.set(`${file} ${key}`, { colour: band, section: section.type, file });
    }
  }
  return [...found].map(([name, rest]) => ({ name, ...rest }));
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

/*
 * The bottom margin, resolved as one property.
 *
 * `margin` and `margin-bottom` both write it, so taking the last value of each independently
 * and preferring the longhand read `margin-bottom: 14px; margin: 0` as a 14px gap when the
 * browser computes zero (Codex, #427). Both forms are walked in declaration order instead,
 * and the last write wins whichever form it came in.
 */
const bottomMargin = (declarations) => {
  let value = null;
  for (const [, property, raw] of declarations.matchAll(
    /(?:^|;)\s*(margin|margin-bottom)\s*:\s*([^;]+)/g,
  )) {
    const text = raw.trim();
    if (property === 'margin-bottom') {
      value = text;
      continue;
    }
    /* In the shorthand the bottom is the third value, or the first when fewer are given.
       Two values are block/inline, so the block one is the bottom as well as the top. */
    const parts = text.split(/\s+/);
    value = parts.length >= 3 ? parts[2] : parts[0];
  }
  return value;
};

/* One `color` value, resolved on its own. `alpha` is the factor the value contributes, which
   the element's own `opacity` multiplies rather than replaces. */
const colourValue = (value) => {
  let alpha = 1;

  /* The shortcut is for a value that *is* a colour, not one that contains one. Unanchored, the
     hex inside `color-mix(in srgb, #470a12 60%, transparent)` came back as an opaque colour
     and the 60% went missing entirely (Codex, #427). `#fff` is in the theme, so the short
     form resolves too; anything longer or stranger falls through to the resolvers below and
     to the explicit failure at the end if none of them knows it. */
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1];
    return {
      alpha,
      literal: [0, 2, 4].map((at) => parseInt(digits.slice(at, at + 2), 16)),
      how: value,
    };
  }

  /* `color-mix()` blends two colours and can thin either of them with a percentage. Reading
     one argument out of it and calling that the answer is exactly how the hex shortcut went
     wrong, and `color-mix(in srgb, currentColor 60%, transparent)` would reach the inherited
     branch below by the same trick. Refuse it by name until there is a resolver for it. */
  assert.ok(
    !/\bcolor-mix\s*\(/i.test(value),
    `cannot read the eyebrow's colour from "${value}" -- color-mix() needs a resolver of its ` +
      'own, not one of its arguments read in isolation',
  );

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
          'treating the label as fully opaque',
      );
    }
  } else {
    if (/--opacity-muted-text/.test(value)) alpha *= opacityToken('muted');
    if (/--opacity-subdued-text/.test(value)) alpha *= opacityToken('subdued');
  }
  if (/--color-foreground-muted/.test(value)) alpha *= opacityToken('muted');
  if (/--color-foreground-subdued/.test(value)) alpha *= opacityToken('subdued');

  /* `--palette-lightest` and `--palette-darkest` name one fixed colour each. Reading them as
     inherited let the contrast test pick whichever palette extreme suited each ground, so
     `color: var(--palette-lightest)` passed against the cream page it is invisible on
     (Codex, #427). `contrast-override.liquid:61` emits `var(--palette-darkest)` in real theme
     code, so these have to resolve, not be rejected. */
  const extreme = value.match(/--palette-(darkest|lightest)(?![\w-])/);
  if (extreme) {
    return { alpha, literal: rgb(paletteExtreme(extreme[1])), how: value };
  }

  const inherits =
    /currentColor|inherit|--color-foreground(?![\w-])|--color-foreground-rgb|--color-foreground-muted|--color-foreground-subdued/.test(
      value,
    );
  assert.ok(
    inherits,
    `cannot work out what colour the eyebrow is painted in from "${value}" -- extend this ` +
      'resolver rather than leaving the contrast unchecked',
  );
  return { alpha, literal: null, how: value };
};

/* A value that is nothing but `inherit` or `currentColor` -- `color: currentColor` computes to
   the inherited colour, same as `color: inherit`. Either way the element takes what the
   cascade above already worked out, down to its alpha; it is not a colour of its own. */
const FOREGROUND_TOKEN = /--color-foreground(?:-rgb|-muted|-subdued)?(?![\w-])/g;

/*
 * A colour value with the foreground tokens it references resolved against definitions on the
 * same element.
 *
 * `colourValue` reads `var(--color-foreground)` as "whatever the cascade above painted", and
 * that reading only holds while nothing nearer redefines the token. A rule that sets
 * `--color-foreground` on the element itself wins over every definition further up, so the
 * element is painted in that value and not in the inherited one -- and the contrast test was
 * measuring a colour nothing on the page is painted in (Codex, #427). The theme does redefine
 * these tokens, in header.liquid, ona-band.liquid, color-palette.liquid and four more, so a
 * blanket rejection is not an option; a literal is substituted and anything else fails loudly.
 */
const substituted = (declarations, text, inherited = new Map()) => {
  let out = text;
  for (const token of new Set(text.match(FOREGROUND_TOKEN) ?? [])) {
    /* Nearest definition wins: the element's own, then the closest ancestor that set it.
       Custom properties inherit, so a definition on an ancestor reaches the label whether or
       not that ancestor paints itself with it -- looking only at the element's own
       declarations left `#MainContent { --color-foreground: #fdfbf5 }` passing while every
       eyebrow rendered cream on cream (Codex, #427). */
    const override = lastValue(declarations, token) ?? inherited.get(token) ?? null;
    if (override === null) continue;

    /* `x` is what a `{{ ... }}` interpolation flattens to, so a value carrying one is the
       theme computing the colour rather than a literal override: `ona-band.liquid` writes
       `--color-foreground: {{ band_text }}` and `color-palette.liquid` writes
       `{{ settings.page_text_color }}`, 132 of them reaching a label between them. Those are
       the band mechanism this test already models optimistically -- the snippet picks the
       palette extreme that contrasts best with its band -- so the inherited reading stands
       for them, and only a literal override has to be resolved or refused. */
    if (/(?:^|[^\w-])x(?:[^\w-]|$)/.test(override)) continue;
    assert.ok(
      token === '--color-foreground' && /^#[0-9a-f]{6}$/i.test(override),
      `"${text}" is read as the colour inherited from above, but ${token} is set to ` +
        `${override} on the label or an ancestor, which wins over every definition further ` +
        'up -- resolve that override here rather than measuring a colour nothing is painted in',
    );
    out = out.replace(new RegExp(`var\\(\\s*${token}\\s*\\)`, 'g'), override);
    assert.ok(
      !new RegExp(`${token}(?![\\w-])`).test(out),
      `${token} is overridden to ${override} on the same element, but "${text}" does not ` +
        'reference it in a form this can substitute -- extend the substitution rather than ' +
        'falling back on the inherited reading',
    );
  }
  return out;
};

const RESTATES_INHERITANCE = /^(?:inherit|currentcolor)$/i;

const painted = (declarations, inheritedColour = null, inheritedTokens = new Map()) => {
  /* An element's own opacity multiplies whatever colour it ends up with. A value this cannot
     read -- `opacity: var(--opacity-muted-text)` -- used to fall through to alpha 1 and report
     the label as fully opaque, so an opacity present and unresolved now fails (Codex, #300). */
  const faded = lastValue(declarations, 'opacity');
  let opacity = 1;
  if (faded) {
    const literal = faded.match(/^([0-9.]+)%?$/);
    assert.ok(
      literal,
      `cannot read the eyebrow's opacity from "${faded}" -- extend this resolver ` +
        'rather than treating the label as fully opaque',
    );
    opacity = faded.includes('%') ? Number(literal[1]) / 100 : Number(literal[1]);
  }

  /*
   * The inherited colour is kept apart from the label's own declarations, which are then
   * walked in order with the last one winning.
   *
   * `inherit` and `currentColor` are not a colour of their own and not a no-op either: they
   * are the element taking what the cascade above computed, and they override anything the
   * label said earlier. Concatenating the ancestor's colour in front and taking the last
   * value read `color: inherit` as no colour at all -- so a white-on-cream eyebrow at 1.08:1
   * was measured against whichever palette extreme suited each ground. Skipping it instead
   * kept a local `color` the `inherit` had already overridden, which is the same mistake
   * with a different wrong answer (Codex, #427, twice).
   */
  const inherited = inheritedColour === null
    ? { alpha: 1, literal: null, how: 'inherited' }
    : colourValue(inheritedColour);

  let resolved = inherited;
  for (const [, value] of declarations.matchAll(/(?:^|;)\s*color\s*:\s*([^;]+)/g)) {
    const text = value.trim();
    resolved = RESTATES_INHERITANCE.test(text) ? inherited : colourValue(substituted(declarations, text, inheritedTokens));
  }

  return { alpha: opacity * resolved.alpha, literal: resolved.literal, how: resolved.how };
};

test('the eyebrow clears 4.5:1 on every ground it is used on', () => {
  assert.ok(palette.foreground && palette.background, 'cannot read the palette');
  const where = grounds();
  /* A band read under neither id leaves this measuring the page background alone and passing
     for it -- the silent way for a rename to take the coverage with it. */
  assert.ok(
    where.length > 1,
    'no template declares a band colour, so this is measuring the page background and nothing else'
  );

  /* Scoping each label to its own section's bands is only an improvement while every band
     still has a label reading it. If the filter stopped matching -- a section renamed, a
     chain that no longer carries the section -- each context would fall back to the page
     background and the band coverage would go with it, silently. The assertion after the
     loop names the bands nobody read. */
  const read = new Set();

  for (const [name] of labels) {
    assertInlineOrderUnambiguous(name);
    const contexts = contextsFor(name);
    assert.ok(contexts.length > 0, `no rule paints .${name}`);

    /* One resolution per context rather than a walk over every rule: a context is a real
       element state, so the declaration that wins there is what the reader sees. Resolving
       them all together let a rule for one section mask a regression in another, and walking
       them in sequence failed on states no element is ever in (Codex, #300). */
    for (const context of contexts) {
      if (context.filled.length === 0) continue;
      /* The ancestor's colour goes first so the label's own declaration still wins, and its
         opacity multiplies rather than merging -- `opacity` composites, it does not
         inherit. */
      const { alpha, literal, how } = painted(
        merge(context.filled, context.inline),
        context.ancestorColour || null,
        context.ancestorTokens,
      );
      const effective = alpha * context.ancestorAlpha;

      /* Only the grounds this eyebrow is actually read on: the page background, plus the
         bands configured on its own section on its own page. */
      const under = where.filter(
        (ground) =>
          ground.section === null ||
          (ground.section === context.section && ground.file === context.page),
      );
      for (const ground of under) if (ground.section !== null) read.add(ground.name);

      for (const { name: ground_name, colour: ground } of under) {
        const ink = rgb(ground);
        /* Inherited, the eyebrow takes the section's foreground, and the band snippet has
           already chosen the palette extreme that contrasts best with the band. */
        const inherited = [palette.foreground, palette.background]
          .map(rgb)
          .sort((a, b) => contrast(b, ink) - contrast(a, ink))[0];
        const ratio = contrast(over(literal ?? inherited, ink, effective), ink);
        assert.ok(
          ratio >= 4.5,
          `${ground_name} is ${ground}, and .${name} in ${context.where} ` +
            `(${how}${effective < 1 ? ` at ${effective} opacity` : ''}) lands at ` +
            `${ratio.toFixed(2)}:1 on it -- under 4.5:1`,
        );
      }
    }
  }

  assert.deepEqual(
    where.filter((ground) => ground.section !== null && !read.has(ground.name)).map((ground) => ground.name),
    [],
    'these bands have an eyebrow configured on them but no context read the label against ' +
      'one -- the per-section ground filter is matching less than it should',
  );
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
