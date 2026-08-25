import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../sections/product-intro.liquid', import.meta.url), 'utf8');
const schemaMatch = source.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);
assert.ok(schemaMatch, 'Product introduction schema must exist');

const schema = JSON.parse(schemaMatch[1]);
const setting = (id) => schema.settings.find((item) => item.id === id);

test('exposes Product introduction layout controls', () => {
  assert.deepEqual(setting('media_width').options.map(({ value }) => value), ['narrow', 'medium', 'wide']);
  assert.equal(setting('media_width').default, 'medium');

  assert.deepEqual(
    setting('media_height').options.map(({ value }) => value),
    ['auto', 'small', 'medium', 'large', 'full-screen'],
  );
  assert.equal(setting('media_height').default, 'medium');

  assert.deepEqual(setting('section_width').options.map(({ value }) => value), ['page-width', 'full-width']);
  assert.equal(setting('section_width').default, 'page-width');

  assert.equal(setting('limit_content_width').default, true);
  assert.deepEqual(
    {
      min: setting('max_width').min,
      max: setting('max_width').max,
      step: setting('max_width').step,
      default: setting('max_width').default,
    },
    { min: 800, max: 1800, step: 20, default: 1280 },
  );
  assert.equal(setting('max_width').visible_if, '{{ section.settings.limit_content_width }}');
});

test('keeps the full-width background outside the constrained inner grid', () => {
  assert.match(source, /class="product-intro spacing-style"[\s\S]*?<div\s+class="product-intro__inner/);
  assert.match(source, /--product-intro-max-width: {{ settings\.max_width \| default: 1280 }}px/);
  assert.match(source, /--product-intro-media-height:/);
  assert.match(source, /\.product-intro__inner\s*\{/);
  assert.match(source, /\.product-intro__inner--limited\s*\{/);
  assert.match(source, /\.product-intro__inner--page-width\s*\{/);
});

test('does not add a misleading screen-edge media control to the centered layout', () => {
  assert.equal(setting('extend_media'), undefined);
});

test('keeps fixed-size 3D models inside the selected media height', () => {
  assert.match(source, /\.product-intro__model\s*\{[^}]*max-block-size: 100%;/);
});
