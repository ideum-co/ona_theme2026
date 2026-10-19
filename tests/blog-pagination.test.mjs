import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const section = read('sections/main-blog.liquid');

/*
 * Liquid hands back only the first 50 articles from an unpaginated
 * `blog.articles`, and ignores ?page= completely. Measured on the deployed
 * theme on 2026-10-20: /blogs/brewguides holds 747 articles, served 50, and
 * page=2, 5, 15 and 16 each returned the identical 50 -- overlap 50, nothing
 * new. 697 brew guides were reachable only by direct URL or the sitemap, with
 * no way to browse to them. /blogs/news sat under the cap at 43 and would have
 * broken silently at its 51st article.
 *
 * main-blog is the only listing section Horizon shipped without pagination.
 * main-collection, search-results, product-list and featured-blog-posts all
 * have it, and this follows main-collection's pattern.
 */
test('the blog list is paginated', () => {
  assert.match(
    section,
    /\{%\s*paginate blog\.articles by section\.settings\.articles_per_page\s*%\}/,
    'the article loop must be wrapped in {% paginate %}',
  );
  assert.match(section, /\{%\s*endpaginate\s*%\}/, '{% paginate %} must be closed');

  // The loop has to be INSIDE the paginate block, or it still reads all 50.
  const open = section.search(/\{%\s*paginate blog\.articles/);
  const loop = section.search(/\{%\s*for article in blog\.articles\s*%\}/);
  const close = section.search(/\{%\s*endpaginate\s*%\}/);
  assert.ok(open !== -1 && loop !== -1 && close !== -1, 'paginate, loop and endpaginate must all be present');
  assert.ok(open < loop && loop < close, 'the article loop must sit inside the paginate block');

  assert.match(
    section,
    /\{%\s*render 'pagination-controls', paginate: paginate\s*%\}/,
    "the theme's own pagination-controls must render, or there are no links to page 2",
  );
  const controls = section.search(/render 'pagination-controls'/);
  assert.ok(controls > loop && controls < close, 'the controls must render inside the paginate block, after the loop');
});

test('articles per page is a setting with a usable default', () => {
  const schema = JSON.parse(section.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/)[1]);
  const setting = schema.settings.find((entry) => entry.id === 'articles_per_page');
  assert.ok(setting, 'articles_per_page must be exposed to the editor');
  assert.equal(setting.type, 'range');
  assert.ok(setting.default >= 6, 'the default must render a usable page');
  assert.ok(
    setting.max <= 50,
    'above 50 Liquid truncates regardless, so the control must not offer a value that silently loses articles',
  );
});
