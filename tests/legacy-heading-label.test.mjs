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
        out.push({
          origin: dir === 'sections' ? file.slice(0, -'.liquid'.length) : null,
          text: liquid(body),
        });
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
        /* Nested CSS: `a { color: red; &[x] { color: blue } }`. Treating the whole body as
           the parent's declarations would attribute the nested rule's colour to the parent. */
        const nested = inner.indexOf('{');
        if (nested === -1) {
          order += 1;
          out.push({
            conditions,
            selectorList: prelude,
            declarations: inner,
            at: order,
          });
        } else {
          const own = inner.slice(0, inner.lastIndexOf(';', nested) + 1);
          order += 1;
          out.push({
            conditions,
            selectorList: prelude,
            declarations: own,
            at: order,
          });
          walk(inner.slice(own.length).replace(/&/g, prelude.trim()), conditions);
        }
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
      const parts = pathOf(branch);
      if (parts.length === 0) continue;
      found.push({
        selector: branch.trim().replace(/\s+/g, ' '),
        declarations,
        path: parts.map((part) => ({
          ...part,
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
const ancestorEffects = (chain, conditions, live) => {
  let alpha = 1;
  let colour = null;

  for (let index = 0; index < chain.length - 1; index += 1) {
    const applicable = everyRule().filter(
      (rule) =>
        live(rule) &&
        rule.conditions.every((condition) => conditions.includes(condition)) &&
        matchesPath(rule.path, chain, index),
    );
    if (applicable.length === 0) continue;

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

    const body = merge(applicable);
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
    const declared = lastValue(body, 'color');
    if (declared !== null) colour = declared;
  }
  return { alpha, colour };
};

const rulesFor = (name) => {
  const escaped = name.replace(/-/g, '\\-');
  const target = new RegExp(`\\.${escaped}(?![\\w-])`);
  const found = [];
  for (const { conditions, selectorList, declarations, at, origin } of flat) {
    for (const branch of splitSelectors(selectorList)) {
      if (!target.test(branch)) continue;
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
         (Codex, #300). A state is a qualifier like an at-rule, so it joins them. */
      const states = statesOf(label);

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
            new Set(['#MainContent']),
            ...open.map(
              (entry) => new Set([entry.element, ...entry.classes.map((c) => `.${c}`), ...entry.attrs])
            ),
            new Set([element, ...classes.map((c) => `.${c}`), ...attrs]),
          ],
          inline: attributes.match(/style="([^"]*)"/)?.[1] ?? '',
          section: file.slice(0, -'.liquid'.length),
        });
      }
      if (!VOID_TAGS.has(element) && !/\/\s*$/.test(attributes)) open.push({ element, classes, attrs });
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
const statesOf = (compound) =>
  (
    compound
      .replace(/:(?:is|where|not)\([^)]*\)/gi, '')
      .replace(/:empty\b/gi, '')
      .match(/::?[a-z-]+(?:\([^)]*\))?/gi) ?? []
  ).map((state) => state.toLowerCase());

/* A compound with its state pseudos removed, leaving what identifies the element. */
const structural = (compound) =>
  compound.replace(/:empty\b/gi, '').replace(/:(?!is\(|where\(|not\()[a-z-]+(?:\([^)]*\))?/gi, '');

/* Bare element names in a compound. Without these, `text-component { color: transparent }`
   -- a selector with no class or id at all -- matched every ancestor, because a compound
   with no parts vacuously satisfied every one of them. */
const tagsOf = (text) =>
  (text.replace(/[#.][\w-]+|\[[^\]]*\]|::?[a-z-]+(?:\([^)]*\))?|&/gi, ' ').match(/[a-z][\w-]*/gi) ?? []).map(
    (tag) => tag.toLowerCase(),
  );

const matchesElement = (compound, element) => {
  const anyOf = [...compound.matchAll(/:(?:is|where)\(([^)]*)\)/gi)];
  const noneOf = [...compound.matchAll(/:not\(([^)]*)\)/gi)];
  const bare = compound.replace(/:(?:is|where|not)\([^)]*\)/gi, '');

  return (
    (bare.match(/\[[^\]]*\]/g) ?? [])
      .map((token) =>
        token.replace(
          /\[\s*([\w-]+)\s*(?:([~^|$*]?=)\s*["']?([^\]"']*)["']?\s*)?\]/,
          (whole, key, operator, value) =>
            operator === '=' ? `[${key}="${value}"]` : operator ? whole : `[${key}]`
        )
      )
      .every((token) => element.has(token)) &&
    partsOf(bare).every((part) => element.has(part)) &&
    tagsOf(bare).every((tag) => element.has(tag)) &&
    anyOf.every((match) =>
      splitSelectors(match[1]).some((branch) => partsOf(branch).every((part) => element.has(part))),
    ) &&
    noneOf.every((match) =>
      splitSelectors(match[1]).every((branch) => !partsOf(branch).every((part) => element.has(part))),
    )
  );
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
  const tokens = branch.trim().match(/[>+~]|(?:[^\s>+~(]+(?:\([^)]*\))?)+/g) ?? [];
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

const satisfiable = (conditions) => {
  let low = 0;
  let high = Infinity;
  const fixed = new Map();

  for (const condition of conditions) {
    for (const [, bound, feature, value] of condition.matchAll(
      /\(\s*(?:(min|max)-)?([a-z-]+)\s*:\s*([^)]+)\)/gi,
    )) {
      const name = feature.toLowerCase();
      if (name === 'width' && bound) {
        const pixels = Number(
          String(value)
            .replace(/px\s*$/i, '')
            .trim(),
        );
        /* A width this cannot read is a width this cannot intersect. */
        if (Number.isNaN(pixels)) return false;
        if (bound.toLowerCase() === 'min') low = Math.max(low, pixels);
        else high = Math.min(high, pixels);
        continue;
      }
      /* One feature cannot hold two values at once. This is how portrait and landscape are
         kept apart without naming either: `satisfiable` only understood widths, so two
         orientation rules were multiplied into a viewport that cannot exist (Codex, #300). */
      const normalised = String(value).trim().toLowerCase();
      const seen = fixed.get(name);
      if (seen !== undefined && seen !== normalised) return false;
      fixed.set(name, normalised);
    }
  }
  return low <= high;
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

      const reaches = all.filter(
        (rule) => live(rule) && matchesPath(rule.path, entry.chain, entry.chain.length - 1),
      );
      if (reaches.length === 0) continue;

      /* Only the two ancestor declarations that can reach the label need their own contexts --
       everything else an ancestor sets stays on the ancestor. Without that filter the
       powerset ran to 48 qualifier sets and tripped the cap. */
      const AFFECTS_LABEL = /(?:^|;|\s)(?:opacity|color)\s*:/;
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
        if (!satisfiable(conditions)) continue;

        const key = JSON.stringify([...conditions].sort());
        if (built.has(key)) continue;
        built.add(key);

        const applicable = reaches.filter((rule) =>
          rule.conditions.every((condition) => conditions.includes(condition)),
        );
        if (applicable.length === 0) continue;

        const fromAbove = ancestorEffects(entry.chain, conditions, live);

        out.push({
          where: [`${entry.section} on ${page.file}`, ...conditions].join(' inside '),
          inline: entry.inline,
          ancestorAlpha: fromAbove.alpha,
          ancestorColour: fromAbove.colour,
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
      const declared = merge(context.filled, context.inline);
      const shorthand = lastValue(declared, 'margin');
      const longhand = lastValue(declared, 'margin-bottom');
      const parts = shorthand ? shorthand.trim().split(/\s+/) : null;
      const gap = longhand ?? (parts ? (parts[2] ?? parts[0]) : null);
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

const grounds = () => {
  const found = new Map([['the page background', palette.background]]);
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
        'rather than treating the label as fully opaque',
    );
    alpha = faded.includes('%') ? Number(literal[1]) / 100 : Number(literal[1]);
  }

  const value = lastValue(declarations, 'color');
  if (value === null) return { alpha, literal: null, how: 'inherited' };

  const hex = value.match(/#([0-9a-f]{6})\b/i);
  if (hex)
    return {
      alpha,
      literal: [1, 3, 5].map((at) => parseInt(`#${hex[1]}`.slice(at, at + 2), 16)),
      how: value,
    };

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

test('the eyebrow clears 4.5:1 on every ground it is used on', () => {
  assert.ok(palette.foreground && palette.background, 'cannot read the palette');
  const where = grounds();
  /* A band read under neither id leaves this measuring the page background alone and passing
     for it -- the silent way for a rename to take the coverage with it. */
  assert.ok(
    where.length > 1,
    'no template declares a band colour, so this is measuring the page background and nothing else'
  );

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
        `${context.ancestorColour ? `color:${context.ancestorColour};` : ''}` +
          merge(context.filled, context.inline),
      );
      const effective = alpha * context.ancestorAlpha;

      for (const [ground_name, ground] of where) {
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
