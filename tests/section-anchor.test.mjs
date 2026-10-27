import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const stripBanner = (text) => text.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
const schemaOf = (file) =>
  JSON.parse(read(file).match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/)[1]);

/*
 * The theme settings as the storefront sees them: what `config/settings_data.json`'s `current`
 * scope holds, falling back to the schema default for a key it does not carry. Both halves
 * matter for the one condition this exists to resolve -- `layout/theme.liquid` gates quick-add
 * on `settings.quick_add or settings.mobile_quick_add`, and the committed config turns the
 * first off explicitly while never mentioning the second, whose schema default is off.
 */
const SETTINGS = (() => {
  const data = JSON.parse(stripBanner(read('config/settings_data.json')));
  const current = typeof data.current === 'string' ? (data.presets ?? {})[data.current] : data.current;
  const defaults = Object.fromEntries(
    JSON.parse(stripBanner(read('config/settings_schema.json')))
      .flatMap((group) => group.settings ?? [])
      .filter((entry) => entry.id != null && Object.hasOwn(entry, 'default'))
      .map((entry) => [entry.id, entry.default])
  );
  return { ...defaults, ...(current ?? {}) };
})();

const CLAUSE = /^settings\.([\w-]+)\s*(?:(==|!=)\s*(?:'([^']*)'|"([^"]*)"|(true|false|blank|empty)))?$/;

/*
 * Whether a single clause is CERTAINLY false at this commit.
 *
 * Everything this does not recognise -- another object, a filter, a comparison it cannot
 * resolve -- is unknown, and unknown counts as rendered. The asymmetry is deliberate: calling a
 * live id dead loses a collision and ships a link pointing at the wrong element, while calling
 * a dead id live costs a merchant one anchor name they were never going to choose.
 */
const clauseFalse = (text) => {
  const match = CLAUSE.exec(text.trim());
  if (!match) return false;
  const [, key, operator, single, double, keyword] = match;
  if (!Object.hasOwn(SETTINGS, key)) return false;
  const value = SETTINGS[key];
  const blank = value === false || value === '' || value == null;
  if (!operator) return blank;
  const equal =
    keyword === 'blank' || keyword === 'empty'
      ? blank
      : keyword === 'true'
        ? value === true
        : keyword === 'false'
          ? value === false
          : value === (single ?? double);
  return operator === '==' ? !equal : equal;
};

const definitelyFalse = (expression) => {
  const text = expression.trim();
  if (!text) return false;
  const hasAnd = /\sand\s/.test(text);
  const hasOr = /\sor\s/.test(text);
  /* Liquid has no operator precedence and folds right to left, so a mixed expression does not
     group the way it reads. Not worth resolving here -- it enters as unknown. */
  if (hasAnd && hasOr) return false;
  if (hasOr) return text.split(/\sor\s/).every(clauseFalse);
  if (hasAnd) return text.split(/\sand\s/).some(clauseFalse);
  return clauseFalse(text);
};

const BRANCH = /\{%-?\s*(if|elsif|else|endif|unless|endunless)\b([^%]*?)-?%\}/g;

/*
 * The spans of a file this commit's settings certainly do not render.
 *
 * Without this, a conditional render reserves its snippet's ids anyway: `layout/theme.liquid`
 * renders `quick-add-modal` only when quick add is on, it is off, and `quick-add-dialog` was
 * being held against an anchor on every page although the element is not there. Only the
 * outermost dead frame opens a span, so nesting does not produce overlapping ranges, and
 * `unless` enters as unknown -- deciding it would mean deciding its condition is certainly
 * true, which `definitelyFalse` does not do.
 */
const deadRanges = (source) => {
  const ranges = [];
  const stack = [];
  let start = null;
  const open = (at) => {
    if (start === null) start = at;
  };
  const close = (at) => {
    if (start !== null) ranges.push([start, at]);
    start = null;
  };
  for (const match of source.matchAll(BRANCH)) {
    const name = match[1];
    const expression = match[2] ?? '';
    const from = match.index;
    const to = from + match[0].length;
    const ancestorsDead = stack.some((frame) => frame.dead);

    if (name === 'if' || name === 'unless') {
      stack.push({ dead: name === 'if' && definitelyFalse(expression) });
      if (!ancestorsDead && stack[stack.length - 1].dead) open(to);
      continue;
    }

    if (name === 'elsif' || name === 'else') {
      const frame = stack[stack.length - 1];
      if (!frame) continue;
      const outer = stack.slice(0, -1).some((entry) => entry.dead);
      if (!outer && frame.dead) close(from);
      frame.dead = name === 'elsif' && definitelyFalse(expression);
      if (!outer && frame.dead) open(to);
      continue;
    }

    const frame = stack.pop();
    if (frame?.dead && !stack.some((entry) => entry.dead)) close(from);
  }
  return ranges;
};

const isDead = (ranges, index) => ranges.some(([from, to]) => index >= from && index < to);

/*
 * What an href="#..." can actually reach.
 *
 * Almost nothing is excluded. An HTML id may start with a digit, and `| escape` is transparent
 * rather than lossy -- `research&development` is emitted as `id="research&amp;development"`, the
 * parser decodes it, and the DOM id is the string the merchant typed, so a matching fragment
 * works. The only real constraint is ASCII whitespace.
 *
 * The leading `#` is rejected for a different reason, and not because HTML forbids it: the info
 * text tells the merchant to leave it off, and an id of `#complete-training` needs
 * `href="##complete-training"` to reach it, so every link written the documented way misses. A
 * `#` later in the value is fine -- the fragment is everything after the first one.
 *
 * A percent escape is the one place where that transparency argument does not carry over. `|
 * escape` is an HTML escape and the parser undoes it, so the DOM id is what the merchant typed.
 * Percent-decoding happens on the *other* side: `research%20development` is emitted verbatim as
 * the id, but `href="#research%20development"` is decoded during fragment navigation and looks
 * for `research development`, which is not on the page. The value is accepted everywhere and
 * reachable nowhere, so it is rejected here rather than silently shipped.
 */
/* ASCII whitespace, spelled out. JavaScript's `\s` also matches NBSP, the ideographic space
   and the rest of Unicode's whitespace, none of which HTML forbids in an id -- so `\s` here
   rejected `cafe\u00a0training` as unreachable although a fragment carrying the same NBSP
   resolves to it. Copied international text is exactly where that turns up. */
const ASCII_SPACE = '[ \\t\\n\\f\\r]';
const FRAGMENT = new RegExp(`^(?!${ASCII_SPACE}|#)(?:(?!${ASCII_SPACE}).)*$`, 'su');
const PERCENT_ESCAPE = /%[0-9A-Fa-f]{2}/;
const reachable = (anchor) => FRAGMENT.test(anchor) && !PERCENT_ESCAPE.test(anchor);

/*
 * /pages/wholesale navigates to itself -- `ona-icon-and-content` links to four #anchors, and
 * each is the `id` setting of another legacy section on the page. Horizon's `section` had no
 * equivalent, so rebuilding any of those four would have broken a link on the same page. This
 * setting is the replacement, and these tests pin the three things that make it a replacement
 * rather than a lookalike: it exists, it renders only when set, and it can carry the values
 * actually in use.
 */
test('the section anchor setting exists and offers no default', () => {
  const setting = (schemaOf('sections/section.liquid').settings ?? []).find((entry) => entry.id === 'anchor');
  assert.ok(setting, 'sections/section.liquid has no anchor setting');
  assert.equal(setting.type, 'text', 'the anchor must be free text; a merchant types the fragment');
  assert.ok(setting.label, 'the anchor setting has no label');
  assert.ok(setting.info, 'the anchor setting has no info text explaining the missing #');

  /* Shopify silently rejects a schema whose text setting defaults to an empty string, which
     would take the whole section's schema down with it rather than erroring visibly. */
  assert.ok(
    !Object.hasOwn(setting, 'default'),
    'the anchor setting declares a default; an empty-string default is silently rejected and takes the schema with it'
  );
});

/*
 * The snippet is shared: sections/_blocks.liquid renders it too and has no anchor setting, so an
 * unconditional id would emit id="" on every section in the theme. The guard reads the
 * conditional rather than the attribute, because the attribute alone is what the bug looks like.
 */
test('the section renders an anchor only when one is set', () => {
  const snippet = read('snippets/section.liquid');
  const emitted = snippet.match(/id="\{\{\s*section\.settings\.anchor[^"]*"/g) ?? [];
  assert.equal(emitted.length, 1, `the anchor id is emitted ${emitted.length} times; expected exactly one`);

  /* `[^>]*` keeps the match inside one opening tag: an id emitted after the tag closes is a
     bare id="..." in the markup, which renders but anchors nothing. */
  const guarded = /<div[^>]*\{%-?\s*if\s+section\.settings\.anchor\s*!=\s*blank\s*%\}\s*id="\{\{\s*section\.settings\.anchor\s*\|\s*escape\s*\}\}"\s*\{%-?\s*endif\s*%\}/;
  assert.match(
    snippet.replace(/\n\s*/g, ' '),
    guarded,
    'the anchor id is not inside the section tag, not wrapped in a blank check, or not escaped; _blocks.liquid shares this snippet and sets no anchor'
  );

  assert.ok(
    !(schemaOf('sections/_blocks.liquid').settings ?? []).some((entry) => entry.id === 'anchor'),
    '_blocks.liquid now has its own anchor setting; this guard assumed it does not'
  );
});

/*
 * Two claims about stored anchors, checked against the page a visitor actually gets.
 *
 * Shape: the editor writes "" for a text setting with no default -- `ona-wholesale-sourcing-v2`
 * declares `id` the same way and `page.wholesale.json` carries seven empty ones -- so a blank
 * anchor is the unset state, not a bad value. Anything else must be reachable by an href, which
 * also catches a merchant who typed the # the info text tells them to leave off.
 *
 * Uniqueness: an id is unique per *rendered page*, not per file. `layout/theme.liquid` pulls in
 * section groups on every template, and the legacy sections emit their `id` setting as a real
 * element id (`sections/ona-supported.liquid:3`, and a `slider-` variant on the same value), so
 * an anchor can collide with something declared in a different file and send a link to the wrong
 * element. The universe below is each template plus the groups the layout names -- read out of
 * the layout rather than listed here, so moving a group does not quietly shrink the check.
 *
 * Nothing is set today, so both assertions are vacuous at this commit. That vacuity is the
 * inertness this PR rests on, and the count at the end measures it instead of asserting it in a
 * comment. The rebuild makes all three real.
 */
/*
 * Which section types emit a copy of their `id` setting, and under what prefix. Derived from the
 * markup: five sections render `id="slider-{{ section.settings.id }}"` as well as the bare id,
 * and the rest render only the bare one. Reserving `slider-<id>` for every legacy section would
 * block an anchor that collides with nothing -- `ona-training` owns `complete-training` on
 * wholesale and emits no `slider-complete-training`.
 */
const EMITS = new Map(
  readdirSync(join(root, 'sections'))
    .filter((name) => name.endsWith('.liquid'))
    .map((name) => [
      name.replace(/\.liquid$/, ''),
      [...new Set([...read(join('sections', name)).matchAll(/id="([^"{]*)\{\{\s*section\.settings\.id\s*\}\}"/g)].map((m) => m[1]))],
    ])
    .filter(([, prefixes]) => prefixes.length > 0)
);

/*
 * The static ids a section type's own markup puts on the page. `settings.id` is not the only
 * thing a legacy section contributes: `sections/header.liquid` emits `id="header-component"`,
 * and the header group pulls it onto every template, so an anchor of `header-component` lands a
 * link on the header. Reading these per type -- and attributing them to the pages that
 * instantiate the type -- is what keeps the collision set the ids of the *rendered page* rather
 * than the ids the JSON happens to configure.
 */
/*
 * `(?<![-\w])` is the whole difference between an id and a substring of one. `data-testid="..."`
 * ends in `id="..."`, and there are 22 of them across `sections/`, so without the boundary
 * `sections/hero.liquid`'s `data-testid="hero-picture-1"` reserves `hero-picture-1` and an
 * anchor by that name collides with an element that does not exist. A test attribute must not
 * cost a merchant a valid anchor.
 */
const ID_ATTRIBUTE = /(?<![-\w])id="([A-Za-z][-\w]*)"/g;

/*
 * An id can also be a Liquid expression that is constant. `snippets/search-modal.liquid`
 * writes `id="{{ 'search-component--modal' }}"` and `id="{{ 'cmdk-input' | default: 'Search' }}"`,
 * both of which render the same string on every page the layout wraps -- and the attribute
 * regex above sees neither, because the value starts with `{`. An anchor of `cmdk-input` was
 * therefore approved against an id that is on every page in the theme.
 */
const LITERAL_ID = /(?<![-\w])id="\{\{-?\s*'([^']+)'((?:[^}]*?))-?\}\}"/g;

/*
 * And an id can be a variable a caller filled with a literal. `blocks/filters.liquid:455`
 * renders `theme-drawer-header` with `heading_id: 'filters-drawer-heading'`, and
 * `snippets/theme-drawer-header.liquid:24` writes `id="{{ heading_id }}"`. Following the
 * snippet's filename and nothing else drops the argument, so that id was on the page and free
 * for an anchor at the same time.
 */
const VARIABLE_ID = /(?<![-\w])id="\{\{-?\s*([a-z_][\w]*)((?:[^}]*?))-?\}\}"/gi;

/* A render tag with its arguments. `[^%]|%(?!\})` walks to the tag's own `%}` rather than to
   the first `%` in it, so a filter or a modulo inside an argument does not cut it short. */
const RENDER = /\{%-?\s*(?:render|include)\s+'([^']+)'((?:[^%]|%(?!\}))*)-?%\}/g;
const LITERAL_ARG = /\b([a-z_][\w]*)\s*:\s*'([^']*)'/gi;

/*
 * The filters that cannot change a non-blank literal: `default:` is a no-op on one, and
 * `escape` and `strip` leave an id-shaped string alone. Anything else -- `handle`, `append`,
 * `md5` -- renders a different string, and guessing it would reserve a name that is not on the
 * page while still missing the one that is. Those are not skipped silently; the test below
 * fails on them, because a constant id that quietly stops being reserved is the bug this
 * whole addition exists to fix.
 */
const INERT_FILTERS = /^\s*(?:\|\s*(?:escape|strip)\s*|\|\s*default:\s*(?:'[^']*'|"[^"]*")\s*)*$/;

const maybeRead = (file) => {
  try {
    return read(file);
  } catch {
    return null;
  }
};

/*
 * Every static id a file puts on the page, following the snippets it renders.
 *
 * A section file is not the end of the chain. `layout/theme.liquid:216` renders
 * `snippets/search-modal.liquid`, which emits `id="search-modal"` on every page, and
 * `blocks/filters.liquid:409` emits `id="filters-drawer"` wherever a `filters` block is
 * configured. Stopping at the file named in the JSON leaves those out and an anchor by either
 * name collides with something real while this test says it is free. Snippets render snippets,
 * so the walk is transitive, with `seen` for the cycles.
 */
const emitted = (file, bindings = new Map(), seen = new Set()) => {
  /* Keyed on the arguments too: the same snippet rendered twice with different literals emits
     different ids, and a plain filename key would drop the second one as a cycle. */
  const visit = `${file}\u0000${[...bindings].sort().map((pair) => pair.join('=')).join(',')}`;
  if (seen.has(visit)) return [];
  seen.add(visit);
  const source = maybeRead(file);
  if (source === null) return [];
  /* Whatever sits in a branch this commit's settings close off is not on the page, and an id
     that is not on the page cannot be collided with. */
  const dead = deadRanges(source);
  const live = (match) => !isDead(dead, match.index);
  const ids = [...source.matchAll(ID_ATTRIBUTE)].filter(live).map((m) => m[1]);
  for (const match of source.matchAll(LITERAL_ID)) {
    if (live(match) && INERT_FILTERS.test(match[2])) ids.push(match[1]);
  }
  for (const match of source.matchAll(VARIABLE_ID)) {
    if (live(match) && bindings.has(match[1]) && INERT_FILTERS.test(match[2])) ids.push(bindings.get(match[1]));
  }
  for (const match of source.matchAll(RENDER)) {
    if (!live(match)) continue;
    /* Only literal arguments travel. A variable or an expression resolves at render time and
       guessing it would reserve a name that is not on the page. */
    const passed = new Map([...(match[2] ?? '').matchAll(LITERAL_ARG)].map((arg) => [arg[1], arg[2]]));
    ids.push(...emitted(join('snippets', `${match[1]}.liquid`), passed, seen));
  }
  return ids;
};

/* A type resolves to a section file or a block file; the JSON says which by where it sits. */
const fileFor = (type, kind) =>
  kind === 'section' && maybeRead(join('sections', `${type}.liquid`)) !== null
    ? join('sections', `${type}.liquid`)
    : maybeRead(join('blocks', `${type}.liquid`)) !== null
      ? join('blocks', `${type}.liquid`)
      : join('sections', `${type}.liquid`);

const STATIC = new Map(
  readdirSync(join(root, 'sections'))
    .filter((name) => name.endsWith('.liquid'))
    .map((name) => [name.replace(/\.liquid$/, ''), [...new Set(emitted(join('sections', name)))]])
);

/*
 * What one configured node puts on the page: the section's or block's own markup and its
 * snippets, plus every block the JSON nests under it and theirs -- a configured block is as
 * much on the page as the section holding it.
 *
 * `disabled: true` is what the editor's hide control writes, and Shopify renders neither a
 * hidden section nor a hidden block, nor anything nested under one. A third of the sections in
 * the committed templates carry it, so counting them reserved would both reject collisions
 * with elements that are not on the page and let a real one through. This is the single place
 * that decision is made, for sections and blocks alike, and it is called directly from the
 * test below on both so neither path can lose it quietly.
 */
const nodeIds = (node, kind) => {
  if (!node.type || node.disabled === true) return [];
  const source = fileFor(node.type, kind);
  return [
    ...[...new Set(emitted(source))].map((id) => [id, source]),
    ...Object.values(node.blocks ?? {}).flatMap((child) => nodeIds(child, 'block')),
  ];
};

/* Split from the file read so the test below can hand it a template of its own making. */
const inventory = (parsed, file) => {
  const anchors = [];
  const taken = [];
  for (const [key, section] of Object.entries(parsed.sections ?? {})) {
    taken.push(...nodeIds(section, 'section'));

    /* A hidden section is not a destination either -- an anchor stored on one points at
       nothing -- so it is left out of the set the reachability checks are built from. */
    if (section.disabled === true) continue;

    const settings = section.settings ?? {};
    const anchor = settings.anchor;
    if (anchor != null && String(anchor).trim() !== '') anchors.push({ key, anchor });
    const id = settings.id;
    if (typeof id === 'string' && id.trim() !== '') {
      for (const prefix of EMITS.get(section.type) ?? []) taken.push([`${prefix}${id}`, `${file} ${key} ${prefix || 'id'}`]);
    }
  }
  return { anchors, taken };
};

const idsIn = (file) => inventory(JSON.parse(stripBanner(read(file))), file);

test('every stored anchor is reachable and unique on the page it renders on', () => {
  const templates = readdirSync(join(root, 'templates')).filter((name) => name.endsWith('.json')).map((name) => join('templates', name));

  const cache = new Map();
  const idsFor = (file) => {
    if (!cache.has(file)) cache.set(file, idsIn(file));
    return cache.get(file);
  };

  /*
   * A template chooses its layout, and one here does. `templates/password.json` sets
   * `"layout": "password"`, and `layout/password.liquid` is a different page: it emits
   * `password-form`, `password-dialog-heading` and `Password`, renders its own
   * `{% section 'password-footer' %}`, and names neither of the theme's section groups.
   * Seeding every template from `theme.liquid` both missed those three ids and lent the
   * password page a header and footer it does not have. `"layout": false` means no layout.
   */
  const layoutFor = (file) => {
    const chosen = JSON.parse(stripBanner(read(file))).layout;
    if (chosen === false) return null;
    return join('layout', `${typeof chosen === 'string' && chosen !== '' ? chosen : 'theme'}.liquid`);
  };

  /* What a layout puts on every page it wraps: its own ids and its snippets', any single
     section it renders itself, and the section groups it names -- read out of the layout
     rather than listed here, so moving a group does not quietly shrink the check. */
  const wrappers = new Map();
  const wrapper = (layoutFile) => {
    if (layoutFile === null) return { ids: [], groups: [] };
    if (!wrappers.has(layoutFile)) {
      const source = read(layoutFile);
      const own = [...source.matchAll(/\{%-?\s*section\s+'([^']+)'/g)].flatMap((m) =>
        emitted(join('sections', `${m[1]}.liquid`))
      );
      wrappers.set(layoutFile, {
        ids: [...new Set([...emitted(layoutFile), ...own])].map((id) => [id, layoutFile]),
        groups: [...source.matchAll(/\{%-?\s*sections\s+'([^']+)'/g)].map((m) => `sections/${m[1]}.json`),
      });
    }
    return wrappers.get(layoutFile);
  };

  /* An id a caller passed in as a literal is reserved like any other. `templates/collection
     .json` enables a `filters` block, `blocks/filters.liquid:455` renders
     `theme-drawer-header` with `heading_id: 'filters-drawer-heading'`, and the snippet writes
     it out -- so it is on that page and must not be free for an anchor. */
  assert.ok(
    idsFor('templates/collection.json').taken.some(([id]) => id === 'filters-drawer-heading'),
    'filters-drawer-heading is not reserved on the collection page; a literal render argument is being dropped'
  );

  /*
   * And a hidden one is not. `templates/product.json` carries a `coffee-quiz` section with
   * `disabled: true`; `sections/coffee-quiz.liquid` emits `id="coffee-quiz"`, and that is the
   * one id in the whole theme reserved by nothing but a hidden section. Counting it would cost
   * a merchant `#coffee-quiz` on the product page for an element that is not there.
   */
  assert.ok(
    !idsFor('templates/product.json').taken.some(([id]) => id === 'coffee-quiz'),
    'coffee-quiz is reserved on the product page, but the section emitting it is hidden; the disabled filter is not firing',
  );
  assert.ok(
    Object.values(JSON.parse(stripBanner(read('templates/product.json'))).sections ?? {}).some(
      (section) => section.type === 'coffee-quiz' && section.disabled === true,
    ),
    'the hidden coffee-quiz section is gone from templates/product.json, so the check above no longer tests anything; point it at another hidden section that emits an id',
  );

  /*
   * An anchor stored on a hidden section is the other half of it, and no section in the
   * committed theme is both hidden and anchored -- so this one is put to a template of its
   * own making rather than left to a condition that happens to be unreachable today. Hiding
   * the four sections that do carry `anchor: "reviews"` is what this was failing to notice.
   */
  assert.deepEqual(
    inventory(
      {
        sections: {
          live: { type: 'section', settings: { anchor: 'alpha' } },
          hidden: { type: 'section', disabled: true, settings: { anchor: 'beta' } },
        },
      },
      'synthetic',
    ).anchors.map(({ anchor }) => anchor),
    ['alpha'],
    'an anchor on a hidden section is still counted as a destination, so hiding every anchored section would leave this test green',
  );

  /*
   * The same gate on a block, called directly because no block in the committed theme is both
   * hidden and the source of a static id -- so without this the block half of `nodeIds` would
   * be covered by nothing. `blocks/filters.liquid` emits `filters-drawer`, and the collection
   * template configures it live, which is what the assertion above this one rests on.
   */
  const asBlock = (extra) => nodeIds({ type: 'section', blocks: { b: { type: 'filters', ...extra } } }, 'section');
  assert.ok(
    asBlock({}).some(([id]) => id === 'filters-drawer'),
    'a live filters block no longer reserves filters-drawer; the probe below is testing nothing',
  );
  assert.ok(
    !asBlock({ disabled: true }).some(([id]) => id === 'filters-drawer'),
    'a hidden block still reserves its ids; the disabled filter does not reach blocks',
  );
  assert.ok(
    !nodeIds({ type: 'section', blocks: { b: { type: 'group', blocks: { c: { type: 'filters' } } , disabled: true } } }, 'section')
      .some(([id]) => id === 'filters-drawer'),
    'a block nested under a hidden block still reserves its ids; hiding a parent must take its children with it',
  );

  /* The `data-testid` trap applies to every form the id can take, and the theme has no
     `data-testid="{{ someVariable }}"` today -- so this one is checked on the pattern rather
     than on a file, which is the only way to keep it from being a comment. */
  assert.equal([...'<i id="{{ heading_id }}">'.matchAll(VARIABLE_ID)].length, 1, 'a variable id is no longer recognised');
  assert.equal(
    [...'<i data-testid="{{ heading_id }}">'.matchAll(VARIABLE_ID)].length,
    0,
    'data-testid is being read as an id; a test attribute would cost a merchant a valid anchor'
  );

  /* Whitespace is ASCII-only, both ways round. An id may not contain a space or a tab; it may
     contain a non-breaking space, and a fragment carrying the same NBSP resolves to it. */
  assert.ok(!reachable('cafe training'), 'an anchor with a space is being treated as reachable');
  assert.ok(!reachable('cafe\ttraining'), 'an anchor with a tab is being treated as reachable');
  assert.ok(reachable('cafe\u00a0training'), 'an anchor with a non-breaking space is rejected, but HTML allows it and the fragment resolves');

  const theme = wrapper('layout/theme.liquid');
  assert.ok(theme.groups.length >= 2, `the theme layout names ${theme.groups.length} section groups; the probe is broken`);

  /* The layout's ids -- `MainContent`, `header-group` -- are on the page before a section
     renders. An anchor duplicating one sends `#MainContent` to the wrapper instead of the
     section. Through its snippets too: `{% render 'search-modal' %}` puts `id="search-modal"`
     on every page, and reading only the layout file misses it. */
  assert.ok(theme.ids.length >= 2, `the theme layout emits ${theme.ids.length} static ids; the probe is broken`);
  assert.ok(
    theme.ids.some(([id]) => id === 'search-modal'),
    'the layout scan no longer reaches its snippets; search-modal comes from snippets/search-modal.liquid'
  );

  /* A constant Liquid id is reserved like any other. Both of the theme's two live in
     search-modal, which the layout renders on every page. */
  assert.ok(
    theme.ids.some(([id]) => id === 'cmdk-input'),
    'cmdk-input is not reserved; a constant Liquid id is being read as no id at all'
  );

  /* The other one in that file is a `data-testid`, not an id -- `search-modal.liquid:46`
     against `:70` -- so the boundary has to hold on this form too, or a test attribute costs
     a merchant a valid anchor the same way the plain ones did. */
  assert.ok(
    !theme.ids.some(([id]) => id === 'search-component--modal'),
    'search-component--modal is reserved, but it is a data-testid; the id boundary does not hold on constant Liquid values'
  );

  /* And if one of them grows a filter the evaluator does not know, it would stop being
     reserved without saying so. Fail here instead, where the reason is written down. */
  const unknown = [];
  for (const dir of ['layout', 'sections', 'snippets', 'blocks']) {
    for (const name of readdirSync(join(root, dir)).filter((file) => file.endsWith('.liquid'))) {
      for (const match of read(join(dir, name)).matchAll(LITERAL_ID)) {
        if (!INERT_FILTERS.test(match[2])) unknown.push(`${dir}/${name}: ${match[0]}`);
      }
    }
  }
  assert.deepEqual(
    unknown,
    [],
    'these constant ids pass through a filter that may rewrite them, so they are not reserved; teach INERT_FILTERS or reserve the rendered value'
  );

  /* Tripwire for the dead-branch gate. `quick-add-dialog` lives in `snippets/quick-add-modal
     .liquid`, which theme.liquid renders only when quick add is on; it is off in the committed
     config, so the element is not on the page and must not be reserved. If quick add is ever
     turned on, this flips -- and the collision set should grow, which is the point. */
  assert.ok(
    !theme.ids.some(([id]) => id === 'quick-add-dialog'),
    'quick-add-dialog is reserved although quick add is off; the dead-branch gate is not firing'
  );
  assert.ok(
    SETTINGS.quick_add === false && SETTINGS.mobile_quick_add === false,
    'quick add is now enabled, so the tripwire above no longer tests anything; re-point it at another dead branch'
  );

  const password = wrapper(layoutFor('templates/password.json'));
  assert.ok(
    password.ids.some(([id]) => id === 'password-form') && password.groups.length === 0,
    'the password template no longer resolves to layout/password.liquid; the per-template layout lookup is broken'
  );

  /* The groups reach every page their layout wraps, so their section types' own ids do too.
     Without this the set holds only what the group JSON configures, and `header-component` --
     which is on every page from `sections/header.liquid` -- is absent. */
  const fromGroupMarkup = theme.groups
    .flatMap((file) => idsFor(file).taken)
    .filter(([, where]) => where.endsWith('.liquid'));
  assert.ok(
    fromGroupMarkup.length >= 1,
    `the section groups instantiate no type that emits a static id; the probe is broken`
  );

  /* Counted once over the whole universe, not inside the per-template loop. A group anchor is
     set exactly once however many templates render it, and the previous form recognised a group
     owner and then added nothing -- so an anchor stored in `footer-group.json` left this at
     zero and the inertness claim went unchecked for the one file that reaches every page. */
  const everyGroup = [...new Set(templates.flatMap((file) => wrapper(layoutFor(file)).groups))];
  const found = [...templates, ...everyGroup].flatMap((file) =>
    idsFor(file).anchors.map(({ key, anchor }) => ({ file, key, anchor })),
  );
  const set = found.length;

  const unreachable = [];
  const collisions = [];
  for (const file of templates) {
    const layout = wrapper(layoutFor(file));
    const page = [[file, idsFor(file)], ...layout.groups.map((group) => [group, idsFor(group)])];
    const taken = new Map(layout.ids);
    for (const [, { taken: ids }] of page) for (const [id, where] of ids) if (!taken.has(id)) taken.set(id, where);

    for (const [owner, { anchors }] of page) {
      for (const { key, anchor } of anchors) {
        if (!reachable(anchor)) {
          unreachable.push(`${owner} ${key}: ${JSON.stringify(anchor)}`);
          continue;
        }
        if (taken.has(anchor)) collisions.push(`${file}: anchor ${anchor} on ${owner} ${key} already taken by ${taken.get(anchor)}`);
        else taken.set(anchor, `${owner} ${key} anchor`);
      }
    }
  }

  assert.deepEqual(unreachable, [], 'these anchors are not usable as a URL fragment');
  assert.deepEqual(collisions, [], 'these anchors collide with another id on the same rendered page');
  assert.ok(templates.length >= 7, `only ${templates.length} templates scanned; the probe is broken`);
  /*
   * When this was written no section set an anchor, and the check above was `set === 0` -- a
   * tripwire on its own premise rather than a claim about the anchors. Four now do: the PDP
   * reviews section carries `anchor: "reviews"` on each of the four product templates, so
   * `#reviews` is a real destination and the two checks above are covering it rather than
   * covering nothing.
   *
   * The tripwire stays, pointed at the set instead of at zero, so it fires on either
   * direction of drift -- a new anchor to look at, or these ones disappearing and quietly
   * taking the coverage with them.
   */
  assert.deepEqual(
    [...new Set(found.map((entry) => entry.anchor))].sort(),
    ['reviews'],
    `the anchors in use have changed (${JSON.stringify(found)}) -- confirm the new ones are ` +
      'reachable and unique rather than assuming this check still covers them',
  );
  assert.ok(set > 0, 'no section sets an anchor, so the two checks above are covering nothing');
});

/*
 * The reason the setting exists. If the live anchors ever become something this setting cannot
 * carry, the rebuild plan is wrong and this says so before the swap, not after.
 */
test('the wholesale anchors the contents list points at are expressible as this setting', () => {
  const parsed = JSON.parse(stripBanner(read('templates/page.wholesale.json')));
  const sections = Object.values(parsed.sections ?? {});
  const owned = new Map();
  for (const section of sections) {
    const id = (section.settings ?? {}).id;
    if (typeof id === 'string' && id) owned.set(id, section.type);
  }

  /* Scoped to the contents list itself. Counting every in-page link on the page happens to give
     the same four today, which would make this pass for a reason that has nothing to do with the
     section the PR is about. */
  const contents = sections.filter((section) => section.type === 'ona-icon-and-content');
  assert.equal(contents.length, 1, `wholesale has ${contents.length} ona-icon-and-content sections; expected the one contents list`);

  const targets = new Set();
  const visit = (node) => {
    for (const value of Object.values(node.settings ?? {})) {
      if (typeof value === 'string' && value.startsWith('#') && owned.has(value.slice(1))) {
        targets.add(value.slice(1));
      }
    }
    for (const child of Object.values(node.blocks ?? {})) visit(child);
  };
  visit(contents[0]);

  assert.ok(targets.size >= 4, `only ${targets.size} in-page anchor targets found in the contents list; the probe is broken`);
  const unusable = [...targets].filter((anchor) => !reachable(anchor));
  assert.deepEqual(unusable, [], 'these live anchors cannot be carried by the new setting');
});
