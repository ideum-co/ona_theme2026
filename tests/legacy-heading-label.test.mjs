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
  /*
   * With the page condition the layout loads it under, because an asset inside
   * `{% if request.page_type == 'index' %}` is not on any other page. Read as
   * unconditional, `home-mobile-overflow.css` restored an `opacity: 1` over a faded
   * `base.css` rule on every page -- all five tests green while `/pages/wholesale`, which
   * never loads that sheet, kept the faded eyebrow at 4.42:1 (Codex, #427).
   *
   * Only `request.page_type` equality is read. Any other condition around a stylesheet tag
   * is refused below rather than flattened away, because flattening is the failure this is
   * fixing.
   */
  const loaded = [];
  const scopeOf = new Map();
  for (const file of ['snippets/stylesheets.liquid', 'layout/theme.liquid']) {
    let source;
    try {
      source = readFileSync(join(root, file), 'utf8');
    } catch {
      continue;
    }
    const open = [];
    const lists = new Map();
    const TAG =
      /\{%-?\s*(if|elsif|else|endif|unless|endunless|assign)\b([^%]*?)-?%\}|'([\w.-]+\.css)'\s*\|\s*asset_url\s*\|\s*stylesheet_tag/g;
    for (const found of source.matchAll(TAG)) {
      const [, keyword, rest, asset] = found;

      if (asset !== undefined) {
        /* An asset under no condition is global; one under conditions this can read keeps
           them. Loaded twice under different conditions, or conditionally beside a global
           load, it is global -- the wider reading, which is the safe direction for a sheet
           that restores a value. */
        assert.ok(
          !open.includes(false),
          `"${asset}" is loaded in ${file} under a condition this scan cannot read -- teach ` +
            'it that condition rather than treating the sheet as loaded on every page',
        );
        const scope = open.filter((condition) => condition !== null);
        const key = JSON.stringify(scope);
        if (!loaded.includes(asset)) {
          loaded.push(asset);
          scopeOf.set(asset, scope);
        } else if (JSON.stringify(scopeOf.get(asset)) !== key) {
          scopeOf.set(asset, []);
        }
        continue;
      }

      const word = keyword.toLowerCase();
      if (word === 'assign') {
        /* `{% assign legacy_page_suffixes = 'about,wholesale' | split: ',' %}` -- the only
           shape the suffix test below reads. */
        const split = /^\s*([\w-]+)\s*=\s*'([^']*)'\s*\|\s*split:\s*'([^']*)'\s*$/.exec(rest ?? '');
        if (split) lists.set(split[1], split[2].split(split[3]).map((item) => item.trim()));
        continue;
      }
      if (word === 'endif' || word === 'endunless') {
        open.pop();
        continue;
      }

      /*
       * The two shapes this layout actually uses. `request.page_type` and `template.name`
       * are the same thing for the templates here -- `page.wholesale.json` is a `page` --
       * and `<list> contains template.suffix` is how the legacy sheet is held to the
       * templates that were migrated.
       */
      const body = rest ?? '';
      const named = /^\s*(?:request\.page_type|template\.name)\s*==\s*'([\w-]+)'\s*$/.exec(body);
      const suffixed = /^\s*([\w-]+)\s+contains\s+template\.suffix\s*$/.exec(body);
      let condition = false;
      if (word === 'if' && named !== null) condition = { name: named[1] };
      else if (word === 'if' && suffixed !== null && lists.has(suffixed[1])) {
        condition = { suffix: lists.get(suffixed[1]) };
      }
      if (word === 'if' || word === 'unless') open.push(word === 'if' ? condition : false);
      else if (open.length > 0) open[open.length - 1] = false;
    }
  }

  const out = loaded.map((asset) => ({
    origin: null,
    scope: scopeOf.get(asset) ?? [],
    text: decomment(readFileSync(join(root, 'assets', asset), 'utf8')),
  }));

  const liquid = (text) =>
    decomment(text)
      .replace(/\{%-?[\s\S]*?-?%\}/g, ' ')
      .replace(/\{\{[\s\S]*?\}\}/g, 'x');

  /*
   * Two buckets, not one. Shopify concatenates every `{% stylesheet %}` into one asset
   * loaded in the head, while a `{% style %}` renders inline where its section does, in the
   * body -- so every bundled declaration precedes every inline one no matter which file
   * either came from. Pushing both into one list in `readdirSync` order gave a bundled
   * block from a later-scanned file the later source order, which is the opposite of the
   * browser's: a partnership `{% style %}` setting `opacity: .6` against a snippet
   * `{% stylesheet %}` setting `opacity: 1` left all five tests green while the real page
   * faded those labels (Codex, #427).
   */
  const bundled = [];
  const inline = [];

  for (const dir of ['sections', 'snippets']) {
    for (const file of readdirSync(join(root, dir))) {
      if (!file.endsWith('.liquid')) continue;
      const source = readFileSync(join(root, dir, file), 'utf8');

      /* Shopify concatenates every `{% stylesheet %}` into one asset served on every page,
         so these are global whether or not the section renders. */
      for (const [, body] of source.matchAll(
        /\{%-?\s*stylesheet[^%]*-?%\}([\s\S]*?)\{%-?\s*endstylesheet\s*-?%\}/g,
      )) {
        bundled.push({ origin: null, text: liquid(body) });
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
        inline.push({ origin, text: liquid(scoped) });
      }
    }
  }

  out.push(...bundled, ...inline);
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
  let rest = '';
  let ids = 0;
  let classes = 0;
  let elements = 0;

  /* Scanned outermost first, with balanced arguments. Matching the innermost function and
     working outwards banked its weight before the function around it had a say, so the `#id`
     in `:where(:is(#MainContent))` was counted although the `:where()` discards everything
     inside it -- and a rule with no id at all outranked one that should have beaten it
     (Codex, #427). */
  for (let at = 0; at < selector.length; at += 1) {
    const found = /^:(is|where|not|has)\(/i.exec(selector.slice(at));
    if (found === null) {
      rest += selector[at];
      continue;
    }

    const open = at + found[0].length - 1;
    let depth = 0;
    let close = open;
    for (; close < selector.length; close += 1) {
      if (selector[close] === '(') depth += 1;
      else if (selector[close] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    const inner =
      found[1].toLowerCase() === 'where'
        ? 0
        : Math.max(
            0,
            ...splitSelectors(selector.slice(open + 1, Math.min(close, selector.length))).map((branch) =>
              specificity(branch),
            ),
          );
    ids += Math.floor(inner / 10000);
    classes += Math.floor((inner % 10000) / 100);
    elements += inner % 100;
    rest += ' ';
    at = close;
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
      : /* `&` carries the specificity of the parent list's most specific branch, not of the
           branch that happened to match -- the cascade works as if the whole list sat there
           inside an `:is()`, which is exactly what is written here. Expanding each branch
           separately gave `.subtitle, #never#matches { & { opacity: .6 } }` the weight of
           `.subtitle` alone, and a later one-class rule masked it (Codex, #427). An earlier
           version substituted the list as one raw string, which put the nested suffix on its
           last branch only. */
        ((root) =>
          branchesOf(selectorList)
            .map((branch) => (branch.includes('&') ? branch.replace(/&/g, root) : `${root} ${branch}`))
            .join(', '))(branchesOf(parent).length > 1 ? `:is(${parent.trim()})` : parent.trim());

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
  .flatMap((sheet) =>
    flatten(sheet.text).map((rule) => ({
      ...rule,
      origin: sheet.origin,
      scope: sheet.scope ?? [],
    })),
  )
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
  for (const { conditions, selectorList, declarations, at, origin, scope } of flat) {
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
        conditions,
        states: statesIn(parts),
        weight: specificity(branch),
        at,
        origin,
        scope,
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
        conditionsAt(rule, chain.length, index).every((condition) => conditions.includes(condition)) &&
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
    /* The same refusal for the ancestor's own `style=""`. The guard above read stylesheet
       rules only, so `style="opacity:.6 !important;opacity:1"` on the partnership wrapper
       passed all five tests while the browser keeps 0.6 and the eyebrow falls to 4.42:1;
       `lastValue` takes the last declaration and importance is what decides it (Codex,
       #427). The plain `style="opacity:.6"` control failed, which is the asymmetry. */
    assert.ok(
      !/!important/.test(inline),
      `an ancestor of the label carries !important in its style="" ("${inline.trim()}"), ` +
        'which this cascade model does not resolve -- extend it rather than trusting the result',
    );

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
  for (const { conditions, selectorList, declarations, at, origin, scope } of flat) {
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
      /* Through `holdsEmpty`, so an alternation is read as one: `.subtitle:is(.subtitle,
         :empty)` matches a label with text, and classifying it empty-only dropped the rule
         from every populated context -- it passed all five tests while the plain `.subtitle`
         spelling failed at 4.42:1 (Codex, #427). The ancestor side got this in round
         twenty-four; the label side is the same question one element along.
         `needsFilled` keeps its own reading, which is not what was reported. */
      const needsEmpty = holdsEmpty(label);
      /* Anything else on the label -- `:hover`, `:focus-visible`, `:first-child`, `::before`
         -- only holds in that state, and treating such a rule as always applying let
         `.subtitle:hover { display: block }` mask a default-state `display: inline`
         (Codex, #300). A state is a qualifier like an at-rule, so it joins them.

         Read from the whole branch, not the label compound: a state on an ancestor holds the
         rule back just as one on the label does, and `structural()` strips it from the
         matching path, so reading only the label left `.text:hover .subtitle { opacity: 1 }`
         unconditional and the non-hovered cascade under it was never measured (Codex, #427).
         everyRule() already reads the branch; this is the same rule in the named path. */
      const states = statesIn(parts);

      found.push({
        selector: branch.trim().replace(/\s+/g, ' '),
        declarations,
        label: structural(label),
        path: parts.map((part) => ({
          ...part,
          raw: part.compound,
          compound: structural(part.compound),
        })),
        conditions,
        states,
        needsEmpty,
        needsFilled,
        weight: specificity(branch),
        at,
        origin,
        scope,
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
/*
 * The `style` attribute, however it is quoted. Only the double-quoted form was read, so
 * `style='opacity:.6'` on the partnership wrapper recorded no declarations at all and
 * slipped past both the cascade and the background guard with all five tests green, while
 * the same markup with double quotes failed at 4.42:1 (Codex, #427). HTML allows single
 * quotes and, for a value without spaces, none; all three are read here so equivalent
 * markup gets equivalent checking. Anchored on a boundary so `data-style="..."` is not
 * mistaken for it.
 */
const inlineStyle = (attributes) =>
  attributes.match(/(?:^|\s)style\s*=\s*"([^"]*)"/i)?.[1] ??
  attributes.match(/(?:^|\s)style\s*=\s*'([^']*)'/i)?.[1] ??
  attributes.match(/(?:^|\s)style\s*=\s*([^\s"'>]+)/i)?.[1] ??
  '';

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

/*
 * What `html`, `body` and `main` carry in their own `style` attributes, parallel to
 * LAYOUT_CHAIN. These three were filled in as empty strings, so an inline style on the
 * layout was invisible to both the ancestor cascade and the background guard:
 * `style="opacity:.6"` on the existing `<main>` left all five tests green while every
 * unbanded eyebrow fell under the bar (Codex, #427). The section ancestors got their
 * inline styles in an earlier round; these are the three above them.
 */
const LAYOUT_INLINES = (() => {
  const source = readFileSync(join(root, 'layout', 'theme.liquid'), 'utf8');
  return ['html', 'body', 'main'].map((tag) =>
    inlineStyle(source.match(new RegExp(`<${tag}\\b([^>]*)>`))?.[1] ?? ''),
  );
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
            ...LAYOUT_INLINES,
            '',
            ...open.map((entry) => entry.inline),
            inlineStyle(attributes),
          ],
          inline: inlineStyle(attributes),
          section: file.slice(0, -'.liquid'.length),
        });
      }
      if (!VOID_TAGS.has(element) && !/\/\s*$/.test(attributes))
        open.push({
          element,
          classes,
          attrs,
          inline: inlineStyle(attributes),
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
/*
 * A compound split into its top-level `:is()`, `:where()` and `:not()` functions and the text
 * left over, with balanced arguments.
 *
 * Every reader here used to find these with `\([^)]*\)`, which stops at the first `)` and so
 * mistakes a nested function for a top-level one. `:not(:is(#nowhere))` was read as carrying
 * a positive `:is(#nowhere)` on the same element, and the whole rule stopped matching -- it
 * left an `opacity: 1` override unapplied and the failing 0.6 below it standing (Codex,
 * #427, found in `specificity` and sitting in the matcher too).
 */
const functionalsOf = (compound) => {
  const parts = [];
  let bare = '';
  for (let at = 0; at < compound.length; at += 1) {
    const found = /^:(is|where|not)\(/i.exec(compound.slice(at));
    if (found === null) {
      bare += compound[at];
      continue;
    }
    const open = at + found[0].length - 1;
    let depth = 0;
    let close = open;
    for (; close < compound.length; close += 1) {
      if (compound[close] === '(') depth += 1;
      else if (compound[close] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    parts.push({ name: found[1].toLowerCase(), inner: compound.slice(open + 1, Math.min(close, compound.length)) });
    bare += ' ';
    at = close;
  }
  return { parts, bare };
};

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
  const { parts, bare } = functionalsOf(compound);
  const nested = parts
    .filter((part) => part.name !== 'not' && PSEUDO_IN_ARGUMENT.test(part.inner))
    .map((part) => `:${part.name}(${part.inner})`);
  const direct = bare.replace(/:empty\b/gi, '').match(/::?[a-z-]+(?:\([^)]*\))?/gi) ?? [];
  return [...nested, ...direct].map((state) => state.toLowerCase().replace(/\s+/g, ''));
};

/*
 * The same states, each tagged with the element it sits on.
 *
 * Reduced to the bare string, an ancestor's `:hover` and the label's `:hover` are one
 * condition, so the powerset can only turn them on together and the state that matters --
 * wrapper hovered, eyebrow not -- is never built. `.text:hover .subtitle { opacity: .6 }`
 * under `.text .subtitle:hover { opacity: 1 }` passed all five tests while the browser
 * fades the label whenever the pointer is in the wrapper but off the text (Codex, #427).
 *
 * Depth from the end of the branch is the identity, which is the same footing `matchesPath`
 * walks the chain on: the label is 0, its parent 1. Two different ancestors at the same
 * depth still share a condition, so this separates the states the model can tell apart
 * rather than claiming to tell all of them apart.
 */
const statesIn = (parts) => {
  const out = [];
  parts.forEach((part, index) => {
    const depth = parts.length - 1 - index;
    for (const state of statesOf(part.compound)) out.push({ depth, state });
  });
  return out;
};

/*
 * A rule's conditions as they stand against one position in the chain.
 *
 * Depth alone is not an identity. A rule whose last compound is the label and one that
 * targets an ancestor directly both call their last compound depth 0, so
 * `.text:hover { color: #f4f3e9 }` and `.subtitle:hover { color: #470a12 }` came out
 * holding the same condition: the powerset switched them on together, the label's override
 * was always present with the ancestor's, and the state the browser really has -- pointer
 * in the wrapper, off the eyebrow -- was never built. All five tests passed (Codex, #427).
 *
 * Anchoring to the chain index the rule is matched at fixes that and merges what should
 * merge: `.text:hover` matched on the wrapper and `.text:hover .subtitle` matched on the
 * label both name the wrapper, because both are hovering the same element.
 *
 * Exact for the matched compound. A descendant combinator above it can match further up
 * than `endIndex - depth`, so those names remain the approximation the previous round
 * already documented -- two ancestors the model cannot tell apart still share a condition.
 *
 * This costs enumeration, and it is meant to: contexts go from 88 to 176 and the widest
 * qualifier set from 2 to 3, against a cap of 12. The extra contexts are exactly the
 * combinations that used to collapse -- an ancestor's state on while the label's is off --
 * so the growth is the coverage this fix exists to add, not overhead.
 */
const conditionsAt = (rule, chainLength, endIndex) => [
  ...rule.conditions,
  ...rule.states.map(({ depth, state }) => {
    const at = Math.max(0, endIndex - depth);
    return `${state} on ${at === chainLength - 1 ? 'the label' : `chain element ${at}`}`;
  }),
];

/* A compound with its state pseudos removed, leaving what identifies the element. A function
   emptied by that -- `:is(:hover)` becoming `:is()` -- goes too, since an empty argument list
   matches nothing and would drop the rule the states above have just qualified. */
const structural = (compound) => {
  const { parts, bare } = functionalsOf(compound);
  const kept = parts
    .map((part) => ({ name: part.name, inner: splitSelectors(part.inner).map(structural).filter((b) => b.trim() !== '') }))
    .filter((part) => part.inner.length > 0)
    .map((part) => `:${part.name}(${part.inner.join(', ')})`)
    .join('');
  return (
    bare.replace(/:empty\b/gi, '').replace(/:(?!:)[a-z-]+(?:\([^)]*\))?/gi, '').trim() + kept
  );
};

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
const matchesElement = (compound, element, chain = null, index = -1) => {
  const { parts, bare } = functionalsOf(compound);
  const anyOf = parts.filter((part) => part.name !== 'not').map((part) => part.inner);
  const noneOf = parts.filter((part) => part.name === 'not').map((part) => part.inner);

  /* An argument can be a whole selector, not just a compound: `:is(.a .b)` asks about the
     element's ancestors. Reading it as a compound demanded every part on one element, which
     no element has, so the rule was dropped. The chain is threaded through for these, and
     `absolute()` relies on it to expand nested `&` as `:is(<parent list>)`. Without a chain
     -- the handful of callers that match an element on its own -- the old reading stands. */
  const branchMatches = (branch) =>
    chain !== null && /[\s>+~]/.test(branch.trim())
      ? matchesPath(pathOf(branch), chain, index)
      : matchesElement(branch, element, chain, index);

  const attributes = bracketsOf(bare).map((token) => attrMatch(token, element));
  if (attributes.includes(false)) return false;

  const rest =
    partsOf(bare).every((part) => element.has(part)) &&
    tagsOf(bare).every((tag) => element.has(tag)) &&
    anyOf.every((inner) => splitSelectors(inner).some(branchMatches)) &&
    noneOf.every((inner) => splitSelectors(inner).every((branch) => !branchMatches(branch)));
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

/*
 * Whether a compound can only match an empty element.
 *
 * `:empty` written on the compound itself requires it. Inside `:is()` or `:where()` it does
 * not, because those are alternations: `:is(.text, :empty)` matches a `.text` that is full
 * of content. Asking whether the function merely contains `:empty` rejected that selector
 * outright, so a real `:is(.text, :empty) .subtitle { opacity: .6 }` was dropped and passed
 * all five tests while the plain `.text` spelling of the same rule failed at 4.42:1
 * (Codex, #427) -- the over-rejecting half of the same guard.
 *
 * So a function requires emptiness only when every one of its alternatives does, which
 * recurses, and `:not()` is left alone: `:not(:empty)` asserts content, which every
 * ancestor of the label has.
 */
const holdsEmpty = (compound) => {
  const { parts, bare } = functionalsOf(compound);
  if (/:empty\b/i.test(bare)) return true;
  return parts.some((part) => {
    if (part.name === 'not') return false;
    const branches = splitSelectors(part.inner);
    return branches.length > 0 && branches.every((branch) => holdsEmpty(branch));
  });
};

const matchesPath = (parts, chain, endIndex) => {
  if (parts.length === 0) return false;
  const walk = (at, index) => {
    if (index < 0) return false;
    if (!matchesElement(parts[at].compound, chain[index], chain, index)) return false;
    /*
     * An ancestor of the label contains the label, so it is never `:empty` -- and
     * `structural()` has already stripped the qualifier off the compound being matched, so
     * without this the rule applies as though it were unqualified. `.text { opacity: .6 }`
     * under `.text:empty { opacity: 1 }` passed all five tests while the browser, seeing a
     * wrapper that holds the eyebrow and a heading, never restores the opacity (Codex,
     * #427).
     *
     * The label itself is exempt: it can be empty, and its fill state is already carried as
     * `needsEmpty`/`needsFilled` per context. Checked here rather than at each call site so
     * a new one cannot miss it -- the last two rounds were both a guard that covered only
     * the places its author remembered.
     */
    if (index !== chain.length - 1 && holdsEmpty(parts[at].raw ?? parts[at].compound)) return false;
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

/* The contents of a part that is nothing but one parenthesised group wrapping further
   groups, or null for anything else -- a single feature test, or a part whose first group
   closes before the end, as `(a) and (b)` does. */
const soleGroupIn = (part) => {
  if (!part.startsWith('(') || !part.endsWith(')')) return null;
  let depth = 0;
  for (let at = 0; at < part.length; at += 1) {
    if (part[at] === '(') depth += 1;
    else if (part[at] === ')') {
      depth -= 1;
      if (depth === 0 && at !== part.length - 1) return null;
    }
  }
  const inner = part.slice(1, -1).trim();
  return inner.includes('(') ? inner : null;
};

/* Top-level commas only: `@media (max-width: 749px), (min-width: 750px)` is two queries, but
   a comma inside parentheses belongs to whatever it is nested in. */
const alternativesOf = (condition) => {
  /* The at-rule names what the alternatives are alternatives of, so each one carries it.
     Splitting the raw string left `@media (min-width: 750px), (min-width: 1000px)` with the
     prefix on its first alternative only, and `regionOf` and `falsifiable` -- which read
     nothing but a media query -- skipped the second, called it unconstrained, and threw away
     the contexts where the query is off (Codex, #427). */
  const prefix = condition.match(/^@[a-z-]+\s*/i);
  const body = prefix ? condition.slice(prefix[0].length) : condition;

  const parts = [];
  let depth = 0;
  let start = 0;
  for (let at = 0; at < body.length; at += 1) {
    const character = body[at];
    if (character === '(') depth += 1;
    else if (character === ')') depth = Math.max(0, depth - 1);
    else if (character === ',' && depth === 0) {
      parts.push(body.slice(start, at));
      start = at + 1;
    } else if (depth === 0) {
      /* `or` is the same alternation spelled as a keyword. Only the comma was split on, so
         `@media (max-width: 749px) or (min-width: 750px)` had its two halves intersected
         into a viewport that cannot exist, the rule inside was discarded as unreachable,
         and a failing `opacity: .6` passed all five tests -- while the comma spelling of
         the same query failed at 4.42:1 (Codex, #427). Matched as a whole word, so the
         `or` inside "ancestor" is not one. */
      const keyword = /^\s+or\s+/i.exec(body.slice(at));
      if (keyword !== null) {
        parts.push(body.slice(start, at));
        at += keyword[0].length - 1;
        start = at + 1;
      }
    }
  }
  parts.push(body.slice(start));

  /* Parentheses of its own hide an alternation from the scan above. `@media ((max-width:
     749px) or (min-width: 750px))` left the `or` at depth 1, so the whole thing stayed one
     condition, `regionOf` intersected the two bounds into a viewport that cannot exist, and
     a failing `opacity: .6` passed all five tests -- while the same query without the outer
     grouping fails at 4.42:1 (Codex, #427). A part that is one group wrapping further
     groups is unwrapped and split again; a part that is a single feature test -- `(hover)`,
     `(max-width: 749px)` -- holds no parentheses inside and is left exactly as it is. What
     this cannot flatten, `regionOf` refuses rather than intersecting. */
  const unwrapped = parts
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .flatMap((part) => {
      const inner = soleGroupIn(part);
      return inner === null ? [part] : alternativesOf(inner);
    });

  return unwrapped.map((part) => (prefix ? `${prefix[0].trim()} ${part}` : part));
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

    /* Everything reaching here has been through `alternativesOf`, which splits every `or` it
       can reach. One still here sat in a group that could not be flattened -- `(a) and ((b)
       or (c))` -- and the loop below would intersect the alternatives into a region narrower
       than the query, or into no region at all, discarding rules that do apply. Refuse it:
       the theme writes no grouped media condition today, so this costs nothing to be strict
       about, and silently narrowing the region is how the ungrouped `or` slipped through. */
    assert.ok(
      !/(?:^|[\s)])or(?:[\s(]|$)/i.test(condition.replace(/^@media\s*/i, '')),
      `"${condition}" keeps an \`or\` inside a group this resolver cannot flatten -- teach ` +
        'it the grouping rather than intersecting alternatives that were never meant to hold ' +
        'at once',
    );

    /* The media type lives outside the parentheses, so a query that is nothing but a type
       left the loop below with no constraint at all: `@media print` read as holding at every
       viewport, and every context where it is off -- which is all of them, on screen -- was
       discarded (Codex, #427). This harness measures the screen rendering, so a query for
       any other medium simply cannot hold, which excludes its rules from the contexts and
       lets a context that omits it stand. The theme names `screen` 318 times and no other
       type. */
    const types = (condition.replace(/^@media\s*/i, '').replace(/\([^()]*\)/g, ' ').match(/[a-z-]+/gi) ?? [])
      .map((word) => word.toLowerCase())
      .filter((word) => word !== 'and' && word !== 'or');
    if (types.some((type) => type !== 'screen' && type !== 'all')) return null;

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

      /*
       * A boolean feature test -- `(hover)`, `(prefers-reduced-motion)`, of which the theme
       * has one. It pins no width, but it is still a thing that can be off, and recording
       * nothing left `regionOf` returning a region with an empty `fixed`: `falsifiable`
       * then found no feature to switch the query off by, read it as holding at every
       * viewport, and threw away the context where it does not hold. So
       * `@media (hover) { .subtitle { opacity: 1 } }` over a plain `opacity: .6` passed all
       * five tests, while a device that cannot hover keeps the faded label (Codex, #427).
       *
       * Keyed apart from the colon form so `(hover)` and `(hover: hover)` are not read as
       * demanding different values of one feature and the pair called impossible. They do
       * mean the same thing, so a query naming both spellings is counted as two independent
       * conditions here -- one context too many rather than one too few.
       */
      const boolean = group.match(/^\(\s*([a-z-]+)\s*\)$/i);
      if (boolean) {
        fixed.set(`${boolean[1].toLowerCase()} (boolean)`, 'true');
        continue;
      }

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
      /* `page.file` is the template: `index.json` is the `index` page type with no suffix,
         `page.wholesale.json` is a `page` with the suffix `wholesale`. */
      const segments = page.file.replace(/\.json$/, '').split('.');
      const inScope = (rule) =>
        (rule.scope ?? []).every((condition) =>
          condition.name !== undefined
            ? condition.name === segments[0]
            : condition.suffix.includes(segments.slice(1).join('.')),
        );
      const live = (rule) =>
        (rule.origin === null || page.types.has(rule.origin)) && inScope(rule);

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
            needsEmpty: holdsEmpty(label),
          };
        });

      /* Anchored at the label, which is where every rule in `reaches` matched. */
      const reaches = [...named, ...unnamed]
        .sort((a, b) => a.weight - b.weight || a.at - b.at)
        .map((rule) => ({
          ...rule,
          anchored: conditionsAt(rule, entry.chain.length, entry.chain.length - 1),
        }));
      if (reaches.length === 0) continue;

      /* Only the ancestor declarations that can reach the label need their own contexts --
       everything else an ancestor sets stays on the ancestor. Without that filter the
       powerset ran to 48 qualifier sets and tripped the cap.

       `opacity` and `color` composite and inherit; a foreground custom property inherits
       too, and leaving it out meant an ancestor that changed only the token inside a media
       query never had that query enumerated, so `ancestorEffects` was never called under it
       and the override went unapplied (Codex, #427). */
      const AFFECTS_LABEL = /(?:^|;|\s)(?:opacity|color|--color-foreground[\w-]*)\s*:/;
      /*
       * Anchored where each one actually matched, not at the label: a rule that targets an
       * ancestor directly ends on that ancestor, and calling its last compound "the label"
       * is exactly how its state collided with the label's own.
       *
       * Every ancestor it matches, not the first. One selector can match several links in
       * the chain -- `div:hover` matches each `<div>` above the label -- and taking only
       * `findIndex`'s first left the inner ones with no condition of their own, so an
       * override on an outer ancestor was read as covering the hover on an inner one:
       * `#shopify-section-ona-wholesale-partnership div:hover { color: #f4f3e9 }` beside a
       * `.container.container` override passed all five tests, while the browser keeps the
       * cream-on-cream eyebrow whenever the inner `.text` is hovered. Spelling the same
       * rule `.text:hover`, which matches one link, failed at 1:1 -- that asymmetry is the
       * tell (Codex, #427). Each match becomes its own entry, so `ancestorEffects` sees a
       * separately anchored condition for every one of them.
       *
       * Only where the anchor can change the answer, and only for a state that can differ
       * from one element to the next. `:root` names a single element by definition, but
       * `structural()` strips it off the compound and what is left selects anything, so the
       * theme's `:root` rules match seven and eight links of a chain apiece. Anchoring each
       * of those separately took this file from 176 contexts to 12288 and the widest
       * qualifier set from 3 to 10 against a cap of 12 -- four and a half minutes for one
       * test file, out of rules a browser applies to exactly one element.
       *
       * So a `:root`-only rule keeps the single anchoring it has always had, which leaves
       * every context this file built before exactly as it was, and the enumeration is
       * spent on the states the fix is actually about. Two tidier-looking versions of this
       * came first and both cost coverage: dropping `:root` from `statesOf`, and anchoring
       * it at the root. The context where the theme's own `:root` definition is off is what
       * lets an injected `html:root { --color-foreground: #f4f3e9 }` be read at all, and
       * both of those took it away. Identical anchorings are still collapsed, since a
       * stateless rule reads the same at every index it matches.
       */
      const touching = everyRule()
        .filter((rule) => live(rule) && AFFECTS_LABEL.test(rule.declarations))
        .flatMap((rule) => {
          const matches = entry.chain
            .slice(0, -1)
            .map((_, index) => index)
            .filter((index) => matchesPath(rule.path, entry.chain, index));
          const varies = rule.states.some(({ state }) => !/^:root$/i.test(state));
          const seen = new Set();
          return (varies ? matches : matches.slice(0, 1)).flatMap((at) => {
            const anchored = conditionsAt(rule, entry.chain.length, at);
            const key = anchored.join('\u0000');
            if (seen.has(key)) return [];
            seen.add(key);
            return [{ ...rule, anchored }];
          });
        });

      /*
       * Cascade layers decide precedence, they do not qualify a rule. An unlayered normal
       * declaration beats a layered one whatever either selector's specificity, so sorting
       * a layered declaration in by weight and source order -- which is all this model does
       * with a condition -- produces a cascade the browser never has. Injecting
       * `#MainContent .subtitle { opacity: 1 }` beside `@layer probe { #MainContent
       * .subtitle { opacity: .6 } }` failed the contrast test at 4.42:1 on labels the
       * browser keeps fully opaque (Codex, #427).
       *
       * `@scope` is refused beside it for the mirror reason. Its prelude names a root and
       * a limit -- a structural restriction on which elements the rules inside can reach --
       * and recording the prelude as a condition keeps the words and drops the restriction,
       * so `@scope (.not-rendered) { #MainContent .subtitle { opacity: .6 } }` failed the
       * contrast test at 4.42:1 over an element the theme does not contain (Codex, #427).
       * That is a false alarm where the layer case is a false reading, but the remedy is
       * the same and the theme uses `@scope` nowhere at all.
       *
       * `walk` still descends into both blocks, so such a rule is never simply unseen;
       * it is seen and refused.
       */
      for (const rule of [...reaches, ...touching]) {
        const held = rule.conditions.filter((condition) => /^@(?:layer|scope)\b/i.test(condition));
        assert.equal(
          held.length,
          0,
          `"${rule.selector}" reaches .${name} from inside ${held.join(' inside ')}, and this ` +
            'model orders declarations by specificity and source order inside conditions it ' +
            'can switch on and off -- a layer precedence or a scope boundary would have to ' +
            'be carried separately before a ratio taken across one means anything',
        );
      }

      /*
       * The grounds come from the palette and the band colours the templates configure --
       * settings, not CSS. A rule that paints a background on the label or on any ancestor
       * replaces the ground underneath it and nothing here notices: painting `.text` and
       * `.subtitle` the same `#470a12` leaves the eyebrow invisible at 1:1 with all five
       * tests green (Codex, #427).
       *
       * Resolving a painted ground means carrying backgrounds down the ancestry with their
       * own conditions and inline styles -- a second cascade beside this one. Until that
       * exists the model refuses rather than measure against a background something covers.
       * The one declaration it accepts is the page ground restated: `body { background:
       * var(--color-background) }` is the premise, not an exception to it.
       */
      /*
       * Tokens this model reads once, globally, which the cascade can redefine anywhere.
       *
       * `--color-background` is the page ground, read from the settings;
       * `--opacity-muted-text` and `--opacity-subdued-text` are read from
       * `theme-styles-variables.liquid`. Redefine any of them below the root and the same
       * declaration means something else:
       * `.text { --color-background: #470a12; background: var(--color-background) }` left
       * the eyebrow at 1:1, and `.subtitle { --opacity-subdued-text: .1; color: rgb(var(
       * --color-foreground-rgb) / var(--opacity-subdued-text)) }` passed while the literal
       * `.1` spelling of the same alpha fails at 1.22:1 -- both with all five tests green
       * (Codex, #427, two rounds apart).
       *
       * Kept as one table rather than a check per token, because the first of these was
       * written on its own and the second arrived as the same bug with a different name.
       * The root's definition of each is the premise and is left alone; it is the only one
       * of each in the theme today, measured through the harness rather than grepped.
       * Anything below the root is refused, since resolving it means carrying a second
       * cascade for a value this model takes as fixed.
       */
      const GLOBAL_TOKENS = [
        {
          defines: /(?:^|;|\s)--color-background\s*:/,
          names: '--color-background',
          means: 'what `background: var(--color-background)` paints there is no longer the configured page ground',
        },
        {
          defines: /(?:^|;|\s)--opacity-(?:muted|subdued)-text\s*:/,
          names: 'an --opacity-*-text token',
          means: 'the alpha this model reads from theme-styles-variables.liquid is no longer the one that applies',
        },
      ];
      const whereInChain = (at) =>
        at === entry.chain.length - 1 ? `.${name}` : `an ancestor of .${name}`;
      for (const token of GLOBAL_TOKENS) {
        for (const rule of everyRule()) {
          if (!live(rule) || !token.defines.test(rule.declarations)) continue;
          const at = entry.chain.findIndex((_, index) => matchesPath(rule.path, entry.chain, index));
          assert.ok(
            at <= 0,
            `"${rule.selector}" redefines ${token.names} on ${whereInChain(at)}, so ` +
              `${token.means} -- resolve the token through the ancestry rather than trust a ` +
              'measurement taken against the global value',
          );
        }
        entry.inlines.forEach((style, at) => {
          assert.ok(
            !token.defines.test(style) || at === 0,
            `style="" on ${whereInChain(at)} redefines ${token.names}, so ${token.means} -- ` +
              'resolve the token rather than trust a measurement taken against the global value',
          );
        });
      }

      const PAINTS = /(?:^|;|\s)background(?:-color|-image)?\s*:/;
      const RESTATES_THE_GROUND =
        /^\s*background(?:-color)?\s*:\s*var\(\s*--color-background\s*\)\s*$/;
      /*
       * `style=""` too, not only the stylesheets. The refusal above visited `everyRule()`
       * and nothing else, so the identical obscuring done inline sailed through it:
       * `style="background-color:#470a12"` on the partnership wrapper with
       * `style="color:#470a12"` on its eyebrow left all five tests green at a rendered 1:1
       * (Codex, #427). `inlines` is parallel to `chain` and its last entry is the label's
       * own, so this covers the label and every ancestor in one pass.
       */
      entry.inlines.forEach((style, at) => {
        const paints = style
          .split(';')
          .filter((one) => PAINTS.test(`;${one}`) && !RESTATES_THE_GROUND.test(one));
        assert.equal(
          paints.length,
          0,
          `style="" on ${at === entry.chain.length - 1 ? `.${name}` : `an ancestor of .${name}`} ` +
            `paints a background (${paints.map((one) => one.trim()).join('; ')}), and this ` +
            'model measures the label against the palette and the template bands only -- ' +
            'resolve the painted ground through the ancestry rather than trust a ratio ' +
            'taken against a background it covers',
        );
      });

      for (const rule of everyRule()) {
        if (!live(rule) || !PAINTS.test(rule.declarations)) continue;
        if (!entry.chain.some((_, at) => matchesPath(rule.path, entry.chain, at))) continue;
        const paints = rule.declarations
          .split(';')
          .filter((one) => PAINTS.test(`;${one}`) && !RESTATES_THE_GROUND.test(one));
        assert.equal(
          paints.length,
          0,
          `"${rule.selector}" paints a background on .${name} or an ancestor of it ` +
            `(${paints.map((one) => one.trim()).join('; ')}), and this model measures the ` +
            'label against the palette and the template bands only -- resolve the painted ' +
            'ground through the ancestry rather than trust a ratio taken against a ' +
            'background it covers',
        );
      }

      const sets = [];
      const seen = new Set();
      for (const rule of [...reaches, ...touching]) {
        const key = JSON.stringify(rule.anchored);
        if (seen.has(key)) continue;
        seen.add(key);
        sets.push(rule.anchored);
      }
      /* And the label's own `style=""`, for the reason the ancestors' is refused in
         `ancestorEffects`: importance decides between two declarations of one property and
         nothing here resolves it. Codex reported the ancestor case; the label's own inline
         style is the same hole one element down, and enumerating only the half that was
         reported is how the token guard had to be fixed twice. */
      assert.ok(
        !/!important/.test(entry.inline),
        `.${name} in ${entry.section} carries !important in its style="" ` +
          `("${entry.inline.trim()}"), which this cascade model does not resolve -- extend ` +
          'it rather than trusting the result',
      );

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
          rule.anchored.every((condition) => conditions.includes(condition)),
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

  /*
   * `snippets/color-palette.liquid` emits `--color-foreground` from `settings.page_text_color`
   * and `--color-background` from `settings.page_background_color` (lines 168-171), so those
   * are what an eyebrow inherits and what it sits on away from a band. The palette entries
   * are only their schema defaults -- `settings_schema.json` gives each the matching
   * `{{ settings.color_palette.* }}` -- and the two coincide in this theme today, which is
   * exactly why measuring the palette looked right: setting `page_text_color` to the page
   * background left the eyebrow identical to its ground with all five tests green
   * (Codex, #427).
   */
  const configured = (value, fallback, id) => {
    if (value === undefined || value === null || value === '') return fallback;
    assert.ok(
      /^#[0-9a-f]{6}$/i.test(value),
      `settings.${id} is "${value}", which this resolver cannot read as a colour -- teach it ` +
        'that form rather than measuring the palette default instead',
    );
    return value;
  };

  return {
    background: colors.background,
    foreground: colors.foreground,
    all: colors,
    page: {
      foreground: configured(settings.page_text_color, colors.foreground, 'page_text_color'),
      background: configured(settings.page_background_color, colors.background, 'page_background_color'),
    },
  };
})();

/*
 * `snippets/color-palette.liquid` picks --palette-lightest and --palette-darkest by running
 * `color_brightness` over every colour in the palette, so they are resolved the same way here
 * rather than guessed. Shopify's filter is the perceived-brightness weighting.
 */
/* Shopify's `color_brightness`: the perceived-brightness weighting, which both
   `color-palette.liquid` and `ona-band.liquid` branch on. */
const colourBrightness = (hex) => {
  const [r, g, b] = rgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000;
};

const paletteExtreme = (which) => {
  const brightness = colourBrightness;
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
    ['the page background', { colour: palette.page.background, section: null, file: null }],
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
/*
 * The value with every `var()` fallback dropped, leaving only what the browser reaches when
 * each variable is defined: `var(--a, var(--b))` becomes `var(--a)`.
 */
const withoutFallbacks = (value) => {
  let out = '';
  for (let at = 0; at < value.length; at += 1) {
    if (!/^var\s*\(/i.test(value.slice(at))) {
      out += value[at];
      continue;
    }
    const open = value.indexOf('(', at);
    let depth = 0;
    let close = open;
    for (; close < value.length; close += 1) {
      if (value[close] === '(') depth += 1;
      else if (value[close] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const inner = value.slice(open + 1, Math.min(close, value.length));
    let nested = 0;
    let cut = -1;
    for (let index = 0; index < inner.length; index += 1) {
      if (inner[index] === '(') nested += 1;
      else if (inner[index] === ')') nested -= 1;
      else if (inner[index] === ',' && nested === 0) {
        cut = index;
        break;
      }
    }
    out += `var(${cut === -1 ? inner : inner.slice(0, cut)})`;
    at = close;
  }
  return out;
};

const colourValue = (value) => {
  let alpha = 1;
  let read = false;

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
  /*
   * The alpha expression is resolved whole. Matching the token name as a substring accepted
   * the arithmetic around it and then threw it away: `rgb(var(--color-foreground-rgb) /
   * calc(var(--opacity-subdued-text) * .1))` was read as the configured 0.8 when the real
   * alpha is 0.08, and passed all five tests -- while the literal `.1` fails at 1.22:1
   * (Codex, #427). A token reference is accepted only when it *is* the whole expression;
   * anything else, arithmetic included, falls to the refusal below. `withoutFallbacks`
   * first, because `var(--opacity-subdued-text, .6)` is the token whenever the token is
   * defined, and `theme-styles-variables.liquid:392` defines both.
   */
  const TOKEN_ALPHA = [
    { is: /^var\(\s*--opacity-muted-text\s*\)$/i, token: 'muted' },
    { is: /^var\(\s*--opacity-subdued-text\s*\)$/i, token: 'subdued' },
  ];
  const alphaFrom = (part, how) => {
    const literal = part.match(/^([0-9.]+)(%?)$/);
    if (literal) return literal[2] ? Number(literal[1]) / 100 : Number(literal[1]);
    const named = TOKEN_ALPHA.find((entry) => entry.is.test(withoutFallbacks(part)));
    if (named) return opacityToken(named.token);
    return assert.fail(
      `cannot read the eyebrow's alpha from "${part}" (${how}) -- extend this resolver ` +
        'rather than treating the label as fully opaque',
    );
  };

  /*
   * `rgba(r, g, b, a)` carries its alpha as a last argument rather than after a slash, and
   * the slash reader simply did not see it: `rgba(var(--color-foreground-rgb), .1)` passed
   * all five tests at a real 1.22:1, and so did the same value with `calc()` around the
   * token. The theme writes this form (`rgba(0, 0, 0, 0.1)` and friends), so it is read, not
   * refused.
   *
   * Two arguments or four, because a packed triple is one argument: `rgba(var(--triple), a)`
   * is the same colour as `rgba(r, g, b, a)`. Counting only four was my own first try at
   * this and it read neither -- the injected `rgba(var(--color-foreground-rgb), .1)` still
   * passed, which is what caught it. One argument or three carry no alpha, and a flattened
   * Liquid `rgba({{ ... }})` that leaves either count falls through to the resolvers below
   * exactly as before.
   *
   * All four spellings. `rgb()` and `hsl()` take a comma alpha exactly as their `a` forms
   * do, and naming only `rgba|hsla` here -- my own enumeration, one round after writing
   * this reader -- left `rgb(var(--color-foreground-rgb), .1)` passing all five tests while
   * the identical `rgba()` failed at 1.22:1, so two spellings of one browser colour got two
   * different answers (Codex, #427).
   */
  const legacy = value.match(/^(?:rgba?|hsla?)\(([\s\S]*)\)$/i);
  if (legacy) {
    const args = [];
    let depth = 0;
    let start = 0;
    for (let at = 0; at < legacy[1].length; at += 1) {
      if (legacy[1][at] === '(') depth += 1;
      else if (legacy[1][at] === ')') depth -= 1;
      else if (legacy[1][at] === ',' && depth === 0) {
        args.push(legacy[1].slice(start, at).trim());
        start = at + 1;
      }
    }
    args.push(legacy[1].slice(start).trim());
    if (args.length === 2 || args.length === 4) {
      alpha *= alphaFrom(args[args.length - 1], value);
      read = true;
    }
  }

  const slashed = value.match(/\/\s*([^)]+?)\s*\)/);
  if (slashed) {
    alpha *= alphaFrom(slashed[1].trim(), value);
  } else if (!read) {
    /* Only when no alpha has been read already: `rgba(0, 0, 0, var(--opacity-subdued-text))`
       names the token in its fourth argument, and counting it here as well would square it
       into 0.64. */
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

  /*
   * A `var()` fallback only applies when the variable before it is undefined, so a
   * foreground token sitting there is not what the eyebrow is painted in. The check below
   * reads the whole string, so `rgb(var(--color-rgb, var(--color-foreground-rgb)) / 1)`
   * came back as "inherited" and passed all five tests -- while the same declaration with
   * `--color-rgb` read directly fails, which is the asymmetry that gives it away
   * (Codex, #427). `snippets/color-palette.liquid` writes this shape for real.
   *
   * Resolving it means tracking arbitrary custom properties, which this model does not do,
   * so it refuses. The theme passes exactly one `var()` value to this resolver today --
   * `var(--color-foreground)`, no fallback -- measured through the resolver itself.
   */
  const FOREGROUND_IN = /--color-foreground(?:-rgb|-muted|-subdued)?(?![\w-])/;
  assert.ok(
    !FOREGROUND_IN.test(value) || FOREGROUND_IN.test(withoutFallbacks(value)),
    `the eyebrow's colour in "${value}" names a foreground token only inside a var() ` +
      'fallback, which applies only when the variable before it is undefined -- resolve ' +
      'that variable rather than measuring a fallback the browser may never reach',
  );

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

      for (const { name: ground_name, colour: ground, section: banded } of under) {
        const ink = rgb(ground);
        /*
         * What the eyebrow is actually painted in, off a band and on one.
         *
         * The page ground is not a band: there the label inherits `--color-foreground`,
         * which `color-palette.liquid` emits from `page_text_color`.
         *
         * On a band, `snippets/ona-band.liquid:29-45` keeps `page_text_color` when it
         * clears 4.5:1 against the band, and otherwise takes the palette extreme chosen by
         * the band's BRIGHTNESS -- darkest over a light band, lightest over a dark one.
         * That is not the extreme that contrasts best, and the two disagree: over
         * `#00a000` with a grey page text the snippet paints cream at 3.13:1 while picking
         * by contrast gave maroon at 4.57:1, so the test passed on a colour the browser
         * never uses (Codex, #427). An earlier round of this same test asserted in a
         * comment that the snippet chose by contrast; it does not, and the snippet is the
         * authority. Mirrored here rather than approximated.
         */
        const inherited = (() => {
          if (banded === null) return rgb(palette.page.foreground);
          const text = rgb(palette.page.foreground);
          if (contrast(text, ink) >= 4.5) return text;
          return rgb(paletteExtreme(colourBrightness(ground) > 128 ? 'darkest' : 'lightest'));
        })();
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
