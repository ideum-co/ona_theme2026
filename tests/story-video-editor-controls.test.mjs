import assert from 'node:assert/strict';
import fs from 'node:fs';

const section = fs.readFileSync('sections/story-video.liquid', 'utf8');
const helperPath = 'snippets/story-video-typography-style.liquid';
const helper = fs.readFileSync(helperPath, 'utf8');

const schema = JSON.parse(section.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/)[1]);
const headingSizeSetting = schema.settings.find((setting) => setting.id === 'heading_size');
const schemaSource = section.match(/\{% schema %\}\s*([\s\S]*?)\s*\{% endschema %\}/)?.[1];
assert.ok(schemaSource, 'missing section schema');
const schemaSettings = new Map(JSON.parse(schemaSource).settings.map((setting) => [setting.id, setting]));

assert.deepEqual(schemaSettings.get('content_gap'), {
  type: 'range',
  id: 'content_gap',
  label: 't:settings.content_gap',
  min: 0,
  max: 100,
  step: 1,
  unit: 'px',
  default: 16,
}, 'content_gap must expose the current large gap as its default');
assert.match(section, /--story-video-content-gap:\s*\{\{ settings\.content_gap \}\}px;/);
assert.match(section, /\.story-video__intro\s*\{[\s\S]*?gap:\s*var\(--story-video-content-gap, var\(--gap-lg\)\);/);

for (const suffix of ['type_preset', 'font', 'font_size', 'line_height', 'letter_spacing', 'case', 'wrap']) {
  assert.match(section, new RegExp(`"id"\\s*:\\s*"body_${suffix}"`), `body missing ${suffix}`);
}

for (const suffix of ['type_preset', 'font', 'font_size', 'line_height', 'letter_spacing', 'case', 'wrap']) {
  assert.match(section, new RegExp(`"id"\\s*:\\s*"button_${suffix}"`), `button missing ${suffix}`);
}

assert.match(section, /class="story-video__body text-block rte \{\{ body_preset \}\}/);
assert.match(section, /class="story-video__heading\s+\{\{ heading_preset \}\}(?!\s+\{\{ heading_preset \}\})/);
assert.match(section, /class="button story-video__button\s+\{\{ button_preset \}\}(?!\s+\{\{ button_preset \}\})/);
assert.match(section, /render 'story-video-typography-style'[\s\S]*?prefix: 'body'/);
assert.match(section, /render 'story-video-typography-style'[\s\S]*?prefix: 'button'/);
assert.match(section, /\.story-video__button\.button[\s\S]*?color:\s*var\(--story-video-button-color\)/);
assert.match(
  section,
  /\.story-video__button\.button\.paragraph\s*\{[\s\S]*?font-family:\s*var\(--font-paragraph--family\)[\s\S]*?font-style:\s*var\(--font-paragraph--style\)[\s\S]*?font-weight:\s*var\(--font-paragraph--weight\)[\s\S]*?font-size:\s*var\(--font-paragraph--size\)[\s\S]*?line-height:\s*var\(--font-paragraph--line-height\)[\s\S]*?letter-spacing:\s*var\(--font-paragraph--letter-spacing\)[\s\S]*?text-transform:\s*var\(--font-paragraph--case\)/,
  'paragraph preset needs native typography on button',
);
assert.match(section, /\.story-video__button\.button[\s\S]*?--button-background-color/);
assert.match(section, /\.story-video__button\.button[\s\S]*?--button-color/);
assert.match(section, /--color:\s*\{\{ settings\.text_color \}\}/);
assert.equal(headingSizeSetting.visible_if, '{{ false }}', 'heading_size must stay hidden as a saved fallback');
assert.match(helper, /if preset == 'custom'/);
assert.match(helper, /--font-family:\s*\{\{ font \}\}/);
assert.match(helper, /--font-size:/);
assert.match(helper, /--line-height:/);
assert.match(helper, /--letter-spacing:/);
assert.match(helper, /--text-transform:/);
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
  assert.ok(schemaSettings.has(id), `missing ${id}`);
}

for (const container of ['intro', 'media']) {
  const modeId = `${container}_individual_side_padding`;
  const legacyId = `${container}_padding_inline`;
  const startId = `${container}_padding_inline_start`;
  const endId = `${container}_padding_inline_end`;

  assert.deepEqual(
    schemaSettings.get(modeId),
    {
      type: 'checkbox',
      id: modeId,
      label: 't:settings.individual_side_padding',
      default: false,
    },
    `${modeId} must default to legacy horizontal padding`,
  );
  assert.equal(
    schemaSettings.get(legacyId)?.visible_if,
    `{{ section.settings.${modeId} == false }}`,
    `${legacyId} must be visible while individual sides are off`,
  );
  for (const id of [startId, endId]) {
    assert.equal(
      schemaSettings.get(id)?.visible_if,
      `{{ section.settings.${modeId} }}`,
      `${id} must be visible while individual sides are on`,
    );
    assert.equal(schemaSettings.get(id)?.default, 0, `${id} must permit an intentional zero`);
  }

  const conditionalBindings = new RegExp(
    `\\{% if settings\\.${modeId} %\\}([\\s\\S]*?)\\{% else %\\}([\\s\\S]*?)\\{% endif %\\}`,
  ).exec(section);
  assert.ok(conditionalBindings, `missing ${container} padding mode binding`);

  const [individualBindings, legacyBindings] = conditionalBindings.slice(1);
  for (const [side, id] of [
    ['start', startId],
    ['end', endId],
  ]) {
    assert.match(
      individualBindings,
      new RegExp(`--story-video-${container}-padding-inline-${side}:\\s*\\{\\{ settings\\.${id} \\}\\}px;`),
      `${container} individual ${side} binding is missing`,
    );
    assert.match(
      legacyBindings,
      new RegExp(`--story-video-${container}-padding-inline-${side}:\\s*\\{\\{ settings\\.${legacyId} \\}\\}px;`),
      `${container} legacy ${side} binding is missing`,
    );
  }

  const renderBindings = (bindings, values) =>
    Object.fromEntries(
      [...bindings.matchAll(/(--story-video-[\w-]+):\s*\{\{ settings\.([\w_]+) \}\}px;/g)].map(([, variable, setting]) => [
        variable,
        values[setting],
      ]),
    );
  assert.deepEqual(
    renderBindings(legacyBindings, {
      [legacyId]: 48,
      [startId]: 12,
      [endId]: 36,
    }),
    {
      [`--story-video-${container}-padding-inline-start`]: 48,
      [`--story-video-${container}-padding-inline-end`]: 48,
    },
    `${container} legacy mode must use nonzero horizontal padding for both inline sides`,
  );
  assert.deepEqual(
    renderBindings(individualBindings, {
      [legacyId]: 48,
      [startId]: 0,
      [endId]: 64,
    }),
    {
      [`--story-video-${container}-padding-inline-start`]: 0,
      [`--story-video-${container}-padding-inline-end`]: 64,
    },
    `${container} individual mode must preserve intentional zero and independent side values`,
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

for (const file of fs.readdirSync('locales').filter((name) => name.endsWith('.schema.json'))) {
  const localeSchema = fs.readFileSync(`locales/${file}`, 'utf8');
  assert.match(localeSchema, /"content_gap"\s*:/, `${file} missing the content-gap translation`);
  assert.match(
    localeSchema,
    /"individual_side_padding"\s*:/,
    `${file} missing the individual-side padding translation`,
  );
}
