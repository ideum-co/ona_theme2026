import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

/*
 * Two head-level sheets are inlined rather than linked. They are ~1.5 KB each,
 * so as separate <link>s their cost is the blocking round-trip, not the bytes:
 * Lighthouse on mobile attributed ~480 ms to each.
 *
 * The exception matters as much as the rule. `overflow-list.css` stays a
 * stylesheet_tag because it is emitted inside each
 * <template shadowrootmode="open"> in snippets/overflow-list.liquid -- the
 * sheet has to live in the shadow root to style it, and that snippet renders
 * once per overflow list (variant swatches, filters, header menu). Inlining it
 * would duplicate the CSS per instance rather than fetching it once, so this
 * test pins it as linked on purpose.
 */
const INLINED = ['app-stacking.css', 'home-mobile-overflow.css'];

test('small head-level stylesheets are inlined, not separate blocking requests', () => {
  const layout = read('layout/theme.liquid');

  for (const file of INLINED) {
    assert.match(
      layout,
      new RegExp(`<style>\\{\\{ '${file.replace('.', '\\.')}' \\| inline_asset_content \\}\\}</style>`),
      `${file} must be inlined via inline_asset_content`
    );
    assert.doesNotMatch(
      layout,
      new RegExp(`'${file.replace('.', '\\.')}'\\s*\\|\\s*asset_url\\s*\\|\\s*stylesheet_tag`),
      `${file} must no longer be a blocking <link>`
    );
    // inline_asset_content reads from assets/ at render time -- a rename would
    // silently emit nothing rather than erroring.
    const path = resolve(root, 'assets', file);
    assert.ok(existsSync(path), `assets/${file} must exist for inline_asset_content to find it`);
    assert.ok(statSync(path).size < 8 * 1024, `assets/${file} grew past the size that makes inlining sensible`);
  }
});

test('overflow-list.css stays linked because it lives in a shadow root', () => {
  const snippet = read('snippets/overflow-list.liquid');
  assert.match(snippet, /<template shadowrootmode="open">/, 'the shadow-root template is the reason for the exception');
  assert.match(
    snippet,
    /\{\{ 'overflow-list\.css' \| asset_url \| stylesheet_tag \}\}/,
    'overflow-list.css must remain a stylesheet_tag -- inlining would repeat it per instance'
  );
  assert.doesNotMatch(
    read('layout/theme.liquid'),
    /'overflow-list\.css' \| inline_asset_content/,
    'do not inline overflow-list.css'
  );
});
