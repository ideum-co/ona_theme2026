import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const layout = read('assets/legacy-page-layout.css');
const script = read('assets/ona-faqs.js');

/*
 * The ported sections render an `.add-faqs` list whose accordion script never
 * came across, so every answer rendered open. Measured on /pages/wholesale:
 * 788px of open copy in ona-training alone -- almost the whole difference
 * between its 1,349px and the old theme's 517px -- plus 323px in expressions
 * and 242px in supported.
 *
 * Confirmed on the real pre-Horizon theme (147508887743): every `.faqs-text`
 * is `display: none` on load, clicking the title adds `is-active` and opens
 * it, clicking again closes it.
 */
const SECTIONS = [
  'ona-training',
  'ona-traning-supported',
  'ona-supported',
  'ona-expressions',
  'ona-faq-lists',
];

test('answers start closed and open on is-active, in every section that has them', () => {
  /*
   * The rules live in each section's own {% stylesheet %}, not in
   * legacy-page-layout.css: that sheet is loaded only for a fixed list of page
   * suffixes in layout/theme.liquid, while these sections carry presets and
   * can be placed on any template. Where the sheet is absent the script would
   * toggle classes while nothing hid or revealed the answer. Codex, #218.
   */
  for (const name of SECTIONS) {
    const source = read(`sections/${name}.liquid`);
    const styles = source.match(/\{%\s*stylesheet\s*%\}([\s\S]*?)\{%\s*endstylesheet\s*%\}/);
    assert.ok(styles, `${name}: the collapse must travel with the section`);
    assert.match(styles[1], /\.faqs-text\s*\{[^}]*display:\s*none/, `${name}: all answers open is the bug`);
    assert.match(styles[1], /\.faqs-text\.is-active\s*\{[^}]*display:\s*block/, `${name}: and is-active opens one`);
  }

  // And it must NOT be left behind in the page-scoped sheet, or the two drift.
  assert.doesNotMatch(
    layout,
    /\.add-faqs \.faqs-text\s*\{[^}]*display:\s*none/,
    'the page-scoped copy should be gone now the sections carry it',
  );
});

test('a FAQ that renders open says so', () => {
  /*
   * ona-faq-lists opens its first answer, marking the title and panel
   * `is-active`. The button must report `aria-expanded="true"` to match, or
   * assistive technology calls it closed and the first click computes "open"
   * and leaves it open. Codex, #218.
   */
  const source = read('sections/ona-faq-lists.liquid');
  assert.match(
    source,
    /aria-expanded="\{%\s*if forloop\.index == 1\s*%\}true\{%\s*else\s*%\}false\{%\s*endif\s*%\}"/,
    'the open answer must report itself open',
  );
  // The three states have to agree, so the condition must be the same one.
  for (const what of ['faqs-title', 'faqs-text']) {
    assert.match(source, new RegExp(`class="${what} \\{%\\s*if forloop\\.index == 1\\s*%\\}is-active`), `${what} uses the same condition`);
  }
});

test('every FAQ title is a real button that says whether it is open', () => {
  for (const name of SECTIONS) {
    const section = read(`sections/${name}.liquid`);
    assert.match(
      section,
      /<button type="button" class="faqs-toggle" aria-expanded="/,
      `${name}: a <div> title cannot be focused or pressed`,
    );
    // Literal or Liquid-conditional, but it must resolve to one of the two.
    const expanded = section.match(/aria-expanded="([^"]*)"/)[1];
    assert.ok(
      /^(true|false)$/.test(expanded) || (expanded.includes('true') && expanded.includes('false')),
      `${name}: aria-expanded must resolve to true or false, got ${expanded}`,
    );
    assert.match(
      section,
      /ona-faqs\.js['"]?\s*\|\s*asset_url/,
      `${name}: the toggle script must be requested`,
    );
  }
});

test('the toggle keeps the button, the title and the panel in step', () => {
  assert.match(script, /aria-expanded/, 'the button must report its state');
  assert.match(script, /\.faqs-title'\)\?\.classList\.toggle\('is-active'/, 'the title carries is-active, as it did on the old theme');
  assert.match(script, /panelFor\(toggle\)\?\.classList\.toggle\('is-active'/, 'and the panel opens with it');

  /*
   * One delegated listener, not one per section: the same module is imported
   * by five sections and a module with the same URL is evaluated once, so a
   * per-element listener would still be fine -- but document-level delegation
   * also survives sections re-rendered by the theme editor.
   */
  assert.match(script, /document\.addEventListener\('click'/, 'delegate, so editor re-renders keep working');
});

test('the coffee tabs are left alone', () => {
  /*
   * ona-unique-coffees uses the same `.add-faqs` markup but as TABS, not an
   * accordion -- its titles switch the image group (#216). Converting it here
   * would have broken that.
   */
  const section = read('sections/ona-unique-coffees.liquid');
  assert.doesNotMatch(section, /faqs-toggle/, 'that section is a tablist, not an accordion');
  assert.match(section, /class="slider-handle/, 'and its handles stay slider handles');
});
