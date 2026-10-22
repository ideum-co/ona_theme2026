import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const schemaOf = (file) =>
  JSON.parse(read(file).match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/)[1]);

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
