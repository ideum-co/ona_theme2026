import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hero = readFileSync(new URL('../sections/hero.liquid', import.meta.url), 'utf8');
const buttonBlock = readFileSync(new URL('../blocks/button.liquid', import.meta.url), 'utf8');
const buttonSnippet = readFileSync(new URL('../snippets/button.liquid', import.meta.url), 'utf8');
const homepage = JSON.parse(readFileSync(new URL('../templates/index.json', import.meta.url), 'utf8').replace(/^\/\*[\s\S]*?\*\/\s*/, ''));
const schemaSource = hero.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/)?.[1];
assert.ok(schemaSource, 'Hero must contain a schema');
const schema = JSON.parse(schemaSource);
const setting = (id) => schema.settings.find((entry) => entry.id === id);

assert.equal(setting('pin_button_group_to_bottom')?.type, 'checkbox');
assert.equal(setting('pin_button_group_to_bottom')?.default, false);
assert.equal(setting('pin_button_group_to_bottom')?.visible_if, "{{ section.settings.section_height != 'auto' }}");
assert.deepEqual(
  Object.fromEntries(['min', 'max', 'step', 'default'].map((key) => [key, setting('button_group_bottom_spacing')?.[key]])),
  { min: 0, max: 200, step: 4, default: 60 },
);
assert.equal(
  setting('button_group_bottom_spacing')?.visible_if,
  "{{ section.settings.pin_button_group_to_bottom and section.settings.section_height != 'auto' }}",
);
assert.match(
  hero,
  /\{% if section\.settings\.pin_button_group_to_bottom and section\.settings\.section_height != 'auto' %\} hero--bottom-actions\{% endif %\}/,
  'auto-height Heroes must not activate bottom pinning',
);
assert.match(
  hero,
  /\{% if section\.settings\.pin_button_group_to_bottom and section\.settings\.section_height != 'auto' %\}[\s\S]*?--hero-bottom-actions-offset:\s*\{\{ section\.settings\.button_group_bottom_spacing \| default: 60 \}\}px;[\s\S]*?\{% endif %\}/,
  'auto-height Heroes must not publish the pinning offset',
);
assert.match(hero, /\.hero--bottom-actions \.hero__content-wrapper\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;/);
assert.match(
  hero,
  /\.hero--bottom-actions \.hero__content-wrapper > \.group-block:has\(> \.group-block-content \.button-block\)/,
  'bottom actions must qualify the Button block marker',
);
assert.doesNotMatch(hero, /\.hero--bottom-actions[\s\S]*?:is\(\.button,\s*\.button-secondary,\s*\.button-unstyled,\s*\.button-custom\)/);
assert.match(buttonBlock, /\{% render 'button', link: block\.settings\.link, class: 'button-block' %\}/);
assert.match(buttonSnippet, /@param \{string\} \[class\]/);
assert.match(buttonSnippet, /class="[\s\S]*?\{\{ class \}\}/);
assert.match(hero, /inset-inline-start:\s*50%;[\s\S]*?inset-block-end:\s*var\(--hero-bottom-actions-offset[\s\S]*?transform:\s*translateX\(-50%\);/);

const homepageHero = homepage.sections.hero_ona;
assert.equal(homepageHero.settings.pin_button_group_to_bottom, true);
assert.equal(homepageHero.settings.button_group_bottom_spacing, 60);
assert.equal(homepageHero.blocks.group_L3tYP4.settings['padding-block-start'], 0);

console.log('hero centered content and bottom actions regression harness: PASS');
