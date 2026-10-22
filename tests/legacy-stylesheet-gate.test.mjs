import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const stripBanner = (s) => s.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');

/*
 * layout/theme.liquid loads assets/legacy-page-layout.css for a hand-written
 * list of page suffixes. That list is the whole protection, and a list only
 * protects what someone remembered to put on it: `faq` and `faq-subscriptions`
 * render ona-page-title, whose markup is `<div class="container">`, and the
 * only rule for `.container` in the theme lives in that stylesheet. So the FAQ
 * pages' <h1> was laid out with no rule at all -- measured on the live theme at
 * left=0, width=1396 on a 1405px viewport, while the Horizon section directly
 * beneath it sat at left=40, width=1316.
 *
 * This derives the list that is actually required and compares it to the one in
 * the layout, so the next template that needs the sheet fails here instead of
 * shipping 40px out of alignment.
 */

const CONTAINER_MARKUP = /class="(?:[^"]*\s)?(?:container|medium-container)(?:\s[^"]*)?"/;

const gateList = () => {
  const layout = read('layout/theme.liquid');
  const m = layout.match(/assign legacy_page_suffixes = '([^']*)'/);
  assert.ok(m, 'layout/theme.liquid must still declare legacy_page_suffixes');
  return m[1].split(',').map((s) => s.trim()).filter(Boolean);
};

// Which sections depend on the shared sheet for their page-width wrapper?
const dependsOnSheet = (type) => {
  const file = `sections/${type}.liquid`;
  if (!existsSync(resolve(root, file))) return false;
  const src = read(file);
  if (!CONTAINER_MARKUP.test(src)) return false;
  // ...unless the section carries the rule in its own style block.
  const own = src.match(/\{%-?\s*style(?:sheet)?\s*-?%\}([\s\S]*?)\{%-?\s*endstyle(?:sheet)?\s*-?%\}/g) ?? [];
  return !own.some((b) => /\.(?:medium-)?container\b/.test(b));
};

const sectionTypesOf = (templateFile) => {
  const template = JSON.parse(stripBanner(read(`templates/${templateFile}`)));
  return Object.values(template.sections ?? {}).map((s) => s.type);
};

test('the shared legacy stylesheet reaches every page template that needs it', () => {
  const gate = gateList();
  const required = new Map();

  for (const file of readdirSync(resolve(root, 'templates')).sort()) {
    if (!/^page\..+\.json$/.test(file)) continue;
    const suffix = file.slice('page.'.length, -'.json'.length);
    const needy = sectionTypesOf(file).filter(dependsOnSheet);
    if (needy.length) required.set(suffix, [...new Set(needy)].sort());
  }

  const missing = [...required.keys()].filter((s) => !gate.includes(s)).sort();
  assert.deepEqual(
    missing,
    [],
    `these page suffixes render legacy sections that only assets/legacy-page-layout.css styles, ` +
      `but layout/theme.liquid does not load it for them: ` +
      missing.map((s) => `${s} (${required.get(s).join(', ')})`).join('; '),
  );
});

test('the gate carries no suffix that no longer needs the stylesheet', () => {
  /*
   * The other direction: a suffix left on the list after its template was
   * rebuilt Horizon-native ships 20KB of dead CSS and, worse, makes the list
   * look maintained when it is not.
   */
  const gate = gateList();
  const stale = gate.filter((suffix) => {
    const file = `page.${suffix}.json`;
    if (!existsSync(resolve(root, `templates/${file}`))) return true;
    return !sectionTypesOf(file).some(dependsOnSheet);
  });
  assert.deepEqual(stale, [], `on the gate but no longer needing the sheet: ${stale.join(', ')}`);
});
