import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const section = readFileSync(new URL('../sections/product-highlight.liquid', import.meta.url), 'utf8');
const schema = JSON.parse(section.match(/\{% schema %\}\s*([\s\S]*?)\s*\{% endschema %\}/)[1]);
const settings = new Map(schema.settings.map((setting) => [setting.id, setting]));

const mediaWidth = settings.get('media_width');
assert.ok(mediaWidth, 'Media width must be configurable');
assert.equal(mediaWidth.type, 'range', 'Media width must use a bounded range control');
assert.equal(mediaWidth.label, 'Media width', 'Media width must have a clear merchant-facing label');
assert.deepEqual(
  { min: mediaWidth.min, max: mediaWidth.max, step: mediaWidth.step, default: mediaWidth.default, unit: mediaWidth.unit },
  { min: 40, max: 70, step: 5, default: 50, unit: '%' },
  'Media width must preserve the approved 40–70% range and 50% default',
);

const imageFit = settings.get('image_fit');
assert.ok(imageFit, 'Image fit must be configurable');
assert.equal(imageFit.type, 'select', 'Image fit must use a select control');
assert.equal(imageFit.label, 'Image fit', 'Image fit must have a clear merchant-facing label');
assert.deepEqual(
  imageFit.options.map((option) => option.value),
  ['cover', 'contain', 'fill'],
  'Image fit must offer only valid object-fit values',
);
assert.equal(imageFit.default, 'cover', 'Image fit must keep the current cover behavior by default');

assert.match(
  section,
  /--product-highlight-media-width: \{\{ settings\.media_width \| default: 50 \}\}%;\s*--product-highlight-content-width: calc\(100% - var\(--product-highlight-media-width\)\);\s*--product-highlight-image-fit: \{\{ settings\.image_fit \| default: 'cover' \}\};/,
  'section settings must publish valid width and image-fit variables',
);

assert.match(
  section,
  /@media screen and \(min-width: 750px\) \{\s*grid-template-columns: minmax\(0, var\(--product-highlight-content-width\)\) minmax\(0, var\(--product-highlight-media-width\)\);/,
  'right-positioned media must use the selected desktop width and content remainder',
);
assert.match(
  section,
  /\.product-highlight--media-left \{\s*@media screen and \(min-width: 750px\) \{\s*grid-template-columns: minmax\(0, var\(--product-highlight-media-width\)\) minmax\(0, var\(--product-highlight-content-width\)\);/,
  'left-positioned media must reverse the selected desktop proportions',
);
const productHighlightRule = section.match(/\.product-highlight \{([\s\S]*?)\n  \}\n\n  \.product-highlight--media-left/)[1];
const desktopGridStart = productHighlightRule.indexOf('@media screen and (min-width: 750px)');
assert.ok(desktopGridStart > 0, 'desktop grid behavior must begin at the mobile breakpoint');
assert.doesNotMatch(
  productHighlightRule.slice(0, desktopGridStart),
  /grid-template-columns:/,
  'mobile product highlights must remain a single, full-width column',
);

assert.match(
  section,
  /\.product-highlight__image \{[\s\S]*?object-fit: var\(--product-highlight-image-fit, cover\);/,
  'the image must consume the selected fit through its scoped CSS variable',
);
assert.match(
  section,
  /assign media_width = settings\.media_width \| default: 50\s*assign image_sizes = '\(min-width: 750px\) ' \| append: media_width \| append: 'vw, 100vw'/,
  'responsive image sizes must be assembled by Liquid rather than emitted as literal interpolation text',
);
assert.match(
  section,
  /sizes: image_sizes/,
  'responsive images must use the selected desktop media width and remain full-width on mobile',
);

const protectedJsonChanges = execFileSync(
  'git',
  ['diff', '--name-only', 'HEAD', '--', 'templates', 'config/settings_data.json'],
  { cwd: new URL('..', import.meta.url), encoding: 'utf8' },
).trim();
assert.equal(
  protectedJsonChanges,
  '',
  `Product highlight media controls must not change template JSON or settings data (diffed against HEAD):\n${protectedJsonChanges}`,
);

console.log('product-highlight media controls: PASS');
