import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const block = read('blocks/_blog-post-featured-image.liquid');
const template = JSON.parse(read('templates/article.json').replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));

const featuredImage = () => {
  let found = null;
  const walk = (node) => {
    for (const b of Object.values(node.blocks ?? {})) {
      if (b.type === '_blog-post-featured-image') found = b;
      walk(b);
    }
  };
  for (const s of Object.values(template.sections)) walk(s);
  return found;
};

test('the article hero uses the image\'s own shape', () => {
  /*
   * article.json asked for `landscape`, which is 16/9. Every brew guide's
   * artwork is a portrait bag -- they run ~612x1000 across the blog -- so each
   * one was cropped: 503x823 rendered 1316x740 on
   * /blogs/brewguides/bruma-colombia-washed, slicing the top and bottom off.
   *
   * `adapt` resolves --ratio to {{ image.aspect_ratio }}, so each article keeps
   * its own proportions. The Journal's images are landscape (1.25 to 1.78, two
   * of them exactly 16/9), so they are unaffected.
   */
  const image = featuredImage();
  assert.ok(image, 'the article template must still have a featured image block');
  assert.equal(image.settings.image_ratio, 'adapt', 'a fixed ratio crops whichever orientation it is not');
  assert.match(block, /\{% when 'adapt' %\}\{\{ image\.aspect_ratio \| default: 1 \}\}/, 'adapt must mean the image\'s own ratio');
});

test('a portrait hero is capped so it cannot become a tower', () => {
  /*
   * `adapt` alone stops the crop but lets a 0.61 portrait fill the content
   * width: 1316x2153, taking that page from 1,049px to 2,461px. The old theme
   * shows the bag small instead -- 265x433, whole page 1,171px.
   */
  assert.match(
    block,
    /image\.aspect_ratio and image\.aspect_ratio < 1/,
    'the portrait case has to be detected from the image itself',
  );
  const rule = block.match(/\.blog-post-featured-image--portrait\s*\{([^}]*)\}/);
  assert.ok(rule, 'a portrait hero needs a width cap');
  assert.match(rule[1], /inline-size:\s*min\(100%,\s*\d+px\)/, 'cap it, but never wider than the column');

  // The cap must not apply to landscape heroes, or the Journal shrinks too.
  assert.doesNotMatch(
    block,
    /\.blog-post-featured-image\s*\{[^}]*inline-size:\s*min\(100%,\s*\d+px\)/,
    'only the portrait variant is capped',
  );
});
