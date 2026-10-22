/*
 * Extracts the user-visible content of a template: the values a reader would notice if they
 * vanished. Shared by the preservation test and by the fixture generator, so the fixture and
 * the check can never drift apart by reading the template two different ways.
 *
 * Regenerate a fixture deliberately, never to make a red test green:
 *   node tests/extract-page-content.mjs templates/page.wholesale.json > tests/fixtures/wholesale-content.json
 * A value that leaves the page is a content decision and belongs in the PR that makes it.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

/* Copy, media and destinations. Losing one of these loses information.
 *
 * The hand-written half covers the legacy `ona-*` sections this page is built from. It is a
 * floor, not the list: the rebuild moves this content into Horizon components whose settings are
 * named differently -- a CTA's copy becomes `blocks/button.liquid`'s `label`, an icon becomes
 * `blocks/icon.liquid`'s `image_upload` -- and a key missing from here reads as content that
 * left the page. SCHEMA_CONTENT_KEYS adds every setting in the theme whose declared type carries
 * copy, media or a destination, so a value that moves into a documented target is still seen. */
const LEGACY_CONTENT_KEYS = [
  'main_title', 'title', 'title2', 'subtitle', 'subtitle2', 'content', 'text', 'tips',
  'video_title', 'button_text',
  'image', 'image2', 'image3', 'bottom_image', 'icon', 'video',
  'link', 'url', 'button_url', 'video_url',
  'id',
];

/* Types whose value a reader notices. Everything else -- select, range, color, checkbox,
   text_alignment -- is presentation the replacement brings its own version of. */
const CONTENT_TYPES = new Set([
  'text', 'textarea', 'richtext', 'inline_richtext', 'html', 'liquid',
  'url', 'video_url', 'video', 'image_picker',
]);

/* Player furniture and layout decoration: the replacement brings its own, so these are recorded
   for the diff but not required to survive. Checked before the content keys, because deriving
   from schemas sweeps `overlay` and `play_icon` in on type alone and would silently promote
   them. */
export const CHROME_KEYS = new Set(['play_icon', 'overlay']);

export const stripBanner = (text) => text.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');

/* Rich text fields hold markup; the information is the words and the destinations, not the tags.
   Hrefs are pulled out separately so a link buried in a paragraph still counts as content. */
const BOUNDARY = /<\/(?:li|p|h[1-6]|div|td|th|tr|blockquote)>|<br\s*\/?>/gi;

export const normalise = (value) =>
  value
    /* Structural boundaries first. Four bullets with no full stops collapse into one sentence
       if every tag becomes a space, and then moving each bullet into its own block reads as a
       loss because the comparison wants a shingle spanning two of them. A newline here keeps
       each item its own unit without inventing punctuation. */
    .replace(BOUNDARY, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n+/g, '\n')
    .trim();

const hrefsIn = (value) => [...value.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);

/* Visible text and destinations written directly into a section's Liquid, as opposed to coming
   from the template's settings. Everything that is not rendered prose is removed first: the
   schema, styles, scripts, comments and every Liquid tag and output. What is left is the text
   a reader sees regardless of how the template is configured. */
const LIQUID_DIR = new URL('../sections/', import.meta.url);
const BLOCK_DIR = new URL('../blocks/', import.meta.url);

/*
 * A type name alone does not say which file renders it. `product-media-with-text` exists twice:
 * `sections/product-media-with-text.liquid` places one static child, the block of the same name,
 * and `blocks/product-media-with-text.liquid` places `media` and `content` inside it. Reading
 * the section file for the nested node hides exactly the children the block renders, so the
 * node's kind -- top level is a section, anything nested is a block -- picks the directory.
 */
const sourceOf = (type, kind) => {
  const dirs = kind === 'section' ? [LIQUID_DIR, BLOCK_DIR] : [BLOCK_DIR, LIQUID_DIR];
  for (const dir of dirs) {
    try {
      return readFileSync(new URL(`${type}.liquid`, dir), 'utf8');
    } catch {
      /* not this directory */
    }
  }
  return null;
};

const schemaOf = (type, kind) => {
  const source = sourceOf(type, kind);
  const match = source && source.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
};

/* Every setting in the theme whose type carries content, read from the schemas rather than
   listed here, so a component the rebuild adopts is covered the day it lands. */
const schemaSettings = () => {
  const all = [];
  for (const [dir, url] of [['sections', LIQUID_DIR], ['blocks', BLOCK_DIR]]) {
    let names = [];
    try {
      names = readdirSync(url).filter((name) => name.endsWith('.liquid'));
    } catch {
      continue;
    }
    for (const name of names) {
      const schema = schemaOf(name.replace(/\.liquid$/, ''), dir === 'sections' ? 'section' : 'block');
      for (const entry of schema?.settings ?? []) if (entry?.id) all.push([`${dir}/${name}`, entry]);
    }
  }
  return all;
};

const SCHEMA_CONTENT_KEYS = new Set(
  schemaSettings()
    .filter(([, entry]) => CONTENT_TYPES.has(entry.type))
    .map(([, entry]) => entry.id)
);

export const CONTENT_KEYS = new Set([...LEGACY_CONTENT_KEYS, ...SCHEMA_CONTENT_KEYS]);

/*
 * A setting can be stored and still not be on the page. `blocks/video.liquid` declares
 * `video_url` with `visible_if: {{ block.settings.source == 'url' }}`, so a template left on the
 * default `source: uploaded` carries a URL the visitor never sees. Freezing it would make a
 * rebuild that drops it look like a loss, and -- worse -- would let the test pass while the
 * uploaded video it actually shows goes missing.
 *
 * Only a condition this understands and can prove false hides a setting. Anything unparsed
 * stays required: over-freezing costs a false alarm, under-freezing costs the content.
 */
const CLAUSE =
  /^(?:block|section)\.settings\.([\w-]+)\s*(?:(==|!=)\s*(?:'([^']*)'|"([^"]*)"|(blank|true|false|empty)))?$/;

/*
 * Three-valued, because the point is to be sure. A clause this grammar does not cover
 * evaluates to `null` (unknown), `and` and `or` propagate that, and only a definite `false`
 * hides anything. Over-freezing costs a false alarm; under-freezing costs the content.
 */
const clauseValue = (part, settings, defaults) => {
  const text = part.trim();
  if (text === 'false') return false;
  if (text === 'true') return true;
  const match = CLAUSE.exec(text);
  if (!match) return null;
  const [, key, operator, single, double, literal] = match;
  const actual = Object.hasOwn(settings, key) ? settings[key] : defaults.get(key);
  const blankish = (value) => value === '' || value == null || value === false;
  if (!operator) return !blankish(actual);
  const expected =
    literal === 'blank' || literal === 'empty'
      ? ''
      : literal === 'true' ? true : literal === 'false' ? false : (single ?? double);
  const equal = expected === '' ? blankish(actual) : actual === expected;
  return operator === '==' ? equal : !equal;
};

/* Liquid has no precedence: it folds right to left, so `a and b or c` is `a and (b or c)`.
   Splitting on `or` first and `and` within reproduces that for the shapes here. */
const evaluate = (body, settings, defaults) => {
  const parts = body.split(/\s+or\s+/);
  if (parts.length > 1) {
    let result = false;
    for (const part of parts) {
      const value = evaluate(part, settings, defaults);
      if (value === true) return true;
      if (value === null) result = null;
    }
    return result;
  }
  const conjuncts = body.split(/\s+and\s+/);
  if (conjuncts.length > 1) {
    let result = true;
    for (const conjunct of conjuncts) {
      const value = evaluate(conjunct, settings, defaults);
      if (value === false) return false;
      if (value === null) result = null;
    }
    return result;
  }
  return clauseValue(body, settings, defaults);
};

const conditionFalse = (expression, settings, defaults) =>
  evaluate(expression.replace(/^\s*\{\{\s*/, '').replace(/\s*\}\}\s*$/, '').trim(), settings, defaults) === false;

const visibleIfFalse = conditionFalse;

/*
 * The legacy sections do not declare `visible_if`; they branch in Liquid. `ona-supported`
 * renders `block.settings.video_url` only inside
 * `{% if block.settings.media_type == 'embed' or block.settings.media_type == 'upload' %}`,
 * and wholesale has a block on `media_type: "image"` still carrying a YouTube URL from an
 * earlier edit. Frozen as required, that phantom would fail a rebuild that faithfully carries
 * the image and drops the dead link.
 *
 * So: for each setting a section's markup mentions, collect the `{% if %}` conditions enclosing
 * every mention. The setting is hidden only when every single mention sits under a condition
 * that is definitely false. A mention anywhere unguarded, or under something unparsed, keeps it
 * required -- and a setting the markup never mentions is never hidden on this evidence.
 *
 * `{% else %}` drops the branch condition rather than negating it: an else-branch mention is
 * not governed by the if, and guessing the negation could hide something real. `{% else if %}`
 * is deliberately treated as `{% else %}`, which is what Liquid itself does with it -- the
 * theme has two of those typos and this must read the page the parser builds.
 */
const guardCache = new Map();

const guardsFor = (type, kind) => {
  const cacheKey = `${kind}:${type}`;
  if (guardCache.has(cacheKey)) return guardCache.get(cacheKey);

  const source = sourceOf(type, kind);
  const guards = new Map();
  if (!source) {
    guardCache.set(cacheKey, guards);
    return guards;
  }
  const body = source.replace(/\{%\s*schema\s*%\}[\s\S]*?\{%\s*endschema\s*%\}/g, '');

  const stack = [];
  const TAG = /\{%-?\s*(if|unless|elsif|else\s+if|else|endif|endunless)\b([^%]*?)-?%\}|(?:block|section)\.settings\.([\w-]+)/g;
  for (const match of body.matchAll(TAG)) {
    const [, tag, argument, key] = match;
    if (key !== undefined) {
      if (!guards.has(key)) guards.set(key, []);
      guards.get(key).push([...stack]);
      continue;
    }
    if (tag === 'if') stack.push(argument.trim());
    else if (tag === 'unless') stack.push(null);
    else if (tag === 'endif' || tag === 'endunless') stack.pop();
    else stack[stack.length - 1] = null; /* elsif, else, and Liquid's reading of `else if` */
  }

  guardCache.set(cacheKey, guards);
  return guards;
};

/*
 * A legacy section's blocks are declared in its own schema and rendered in its own Liquid --
 * `ona-supported`'s items have no `blocks/*.liquid` of their own. So the markup that decides
 * whether one of their settings renders is the *section's*, and a block with no file falls back
 * to the nearest ancestor that has one.
 */
const hiddenByMarkup = (type, kind, key, settings, defaults, owner) => {
  const source = sourceOf(type, kind) ? { type, kind } : owner;
  if (!source) return false;
  const occurrences = guardsFor(source.type, source.kind).get(key);
  if (!occurrences || occurrences.length === 0) return false;
  return occurrences.every((conditions) =>
    conditions.some((condition) => condition !== null && conditionFalse(condition, settings, defaults))
  );
};

/* The ids a component renders itself, via `content_for 'block', ... id: '<id>'`. These children
   are placed by the markup, not by `block_order`, so a parent with `block_order: []` still
   renders them -- `blocks/media-with-text.liquid` draws `media` and `content` that way, and the
   product templates store the visible image in exactly that static child. */
const staticChildren = (type, kind) => {
  const source = sourceOf(type, kind);
  if (!source) return new Set();
  return new Set([...source.matchAll(/content_for\s+'block'[^%]*?\bid:\s*'([^']+)'/g)].map((m) => m[1]));
};


export function literalsIn(type) {
  let source;
  try {
    source = readFileSync(new URL(`${type}.liquid`, LIQUID_DIR), 'utf8');
  } catch {
    return [];
  }

  /* Script and style elements are not content, and their sources must not become things the
     rebuild has to preserve. The text pass below strips them; the attribute passes read this
     copy so they strip them too. */
  const markup = source
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<script\b[^>]*\/?>/gi, ' ');

  const hrefs = [...markup.matchAll(/(?:href|action)="(\/[^"{]*|https?:\/\/[^"{]*)"/g)]
    .map((match) => match[1])
    .filter((href) => !href.startsWith('javascript:'));

  /* A static `src` on a visible media element is a destination like any other, and reading
     only `href` and `action` missed a whole video: `sections/ona-gust-r.liquid:63` hardcodes
     `<iframe src="https://www.youtube.com/embed/42flR1Iwun4">`, and blanking it left both
     preservation tests green -- a rebuild could keep the promo's copy and drop the film. */
  const sources = [
    ...markup.matchAll(/<(?:iframe|img|video|source|audio|embed)\b[^>]*?\bsrc="(\/[^"{]*|https?:\/\/[^"{]*)"/gi),
  ].map((match) => match[1]);

  const stripped = source
    .replace(/\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/g, ' ')
    .replace(/\{%-?\s*(style|stylesheet|javascript)\s*-?%\}[\s\S]*?\{%-?\s*end\1\s*-?%\}/g, ' ')
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, ' ')
    .replace(/\{%-?\s*doc\s*-?%\}[\s\S]*?\{%-?\s*enddoc\s*-?%\}/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\{\{[\s\S]*?\}\}/g, ' ')
    .replace(/\{%[\s\S]*?%\}/g, ' ');

  const text = [];
  for (const chunk of stripped.split(/<[^>]*>/)) {
    const value = chunk.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    /* Needs a letter and more than a stray word fragment, or CSS leftovers and single
       punctuation marks become "content" that must survive forever. */
    if (value.length >= 3 && /[A-Za-z]{2}/.test(value)) text.push(value);
  }

  return [
    ...[...new Set(text)].map((value) => ({ key: 'liquid', value })),
    ...[...new Set(hrefs)].map((value) => ({ key: 'liquid@href', value })),
    ...[...new Set(sources)].map((value) => ({ key: 'liquid@src', value })),
  ];
}

export function extract(templatePath) {
  const parsed = JSON.parse(stripBanner(readFileSync(templatePath, 'utf8')));
  const required = [];
  const chrome = [];
  const disabled = [];

  const visit = (node, path, live, kind, owner) => {
    const settings = node.settings ?? {};
    const schema = node.type ? schemaOf(node.type, kind) : null;
    const defaults = new Map((schema?.settings ?? []).filter((e) => e?.id).map((e) => [e.id, e.default]));
    const conditions = new Map(
      (schema?.settings ?? []).filter((e) => e?.id && e.visible_if).map((e) => [e.id, e.visible_if])
    );

    for (const [key, value] of Object.entries(settings)) {
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (!trimmed) continue;

      /* Chrome first: deriving content keys from schemas would otherwise claim `overlay` and
         `play_icon` on type alone. */
      const shown =
        live &&
        !(conditions.has(key) && visibleIfFalse(conditions.get(key), settings, defaults)) &&
        !(node.type && hiddenByMarkup(node.type, kind, key, settings, defaults, owner));
      const bucket = CHROME_KEYS.has(key) ? chrome : CONTENT_KEYS.has(key) ? (shown ? required : disabled) : null;
      if (!bucket) continue;

      const text = normalise(trimmed);
      if (text) bucket.push({ where: path, key, value: text });
      for (const href of hrefsIn(trimmed)) bucket.push({ where: path, key: `${key}@href`, value: href });
    }

    /* `disabled` is not the only way a block stops rendering. A block that stays in `blocks`
       but leaves `block_order` is not rendered either, and counting it as live means the
       preservation check passes while its title and copy disappear. Only applied where the
       parent actually declares an order -- Horizon has static blocks that legitimately sit
       outside one. */
    const order = node.block_order;
    const ordered = Array.isArray(order) ? new Set(order) : null;
    /* `block_order` governs the dynamic children only. A component that places a child itself
       renders it whatever the order says, so those ids are exempt -- otherwise every
       `media-with-text` with `block_order: []` reads as having lost its image. */
    const placed = node.type ? staticChildren(node.type, kind) : new Set();
    for (const [childKey, child] of Object.entries(node.blocks ?? {})) {
      const rendered =
        !child.disabled && (ordered === null || ordered.has(childKey) || placed.has(childKey));
      visit(child, `${path}/${childKey}`, live && rendered, 'block', sourceOf(node.type, kind) ? { type: node.type, kind } : owner);
    }
  };

  for (const [key, section] of Object.entries(parsed.sections ?? {})) {
    const live = !section.disabled;
    visit(section, `${key}(${section.type})`, live, 'section', null);
    /* Settings are not the only place this page keeps content. `ona-gust-r` has an empty
       settings object and renders the entire wholesale enquiry form -- heading, field labels,
       submit button -- as literals in its Liquid, and the Monday-form CTAs in the partnership,
       training and testimonial sections are literals too. Read from the template alone, the
       whole form could be deleted and nothing here would notice. */
    for (const literal of literalsIn(section.type)) {
      (live ? required : disabled).push({ where: `${key}(${section.type})`, key: literal.key, value: literal.value });
    }
  }

  return { required, chrome, disabled };
}

if (process.argv[1] && process.argv[1].endsWith('extract-page-content.mjs')) {
  const [, , target] = process.argv;
  if (!target) {
    console.error('usage: node tests/extract-page-content.mjs <template.json>');
    process.exit(2);
  }
  const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  console.log(JSON.stringify({ source: target, generated_from: sha, ...extract(target) }, null, 2));
}
