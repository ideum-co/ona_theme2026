import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const readJson = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8').replace(/^\/\*[\s\S]*?\*\/\s*/, ''));

/*
 * Every Brew Guides article actually linked to a live product carries
 * template_suffix "article" (confirmed live via the Admin API templateSuffix
 * field), which Shopify resolves to templates/article.article.json -- not the
 * default templates/article.json. Both files exist and must stay in lockstep:
 * a change to one that isn't mirrored in the other silently un-fixes whichever
 * file didn't get the edit, exactly how PR #282's article-page fix shipped
 * correctly to templates/article.json but never reached a single real Brew
 * Guides article (all of them resolve the suffixed file instead). See
 * templates/article.article.json's own doc comment for the full story.
 */
test('templates/article.json and templates/article.article.json stay byte-for-byte identical in content', () => {
  const base = readJson('templates/article.json');
  const suffixed = readJson('templates/article.article.json');
  assert.deepEqual(
    suffixed,
    base,
    'templates/article.article.json (served to every Brew Guides article with template_suffix "article") must mirror templates/article.json exactly -- otherwise the two entry points into main-blog-post drift and the fix only reaches whichever one was actually edited'
  );
});
