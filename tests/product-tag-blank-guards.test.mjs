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

test('no indexed metafield list is tested for bare truthiness', () => {
  // In Liquid only nil and false are falsy -- an empty string is truthy. The tag
  // metafields in snippets/ona-product-tags.liquid are parallel lists, so a badge
  // with a name but no icon leaves custom_tag_icon[i] as "". The guard
  //   {% if custom_tag_icon[i] %}<img src="{{ custom_tag_icon[i] }}" ...>{% endif %}
  // therefore passed and emitted <img src="">, which browsers resolve against the
  // document URL: on 2026-10-19 the preview home page issued 7 extra full-page
  // requests for itself. The live theme emitted none, so this was ours.
  // The same file already writes `custom_tag_name[i] != blank`; these now match.
  const bareTruthy = /\{%-?\s*if\s+[a-z_][a-z0-9_]*\[[a-z0-9_]+\]\s*-?%\}/g;
  const offenders = liquidFiles.flatMap((path) => {
    const hits = read(path).match(bareTruthy) ?? [];
    return hits.map((hit) => `${path}: ${hit}`);
  });
  assert.deepEqual(offenders, [], `use "!= blank" instead:\n${offenders.join('\n')}`);
});

test('every tag icon and colour is interpolated only behind a blank check', () => {
  const source = read('snippets/ona-product-tags.liquid');
  for (const field of ['custom_tag_icon', 'custom_tag_color']) {
    const guards = source.match(new RegExp(`\\{%\\s*if ${field}\\[i\\][^%]*%\\}`, 'g')) ?? [];
    assert.ok(guards.length > 0, `${field} is no longer guarded at all`);
    for (const guard of guards) {
      assert.match(guard, /!=\s*blank/, `${field} guard is not a blank check: ${guard}`);
    }
  }
});
