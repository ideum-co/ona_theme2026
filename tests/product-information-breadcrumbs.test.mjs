import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const themeRoot = resolve(import.meta.dirname, '..');
const sectionSource = readFileSync(resolve(themeRoot, 'sections/product-information.liquid'), 'utf8');
const contentSource = readFileSync(resolve(themeRoot, 'snippets/product-information-content.liquid'), 'utf8');
const gallerySource = readFileSync(resolve(themeRoot, 'blocks/_product-media-gallery.liquid'), 'utf8');

const parseSchema = (source, label) => {
  const match = source.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);
  assert.ok(match, `${label} schema must exist`);
  return JSON.parse(match[1]);
};

test('retains the native left-thumbnail option in the PDP media gallery', () => {
  const schema = parseSchema(gallerySource, 'Product media gallery');
  const setting = (id) => schema.settings.find((item) => item.id === id);

  assert.ok(setting('slideshow_controls_style')?.options.some(({ value }) => value === 'thumbnails'));
  assert.deepEqual(
    setting('thumbnail_position')?.options.map(({ value }) => value),
    ['left', 'bottom', 'right'],
  );
});

test('renders a configurable breadcrumb above the entire PDP information grid', () => {
  const schema = parseSchema(sectionSource, 'Product information');
  const setting = (id) => schema.settings.find((item) => item.id === id);

  assert.equal(setting('show_breadcrumbs')?.type, 'checkbox');
  assert.equal(setting('show_breadcrumbs')?.default, true);

  for (const id of [
    'breadcrumb_root_label',
    'breadcrumb_separator',
    'breadcrumb_text_color',
    'breadcrumb_link_color',
    'breadcrumb_font_size',
    'breadcrumb_font_size_mobile',
    'breadcrumb_padding_top',
    'breadcrumb_padding_bottom',
    'breadcrumb_gap',
  ]) {
    assert.ok(setting(id), `missing breadcrumb setting: ${id}`);
  }

  assert.match(contentSource, /<nav[\s\S]*?class="product-information__breadcrumbs"/);
  assert.match(contentSource, /routes\.all_products_collection_url/);
  assert.match(contentSource, /breadcrumb_collection/);
  assert.match(contentSource, /aria-current="page"/);
  assert.match(
    contentSource,
    /if show_breadcrumbs == nil[\s\S]*?assign show_breadcrumbs = true/,
    'existing PDP section instances must show breadcrumbs until the new setting is explicitly disabled',
  );
  assert.match(contentSource, /{% if show_breadcrumbs %}/);

  const breadcrumbIndex = contentSource.indexOf('class="product-information__breadcrumb-row');
  const productComponentIndex = contentSource.indexOf('<product-component');
  assert.ok(breadcrumbIndex > -1 && breadcrumbIndex < productComponentIndex, 'breadcrumb must precede the product grid');
  assert.match(contentSource, /product-information__breadcrumb-row section section--/);
  assert.match(contentSource, /product-information section[\s\S]*?disable-section-top-offset/);
  assert.match(
    contentSource,
    /\.product-information__breadcrumbs\s*\{[\s\S]*?position: relative;[\s\S]*?z-index:/,
    'breadcrumb must remain above the PDP background and transparent-header overlap',
  );
});

test('fits the complete PDP information layout within the desktop viewport', () => {
  const schema = parseSchema(sectionSource, 'Product information');
  const setting = (id) => schema.settings.find((item) => item.id === id);

  assert.equal(setting('layout_max_width')?.default, 1360);
  assert.equal(setting('media_column_width')?.default, 60);
  assert.match(contentSource, /class="product-information__viewport"/);
  assert.match(
    contentSource,
    /\.product-information__viewport\s*\{[\s\S]*?height: 100svh;[\s\S]*?overflow: hidden;/,
  );
  assert.match(contentSource, /--product-information-max-width:[\s\S]*?settings\.layout_max_width/);
  assert.match(contentSource, /--product-information-media-width:[\s\S]*?settings\.media_column_width/);
  assert.match(contentSource, /minmax\(0, var\(--product-information-media-width\)\)/);
  assert.match(
    contentSource,
    /\.product-information__media \.product-media-container:not\(\.dialog-zoomed-gallery \*\)[\s\S]*?height: 100%;[\s\S]*?aspect-ratio: auto;/,
  );
  assert.match(contentSource, /\.deferred-media__poster-image\)[\s\S]*?object-fit: contain;/);
  assert.match(
    contentSource,
    /\.product-information__grid:not\(\.product-information--media-none\) > \.product-details[\s\S]*?overflow-y: auto;[\s\S]*?scrollbar-gutter: stable;/,
  );
});
