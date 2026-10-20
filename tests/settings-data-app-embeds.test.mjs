import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const settings = JSON.parse(read('config/settings_data.json').replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));

/*
 * config/settings_data.json is shop-owned (docs/branching-and-release.md §5) and this repository's
 * copy had drifted all the way to empty: no `blocks` key at all, while the live theme carried
 * fourteen app embeds and the favicon. `main` is wired to the published theme, so merging any
 * change to this file would have turned off Judge.me, dotdigital, ProMap, Shopify Forms, Microsoft
 * Clarity and Powerful Form Builder in one go, and dropped the favicon, with no error anywhere.
 *
 * These guards are deliberately about SHAPE, not a list of embeds. An enumerated allow-list only
 * protects what whoever wrote it happened to remember, and would have to be edited every time an
 * app is added -- the same edit that would be skipped. What cannot be allowed to happen silently
 * is the key going missing, which is exactly what did happen.
 */

test('the repository copy still carries the app embeds', () => {
  const blocks = settings.current?.blocks;
  assert.ok(blocks && typeof blocks === 'object', 'current.blocks is missing — the embeds would be wiped on merge');
  assert.ok(Object.keys(blocks).length > 0, 'current.blocks is empty — same outcome');

  for (const [id, block] of Object.entries(blocks)) {
    assert.match(block.type ?? '', /^shopify:\/\/apps\//, `block ${id} is not an app embed`);
    assert.ok('settings' in block, `block ${id} has no settings object`);
  }
});

test('a disabled embed says so explicitly rather than being deleted', () => {
  /*
   * Turning an embed off is `"disabled": true`, not removing the block. A removed block is
   * indistinguishable from a drift wipe, both here and in the theme editor, so the record of the
   * decision is lost. Appstle's subscription helper is the one currently off.
   */
  const off = Object.values(settings.current.blocks).filter((b) => b.disabled === true);
  for (const block of off) {
    assert.equal(typeof block.type, 'string', 'a disabled embed keeps its type');
  }
  assert.ok(
    Object.values(settings.current.blocks).some((b) => b.disabled === false),
    'at least one embed must be live, or this file is not reconciled',
  );
});

test('the favicon survives', () => {
  // Also absent from the repository copy, and also dropped by any merge of it.
  assert.match(settings.current?.favicon ?? '', /^shopify:\/\//, 'current.favicon must point at a shop image');
});
