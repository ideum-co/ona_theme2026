import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const index = JSON.parse(read('templates/index.json').replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));
const carousel = read('sections/collection-carousel.liquid');

/*
 * Both home sections put a label under an image, and both had it hard left while the image above
 * it ran the full width of the column.
 */

test('the category carousel centres its labels', () => {
  /*
   * The live "Discover by category" is `collection_carousel_GRkRhJ`, NOT the `discover_by_category`
   * section -- that one is disabled, and editing it would have changed nothing on the page.
   */
  const disabled = index.sections.discover_by_category?.disabled;
  assert.equal(disabled, true, 'if discover_by_category is ever re-enabled the page has two of these');

  const settings = index.sections.collection_carousel_GRkRhJ.settings;
  assert.equal(settings.heading, 'Discover by <em>category</em>', 'this is the section being pinned');
  assert.equal(settings.text_alignment, 'center');

  /*
   * `center` is also the schema default, so this template was overriding it. Worth knowing if the
   * setting is ever cleared: it would land on center anyway.
   */
  const schema = JSON.parse(carousel.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/)[1]);
  const control = schema.settings.find((s) => s.id === 'text_alignment');
  assert.equal(control.default, 'center', 'the section default moved; re-check the override');

  // text-align only lands because the card is a grid, so the label stretches rather than shrinking.
  assert.match(carousel, /\.collection-carousel__item \{\s*display: grid;/, 'a shrink-to-fit label would ignore text-align');
  assert.match(carousel, /text-align: var\(--collection-carousel-text-align, center\)/);
});

test('Learn with ONA centres the label under each image', () => {
  const columns = index.sections.learn_with_ona.blocks.columns.blocks;
  const ids = Object.keys(columns);
  assert.deepEqual(ids, ['col1', 'col2', 'col3'], 'the columns changed; re-check the alignment');

  for (const id of ids) {
    const column = columns[id];
    const heading = column.blocks.heading;

    /*
     * Two settings, because one alone does not do it. The heading block is `width: fit-content`,
     * so inside a `content_direction: column` group the cross-axis alignment decides where that
     * shrink-wrapped box sits -- at `flex-start` it hugs the left edge and the block's own
     * `alignment: center` then centres text inside a box that is only as wide as the text.
     */
    assert.equal(column.settings.content_direction, 'column', `${id} is no longer a column`);
    assert.equal(heading.settings.width, 'fit-content', `${id}: if this became fill, the group alignment stops mattering`);
    assert.equal(column.settings.horizontal_alignment_flex_direction_column, 'center', `${id}: the box itself must be centred`);
    assert.equal(heading.settings.alignment, 'center', `${id}: and the text within it`);
  }
});
