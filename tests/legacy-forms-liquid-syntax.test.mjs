import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const liquidFiles = ['sections', 'snippets', 'blocks', 'layout'].flatMap((dir) =>
  readdirSync(resolve(root, dir))
    .filter((name) => name.endsWith('.liquid'))
    .map((name) => `${dir}/${name}`)
);

test('no third-party form-app shortcode is left to render as literal text', () => {
  // These are Powerful Form Builder placeholders carried over from the production
  // theme. That app is not installed here, so Liquid emits them verbatim: on
  // 2026-10-16 the Wholesale page showed a bare "{formbuilder:50188}" in its body
  // copy, and Training and Private Experiences showed 112210 and 50341.
  const offenders = liquidFiles.filter((path) => /\{formbuilder:\d+\}/.test(read(path)));
  assert.deepEqual(offenders, [], `app shortcodes still present in ${offenders.join(', ')}`);
});

test('no Liquid filter is piped inside a form tag argument list', () => {
  // Why this test exists: PR #175 wrote
  //   {% form 'contact', id: 'ona-training-' | append: section.id, class: '...' %}
  // The form tag's grammar is `{% form 'type', attribute: string %}` -- it takes
  // literal or variable values, not a filter pipeline (render does, which is why
  // this check is scoped to form). Shopify rejected both files. The GitHub
  // integration dropped them and reported nothing: the third file in the same
  // commit synced, the merge looked clean, and theme 154676789439 quietly kept the
  // pre-#175 sections for a day. Assign first, then pass the variable.
  const offenders = [];

  for (const path of liquidFiles) {
    for (const [tag, args] of read(path).matchAll(/\{%-?\s*form\b([^%]*?)-?%\}/g)) {
      if (args.includes(',') && args.slice(args.indexOf(',') + 1).includes('|')) {
        offenders.push(`${path}: ${tag.trim()}`);
      }
    }
  }

  assert.deepEqual(offenders, [], `filters inside form tag arguments:\n${offenders.join('\n')}`);
});

test('each restored legacy enquiry form posts to Shopify contact', () => {
  for (const path of [
    'sections/ona-training-form.liquid',
    'sections/ona-expericences-content.liquid',
    'sections/ona-gust-r.liquid',
  ]) {
    const source = read(path);
    assert.match(source, /\{% form 'contact', id: form_id, class: 'ona-legacy-contact-form' %\}/, path);
    assert.match(source, /\{% endform %\}/, path);
    assert.match(source, /name="contact\[email\]"/, `${path} must collect the one required field`);
    assert.match(source, /name="contact\[body\]"/, path);
    assert.match(source, /name="contact\[subject\]"/, `${path} needs a subject so enquiries are triageable`);
  }
});

test('each restored form only shows feedback for its own submission', () => {
  // Shopify hands the result of a contact submission to EVERY contact form
  // rendered on that page, so `form.posted_successfully?` alone puts "Thank you"
  // under forms the customer never touched -- and `form.errors` puts a validation
  // error under them too. The Wholesale page is the live case: ona-gust-r's popup
  // form and the page's own enquiry form can both be on screen. Horizon's own
  // blocks/contact-form.liquid solves this by posting a hidden contact[id] and
  // comparing it with form.id; mirror that rather than trusting the HTML id.
  // Codex, PR #178.
  for (const path of [
    'sections/ona-training-form.liquid',
    'sections/ona-expericences-content.liquid',
    'sections/ona-gust-r.liquid',
  ]) {
    const source = read(path);

    assert.match(
      source,
      /<input type="hidden" name="contact\[id\]" value="\{\{ form_id \}\}">/,
      `${path} must post the discriminator Shopify compares against form.id`,
    );
    assert.match(
      source,
      /if form\.id == form_id or form\.id == blank\s*\n\s*assign form_matches = true/,
      `${path} must derive form_matches from the posted contact[id]`,
    );
    assert.match(
      source,
      /\{% if form\.posted_successfully\? and form_matches %\}/,
      `${path}: the success message must be gated on form_matches`,
    );
    assert.match(
      source,
      /\{% elsif form\.errors and form_matches %\}/,
      `${path}: the error message must be gated on form_matches`,
    );
  }
});

/*
 * Tags whose body is not Liquid: everything up to the matching end tag is
 * skipped wholesale.
 */
const RAW_BODY = new Set(['comment', 'raw', 'schema', 'stylesheet', 'javascript', 'doc']);

/* Tags that open a block and must be closed by end<name>. */
/*
 * `style` belongs here, not with the raw bodies: its content is CSS but Liquid
 * inside it is still parsed, so an `if` within a {% style %} must close before
 * {% endstyle %}.
 */
const BLOCK = new Set([
  'if', 'unless', 'for', 'case', 'capture', 'form', 'paginate', 'tablerow', 'ifchanged', 'style',
]);

/* Legal inside {% liquid %}: block openers and closers, plus these. */
const INLINE_ONLY = new Set([
  'assign', 'break', 'continue', 'cycle', 'decrement', 'echo', 'else', 'elsif', 'increment',
  'include', 'layout', 'render', 'section', 'sections', 'when', 'liquid', 'content_for',
]);

const KEYWORDS = new Set([
  ...BLOCK, ...[...BLOCK].map((b) => `end${b}`), ...RAW_BODY, ...[...RAW_BODY].map((r) => `end${r}`),
  ...INLINE_ONLY,
]);

/*
 * A line inside {% liquid %} whose first word happens to be a Liquid keyword is
 * not thereby a tag. The repo's house style is hard-wrapped prose inside
 * `comment` blocks, and a wrapped continuation routinely starts lowercase --
 * "for example, ...", "if in doubt, ...". Both of those sailed through an
 * earlier version of this check, and Liquid would reject both.
 */
const malformed = (keyword, rest) => {
  const args = rest.trim();
  if (/[.!?]$/.test(args)) return 'reads as prose, not a tag';
  if (keyword === 'assign') return /^[a-zA-Z_][\w.]*\s*=/.test(args) ? null : 'assign needs name = value';
  if (keyword === 'for') return /^\w+\s+in\s+\S/.test(args) ? null : 'for needs "x in y"';
  if (['if', 'unless', 'elsif', 'case', 'when', 'echo', 'render', 'include', 'increment', 'decrement', 'cycle']
    .includes(keyword)) return args ? null : `${keyword} needs an argument`;
  return null;
};

test('no prose sits loose inside a {% liquid %} block', () => {
  /*
   * Inside {% liquid %} every line is a tag, so prose only survives between
   * `comment` and `endcomment`. On 2026-10-19 a paragraph was added to the
   * store finder's opening block one line BELOW its `endcomment`, leaving six
   * lines of English where Liquid expected tags, plus a second stray
   * `endcomment`. Every regex-based test still passed, because they match
   * source text and never render. Codex caught it; this is the check that
   * should have.
   */
  const offenders = [];
  for (const path of liquidFiles) {
    for (const block of read(path).matchAll(/\{%-?\s*liquid\b([\s\S]*?)-?%\}/g)) {
      let inComment = false;
      for (const raw of block[1].split('\n')) {
        const line = raw.trim();
        if (!line) continue;
        // `# ...` is Liquid's inline comment inside a {% liquid %} block.
        if (line.startsWith('#')) continue;
        const [keyword, ...rest] = line.split(/[\s(]/);
        if (inComment) {
          if (keyword === 'endcomment') inComment = false;
          continue;
        }
        if (keyword === 'comment') { inComment = true; continue; }
        if (!KEYWORDS.has(keyword)) { offenders.push(`${path}: "${line.slice(0, 60)}"`); continue; }
        const why = malformed(keyword, rest.join(' '));
        if (why) offenders.push(`${path}: "${line.slice(0, 60)}" -- ${why}`);
      }
      if (inComment) offenders.push(`${path}: a comment is never closed inside {% liquid %}`);
    }
  }
  assert.deepEqual(offenders, [], `loose text inside {% liquid %}:\n${offenders.join('\n')}`);
});

test('every Liquid block tag in the theme is closed', () => {
  /*
   * The check above only looks inside {% liquid %}. Two siblings of the same
   * bug ship green without this one, and both blank or 500 the page just as
   * hard: deleting a standalone {%- endcomment -%} swallows the rest of the
   * file into a comment, and dropping an {%- endif -%} unbalances the section.
   * Raised by review on PR #192 and reproduced here before writing this.
   */
  const offenders = [];
  for (const path of liquidFiles) {
    const source = read(path);
    const stack = [];
    const tag = /\{%-?\s*(\w+)([\s\S]*?)-?%\}/g;
    let match;
    while ((match = tag.exec(source))) {
      const name = match[1];
      if (RAW_BODY.has(name)) {
        const close = new RegExp(`\\{%-?\\s*end${name}\\s*-?%\\}`, 'g');
        close.lastIndex = tag.lastIndex;
        const end = close.exec(source);
        if (!end) { offenders.push(`${path}: {% ${name} %} is never closed`); break; }
        tag.lastIndex = end.index + end[0].length;
      } else if (name === 'liquid') {
        /*
         * A {% liquid %} tag is one match to the regex above, so its inner
         * statements never reached the stack: dropping an `endif` from inside
         * one passed both tests while Shopify received unbalanced Liquid.
         * Codex, PR #193. Its body feeds the same stack now.
         */
        let inComment = false;
        for (const raw of match[2].split('\n')) {
          const line = raw.trim();
          if (!line || line.startsWith('#')) continue;
          const word = line.split(/[\s(]/)[0];
          if (inComment) {
            if (word === 'endcomment') inComment = false;
            continue;
          }
          if (word === 'comment') { inComment = true; continue; }
          if (BLOCK.has(word)) stack.push(word);
          else if (word.startsWith('end')) {
            const opened = stack.pop();
            if (!opened) offenders.push(`${path}: ${word} closes nothing`);
            else if (`end${opened}` !== word) offenders.push(`${path}: ${word} closes ${opened}`);
          }
        }
        if (inComment) offenders.push(`${path}: a comment inside {% liquid %} is never closed`);
      } else if (BLOCK.has(name)) {
        stack.push(name);
      } else if (name.startsWith('end')) {
        const opened = stack.pop();
        if (!opened) offenders.push(`${path}: {% ${name} %} closes nothing`);
        else if (`end${opened}` !== name) offenders.push(`${path}: {% ${name} %} closes {% ${opened} %}`);
      }
    }
    if (stack.length) offenders.push(`${path}: {% ${stack[stack.length - 1]} %} is never closed`);
  }
  assert.deepEqual(offenders, [], `unbalanced Liquid:\n${offenders.join('\n')}`);
});
