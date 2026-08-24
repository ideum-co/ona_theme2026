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
assert.match(section, /class="button story-video__button[^\"]*\{\{ button_preset \}\}/);
assert.match(section, /render 'story-video-typography-style'[\s\S]*?prefix: 'button'/);
assert.match(section, /\.story-video__button\.button[\s\S]*?--button-background-color/);
assert.match(section, /\.story-video__button\.button[\s\S]*?--button-color/);
assert.match(section, /--color:\s*\{\{ settings\.text_color \}\}/);
assert.ok(fs.existsSync(helperPath), 'missing Story video typography helper');
