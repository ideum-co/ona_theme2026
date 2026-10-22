import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

test('app embeds cannot out-stack the header', () => {
  /*
   * The Globo form app wraps its fields in `.panels { position: relative;
   * z-index: 100 }`. Horizon's header and mega menu sit at
   * `--layer-menu-drawer`, which resolves to 18, and nothing between them
   * creates a stacking context -- so both land in the root one and 100 wins.
   *
   * Measured on the live /pages/contact with the menu open: 18 of 324 sample
   * points inside the panel hit Globo inputs instead of the menu. 0 of 324
   * with `isolation: isolate` on the app's own wrapper.
   */
  const css = read('assets/app-stacking.css');
  const rule = css.match(/\.globo-form-app\s*\{([^}]*)\}/);
  assert.ok(rule, 'the Globo app wrapper must be constrained');
  assert.match(rule[1], /isolation:\s*isolate/, 'isolation is what scopes its z-index');

  /*
   * Raising the header instead would be the wrong fix: the app is free to
   * pick any number, so this has to contain the app rather than outbid it.
   *
   * Comments are stripped first -- the explanation above quotes the app's own
   * `z-index: 100`, and a first version of this assertion matched its own
   * documentation and failed.
   */
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(declarations, /z-index:\s*\d{3,}/, 'do not try to outbid the app, contain it');
});

test('the stacking fix is loaded on every page, not just one template', () => {
  /*
   * The Globo embed ships in the markup of every page of the store, so a
   * template-gated stylesheet would leave most pages broken. This asserts the
   * tag is not inside either of the conditional blocks around it.
   */
  const layout = read('layout/theme.liquid');
  const tag = layout.indexOf("'app-stacking.css'");
  assert.ok(tag > -1, 'theme.liquid must load app-stacking.css');

  const indexGate = layout.indexOf("{% if request.page_type == 'index' %}");
  const pageGate = layout.indexOf("{% if template.name == 'page' %}");
  assert.ok(indexGate === -1 || tag < indexGate, 'it must not sit inside the index-only block');
  assert.ok(pageGate === -1 || tag < pageGate, 'it must not sit inside the page-template block');
});
