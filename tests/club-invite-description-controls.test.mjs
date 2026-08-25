import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const section = readFileSync(new URL('../sections/club-invite.liquid', import.meta.url), 'utf8');
const schemaSource = section.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/)?.[1];
assert.ok(schemaSource, 'Club invite must contain a schema');

const schema = JSON.parse(schemaSource);
const setting = (id) => schema.settings.find((entry) => entry.id === id);

for (const id of [
  'body_width',
  'body_max_width',
  'body_alignment',
  'body_type_preset',
  'body_font',
  'body_font_size',
  'body_line_height',
  'body_letter_spacing',
  'body_case',
  'body_wrap',
  'body_text_color',
]) {
  assert.ok(setting(id), `Club invite description must expose ${id}`);
}

assert.deepEqual(setting('body_width').options.map(({ value }) => value), ['fit-content', '100%']);
assert.equal(setting('body_width').default, '100%');
assert.deepEqual(setting('body_max_width').options.map(({ value }) => value), ['narrow', 'normal', 'none']);
assert.equal(setting('body_max_width').default, 'normal');
assert.equal(setting('body_alignment').type, 'text_alignment');
assert.equal(setting('body_alignment').default, 'center');
assert.equal(setting('body_type_preset').default, 'custom');
assert.equal(setting('body_font').default, 'var(--font-body--family)');
assert.equal(setting('body_font_size').default, '1.125rem');
assert.equal(setting('body_text_color').type, 'color');

assert.match(section, /assign body_preset = settings\.body_type_preset \| default: 'custom'/);
assert.match(section, /class="club-invite__body text-block rte \{\{ body_preset \}\}/);
assert.match(section, /render 'club-invite-typography-style', settings: settings, prefix: 'body', type: 'body'/);
assert.match(section, /--club-invite-body-width:\s*\{\{ settings\.body_width \| default: '100%' \}\}/);
assert.match(section, /--club-invite-body-max-width:[\s\S]*?--max-width--body-/);
assert.match(section, /--club-invite-body-color:\s*\{\{ settings\.body_text_color \| default: settings\.text_color \}\}/);
assert.match(section, /--club-invite-body-alignment:\s*\{\{ settings\.body_alignment \| default: 'center' \}\}/);
assert.match(section, /\.club-invite__body\s*\{[\s\S]*?inline-size:\s*var\(--club-invite-body-width[\s\S]*?max-inline-size:\s*min\(100%, var\(--club-invite-body-max-width[\s\S]*?color:\s*var\(--club-invite-body-color[\s\S]*?text-align:\s*var\(--club-invite-body-alignment/);
assert.match(section, /\.club-invite__body :is\(p, ul, ol\)\s*\{[\s\S]*?color:\s*inherit;[\s\S]*?text-align:\s*inherit;/);

console.log('club-invite description controls regression harness: PASS');
