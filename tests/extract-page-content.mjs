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

const sourceOf = (type) => {
  for (const dir of [LIQUID_DIR, BLOCK_DIR]) {
    try {
      return readFileSync(new URL(`${type}.liquid`, dir), 'utf8');
    } catch {
      /* not this directory */
    }
  }
  return null;
};

const schemaOf = (type) => {
  const source = sourceOf(type);
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
      const schema = schemaOf(name.replace(/\.liquid$/, ''));
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

const visibleIfFalse = (expression, settings, defaults) => {
  const body = expression.replace(/^\s*\{\{\s*/, '').replace(/\s*\}\}\s*$/, '').trim();
  if (body === 'false') return true;
  /* `or` would need both sides false to hide; keeping to `and` means an unparsed `or` falls
     through to "visible", which is the safe direction. */
  if (/\bor\b/.test(body)) return false;

  for (const part of body.split(/\s+and\s+/)) {
    const match = CLAUSE.exec(part.trim());
    if (!match) continue;
    const [, key, operator, single, double, literal] = match;
    const actual = Object.hasOwn(settings, key) ? settings[key] : defaults.get(key);
    if (!operator) {
      if (actual === false || actual === '' || actual == null) return true;
      continue;
    }
    const expected = literal === 'blank' || literal === 'empty'
      ? ''
      : literal === 'true' ? true : literal === 'false' ? false : (single ?? double);
    const blankish = (value) => value === '' || value == null || value === false;
    const equal = expected === '' ? blankish(actual) : actual === expected;
    if (operator === '==' ? !equal : equal) return true;
  }
  return false;
};

/* The ids a component renders itself, via `content_for 'block', ... id: '<id>'`. These children
   are placed by the markup, not by `block_order`, so a parent with `block_order: []` still
   renders them -- `blocks/media-with-text.liquid` draws `media` and `content` that way, and the
   product templates store the visible image in exactly that static child. */
const staticChildren = (type) => {
  const source = sourceOf(type);
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

  const hrefs = [...source.matchAll(/(?:href|action)="(\/[^"{]*|https?:\/\/[^"{]*)"/g)]
    .map((match) => match[1])
    .filter((href) => !href.startsWith('javascript:'));

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
  ];
}

export function extract(templatePath) {
  const parsed = JSON.parse(stripBanner(readFileSync(templatePath, 'utf8')));
  const required = [];
  const chrome = [];
  const disabled = [];

  const visit = (node, path, live) => {
    const settings = node.settings ?? {};
    const schema = node.type ? schemaOf(node.type) : null;
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
        live && !(conditions.has(key) && visibleIfFalse(conditions.get(key), settings, defaults));
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
    const placed = node.type ? staticChildren(node.type) : new Set();
    for (const [childKey, child] of Object.entries(node.blocks ?? {})) {
      const rendered =
        !child.disabled && (ordered === null || ordered.has(childKey) || placed.has(childKey));
      visit(child, `${path}/${childKey}`, live && rendered);
    }
  };

  for (const [key, section] of Object.entries(parsed.sections ?? {})) {
    const live = !section.disabled;
    visit(section, `${key}(${section.type})`, live);
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
