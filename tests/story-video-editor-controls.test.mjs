import assert from 'node:assert/strict';
import fs from 'node:fs';

const section = fs.readFileSync('sections/story-video.liquid', 'utf8');
const helperPath = 'snippets/story-video-typography-style.liquid';

for (const suffix of ['type_preset', 'font', 'font_size', 'line_height', 'letter_spacing', 'case', 'wrap']) {
  assert.match(section, new RegExp(`"id"\\s*:\\s*"body_${suffix}"`), `body missing ${suffix}`);
}

for (const suffix of ['type_preset', 'font', 'font_size', 'line_height', 'letter_spacing', 'case', 'wrap']) {
  assert.match(section, new RegExp(`"id"\\s*:\\s*"button_${suffix}"`), `button missing ${suffix}`);
}

assert.match(section, /class="story-video__body text-block/);
assert.match(
  section,
  /class="story-video__heading\s+\{\{ heading_preset \}\}\s+\{\{ heading_preset \}\}/,
  'heading preset needs doubled class specificity',
);
assert.match(section, /render 'story-video-typography-style'[\s\S]*?prefix: 'body'/);
assert.match(
  section,
  /class="button story-video__button\s+\{\{ button_preset \}\}\s+\{\{ button_preset \}\}/,
  'button preset needs doubled class specificity',
);
assert.match(section, /render 'story-video-typography-style'[\s\S]*?prefix: 'button'/);
assert.match(
  section,
  /\.story-video__button\.button\.paragraph\s*\{[\s\S]*?font-family:\s*var\(--font-paragraph--family\)[\s\S]*?font-style:\s*var\(--font-paragraph--style\)[\s\S]*?font-weight:\s*var\(--font-paragraph--weight\)[\s\S]*?font-size:\s*var\(--font-paragraph--size\)[\s\S]*?line-height:\s*var\(--font-paragraph--line-height\)[\s\S]*?letter-spacing:\s*var\(--font-paragraph--letter-spacing\)[\s\S]*?text-transform:\s*var\(--font-paragraph--case\)/,
  'paragraph preset needs native typography on button',
);
assert.match(section, /\.story-video__button\.button[\s\S]*?--button-background-color/);
assert.match(section, /\.story-video__button\.button[\s\S]*?--button-color/);
assert.match(section, /--color:\s*\{\{ settings\.text_color \}\}/);
assert.ok(fs.existsSync(helperPath), 'missing Story video typography helper');

for (const id of [
  'intro_padding_block_start',
  'intro_padding_block_end',
  'intro_padding_inline_start',
  'intro_padding_inline_end',
  'media_padding_block_start',
  'media_padding_block_end',
  'media_padding_inline_start',
  'media_padding_inline_end',
]) {
  assert.match(section, new RegExp(`"id"\\s*:\\s*"${id}"`), `missing ${id}`);
}

for (const [variable, setting, fallback] of [
  ['--story-video-intro-padding-block-start', 'intro_padding_block_start', '0'],
  ['--story-video-intro-padding-block-end', 'intro_padding_block_end', '0'],
  ['--story-video-intro-padding-inline-start', 'intro_padding_inline_start', 'settings.intro_padding_inline | default: 0'],
  ['--story-video-intro-padding-inline-end', 'intro_padding_inline_end', 'settings.intro_padding_inline | default: 0'],
  ['--story-video-media-padding-block-start', 'media_padding_block_start', '0'],
  ['--story-video-media-padding-block-end', 'media_padding_block_end', '0'],
  ['--story-video-media-padding-inline-start', 'media_padding_inline_start', 'settings.media_padding_inline | default: 0'],
  ['--story-video-media-padding-inline-end', 'media_padding_inline_end', 'settings.media_padding_inline | default: 0'],
]) {
  const escapedVariable = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedFallback = fallback.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(
    section,
    new RegExp(`${escapedVariable}:\\s*\\{\\{ settings\\.${setting} \\| default: ${escapedFallback} \\}\\}px;`),
    `missing ${variable} binding`,
  );
}

for (const [selector, property, variable] of [
  ['story-video__intro', 'padding-block-start', '--story-video-intro-padding-block-start'],
  ['story-video__intro', 'padding-block-end', '--story-video-intro-padding-block-end'],
  ['story-video__intro', 'padding-inline-start', '--story-video-intro-padding-inline-start'],
  ['story-video__intro', 'padding-inline-end', '--story-video-intro-padding-inline-end'],
  ['story-video__media', 'padding-block-start', '--story-video-media-padding-block-start'],
  ['story-video__media', 'padding-block-end', '--story-video-media-padding-block-end'],
  ['story-video__media', 'padding-inline-start', '--story-video-media-padding-inline-start'],
  ['story-video__media', 'padding-inline-end', '--story-video-media-padding-inline-end'],
]) {
  assert.match(
    section,
    new RegExp(`\\.${selector}\\s*\\{[\\s\\S]*?${property}:\\s*var\\(${variable}, 0\\)`),
    `${selector} missing ${property}`,
  );
}

for (const id of ['intro_padding_inline', 'media_padding_inline']) {
  assert.match(
    section,
    new RegExp(`"id"\\s*:\\s*"${id}"[\\s\\S]*?"visible_if"\\s*:\\s*"\\{\\{ false \\}\\}"`),
    `${id} must remain a hidden legacy fallback`,
  );
}
