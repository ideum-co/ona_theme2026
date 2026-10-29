import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/*
 * A schema label is either a `t:` key the admin resolves per locale, or a plain string the
 * merchant reads in English whatever language they work in. Both are legitimate -- the theme
 * uses a key wherever Horizon has one for that concept and a plain string for settings it
 * invented -- but a `t:` key that resolves to nothing is neither: the admin renders the raw
 * key, so the merchant sees `t:settings.media_position` in the sidebar.
 *
 * Nothing else in the suite reads the locale files, so a mistyped key shipped silently.
 */
const locale = (() => {
  const text = readFileSync(join(root, 'locales/en.default.schema.json'), 'utf8');
  /* The file opens with a generated banner and carries // comments -- it is JSONC. */
  return JSON.parse(text.slice(text.indexOf('\n{') + 1).replace(/^\s*\/\/.*$/gm, ''));
})();

const resolves = (key) => {
  let node = locale;
  for (const step of key.slice('t:'.length).split('.')) {
    if (node == null || typeof node !== 'object') return false;
    node = node[step];
  }
  return typeof node === 'string';
};

const references = (() => {
  const found = new Map();
  const note = (key, where) => {
    if (!found.has(key)) found.set(key, new Set());
    found.get(key).add(where);
  };

  /* The theme's own settings are a schema like any other, and the biggest single one -- every
     label a merchant meets under Theme settings. Scanning only the section directories left it
     able to ship a raw key (Codex, #303). It is plain JSON rather than a {% schema %} block,
     so it is read directly rather than matched out of Liquid. */
  const globals = 'config/settings_schema.json';
  for (const [, key] of readFileSync(join(root, globals), 'utf8').matchAll(/"(t:[A-Za-z0-9_.]+)"/g)) {
    note(key, globals);
  }

  for (const dir of ['sections', 'blocks', 'snippets']) {
    for (const file of readdirSync(join(root, dir))) {
      if (!file.endsWith('.liquid')) continue;
      const source = readFileSync(join(root, dir, file), 'utf8');
      const schema = source.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
      if (!schema) continue;
      for (const [, key] of schema[1].matchAll(/"(t:[A-Za-z0-9_.]+)"/g)) {
        note(key, `${dir}/${file}`);
      }
    }
  }
  return found;
})();

test('every translation key a schema references exists in the default locale', () => {
  assert.ok(references.size > 100, `only ${references.size} t: keys found -- the scan is broken`);

  const missing = [...references]
    .filter(([key]) => !resolves(key))
    .map(([key, files]) => `${key} (${[...files].sort().join(', ')})`);

  assert.deepEqual(
    missing,
    [],
    `these schema labels would render as the raw key in the theme editor:\n  ${missing.join('\n  ')}`
  );
});
