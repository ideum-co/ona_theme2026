import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const template = (p) => JSON.parse(read(p).replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));

/*
 * Blog template suffixes the shop actually uses, read off the live store on
 * 2026-10-20. Same trap as the page templates in #210: a suffix with no
 * template falls back to `templates/blog.json` silently.
 *
 *   brewguides  suffix "brewguides"  747 articles
 *   news        suffix "news"         43 articles
 *
 * Both were falling back, which is why the brew guides rendered with the
 * journal's hero-and-mosaic layout.
 */
const SUFFIXES_IN_USE = ['brewguides', 'news'];

test('every blog template suffix the shop uses has a template', () => {
  const missing = SUFFIXES_IN_USE.filter(
    (s) => !existsSync(resolve(root, `templates/blog.${s}.json`)),
  );
  assert.deepEqual(missing, [], `these blogs fall back to the generic template: ${missing.join(', ')}`);
});

test('the brew guides render as a catalogue and the journal does not', () => {
  assert.equal(
    template('templates/blog.brewguides.json').sections.main.settings.card_layout,
    'uniform',
    '747 brew guides in a hero-and-mosaic layout is a journal device on a catalogue',
  );
  assert.equal(
    template('templates/blog.news.json').sections.main.settings.card_layout,
    'featured',
    'the Journal keeps the layout it already had',
  );
});

test('the brew guides turn on the uncropped image fit, and the journal does not', () => {
  /*
   * The cropping fix itself is Victor's, in blocks/_blog-post-image.liquid
   * (#214): an `image_fit` setting whose `contain` option stops a portrait
   * bag being decapitated by `object-fit: cover` in a fixed-height frame.
   *
   * It ships defaulting to `fill`, so merging it changed nothing on the live
   * page -- measured after his merge, the brew guide images were still
   * `object-fit: cover`, a 1578x2577 bag cropped into 983x400. A setting
   * nobody turns on is not a fix, so the template turns it on.
   */
  const block = (file) =>
    template(file).sections.main.blocks['static-blog-post-card'].blocks.image.settings;

  assert.equal(block('templates/blog.brewguides.json').image_fit, 'contain',
    'the bags must not be cropped');
  assert.equal(block('templates/blog.news.json').image_fit, 'fill',
    'the Journal keeps the editorial crop it already had');

  // The value has to be one the block actually declares.
  const schema = JSON.parse(
    read('blocks/_blog-post-image.liquid').match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/)[1],
  );
  const options = schema.settings.find((s) => s.id === 'image_fit').options.map((o) => o.value);
  assert.ok(options.includes('contain'), 'the block must still offer this option');
});

test('the uniform layout makes every card the same size', () => {
  /*
   * 747 brew guides in the journal's hero-and-mosaic sizing produced cards of
   * 1440x400, 702x468 and 456x388 in the same list. A catalogue is a grid.
   */
  const section = read('sections/main-blog.liquid');
  assert.match(section, /assign uniform = true/, 'uniform must bypass the featured sizing');
  assert.match(
    section,
    /\.blog-posts-container--uniform \.blog-post-item--horizontal\s*\{[^}]*display:\s*block/,
    'the hero row is a journal device and must not appear in a catalogue',
  );
});
