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
