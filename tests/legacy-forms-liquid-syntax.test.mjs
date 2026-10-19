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
  const KEYWORDS = new Set([
    'assign', 'break', 'capture', 'endcapture', 'case', 'when', 'endcase', 'comment', 'endcomment',
    'content_for', 'continue', 'cycle', 'decrement', 'echo', 'else', 'elsif', 'endfor', 'endform',
    'endif', 'endpaginate', 'endraw', 'endtablerow', 'endunless', 'for', 'form', 'if', 'include',
    'increment', 'layout', 'liquid', 'paginate', 'raw', 'render', 'section', 'sections', 'style',
    'tablerow', 'unless',
  ]);

  const offenders = [];
  for (const path of liquidFiles) {
    const source = read(path);
    for (const block of source.matchAll(/\{%-?\s*liquid\b([\s\S]*?)-?%\}/g)) {
      let inComment = false;
      block[1].split('\n').forEach((raw, index) => {
        const line = raw.trim();
        if (!line) return;
        // `# ...` is Liquid's inline comment inside a {% liquid %} block.
        if (line.startsWith('#')) return;
        const keyword = line.split(/[\s(]/)[0];
        if (inComment) {
          if (keyword === 'endcomment') inComment = false;
          return;
        }
        if (keyword === 'comment') {
          inComment = true;
          return;
        }
        if (!KEYWORDS.has(keyword)) {
          offenders.push(`${path}: "${line.slice(0, 60)}"`);
        }
      });
      if (inComment) offenders.push(`${path}: a comment is never closed inside {% liquid %}`);
    }
  }
  assert.deepEqual(offenders, [], `loose text inside {% liquid %}:\n${offenders.join('\n')}`);
});
