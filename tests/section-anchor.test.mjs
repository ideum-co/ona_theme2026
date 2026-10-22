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
const FRAGMENT = /^[^\s#][^\s]*$/;
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
 * The filters that cannot change a non-blank literal: `default:` is a no-op on one, and
 * `escape` and `strip` leave an id-shaped string alone. Anything else -- `handle`, `append`,
 * `md5` -- renders a different string, and guessing it would reserve a name that is not on the
 * page while still missing the one that is. Those are not skipped silently; the test below
 * fails on them, because a constant id that quietly stops being reserved is the bug this
 * whole addition exists to fix.
 */
const INERT_FILTERS = /^(?:\s*\|\s*(?:escape|strip)\s*|\s*\|\s*default:\s*(?:'[^']*'|"[^"]*")\s*)*$/;

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
const emitted = (file, seen = new Set()) => {
  if (seen.has(file)) return [];
  seen.add(file);
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
  for (const match of source.matchAll(/\{%-?\s*(?:render|include)\s+'([^']+)'/g)) {
    if (!live(match)) continue;
    ids.push(...emitted(join('snippets', `${match[1]}.liquid`), seen));
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

const idsIn = (file) => {
  const parsed = JSON.parse(stripBanner(read(file)));
  const anchors = [];
  const taken = [];
  for (const [key, section] of Object.entries(parsed.sections ?? {})) {
    const settings = section.settings ?? {};
    const anchor = settings.anchor;
    if (anchor != null && String(anchor).trim() !== '') anchors.push({ key, anchor });
    const id = settings.id;
    if (typeof id === 'string' && id.trim() !== '') {
      for (const prefix of EMITS.get(section.type) ?? []) taken.push([`${prefix}${id}`, `${file} ${key} ${prefix || 'id'}`]);
    }
    /* The section's own markup and its snippets, plus every block the JSON configures under it
       and theirs -- a configured block is as much on the page as the section holding it. */
    const walk = (node, kind) => {
      if (!node.type) return;
      const source = fileFor(node.type, kind);
      for (const id of new Set(emitted(source))) taken.push([id, source]);
      for (const child of Object.values(node.blocks ?? {})) walk(child, 'block');
    };
    walk(section, 'section');
  }
  return { anchors, taken };
};

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
  const set = [...templates, ...everyGroup].reduce((total, file) => total + idsFor(file).anchors.length, 0);

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
  assert.equal(set, 0, `${set} section(s) now set an anchor; this PR claimed none did, so re-check that claim before trusting it`);
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
