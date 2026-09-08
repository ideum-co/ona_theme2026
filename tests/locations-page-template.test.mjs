import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const themeRoot = resolve(import.meta.dirname, '..');
const read = (relativePath) => readFileSync(resolve(themeRoot, relativePath), 'utf8');
const readTemplate = (relativePath) => JSON.parse(read(relativePath).replace(/^\s*\/\*[\s\S]*?\*\//, ''));
const readSectionSchema = (relativePath) => {
  const source = read(relativePath);
  const schemaMatch = source.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);
  assert.ok(schemaMatch, `${relativePath} must expose a schema`);
  return JSON.parse(schemaMatch[1]);
};
const locationSectionTypes = [
  'locations-header',
  'locations-store-finder',
  'locations-flagships',
];

test('keeps locations in a dedicated alternate page template', () => {
  const templatePath = 'templates/page.locations.json';
  assert.ok(existsSync(resolve(themeRoot, templatePath)), `${templatePath} must exist`);

  const template = readTemplate(templatePath);
  assert.deepEqual(
    template.order,
    ['header', 'store_finder', 'flagships'],
    'locations sections must retain their migration order',
  );
  assert.deepEqual(
    template.order.map((id) => template.sections[id].type),
    locationSectionTypes,
    'locations template must reference exactly its three migrated section types',
  );

  const defaultPageTemplate = readTemplate('templates/page.json');
  assert.ok(
    Object.values(defaultPageTemplate.sections).every((section) => !locationSectionTypes.includes(section.type)),
    'the default page template must remain separate from locations',
  );
});

test('provides a valid schema for every locations template section', () => {
  for (const type of locationSectionTypes) {
    const sectionPath = `sections/${type}.liquid`;
    assert.ok(existsSync(resolve(themeRoot, sectionPath)), `${sectionPath} must exist`);

    const schema = readSectionSchema(sectionPath);
    assert.equal(typeof schema.name, 'string', `${sectionPath} schema must have a name`);
    assert.ok(schema.name.length > 0, `${sectionPath} schema name must not be empty`);
    assert.ok(Array.isArray(schema.settings), `${sectionPath} schema settings must be an array`);
  }
});

test('renders an editable locations heading with a safe page-title fallback', () => {
  const source = read('sections/locations-header.liquid');

  assert.match(
    source,
    /assign heading = section\.settings\.heading \| default: page\.title \| default: 'Locations'/,
    'a blank custom heading must fall back to the page title and then Locations',
  );
  assert.match(source, /<h1[^>]*>\s*{{-? heading \| escape -?}}\s*<\/h1>/, 'the resolved title must be the page h1');
  assert.match(
    source,
    /{%-? if section\.settings\.body != blank -?%}[\s\S]*?class="locations-header__body text-block {{ body_preset }}"[\s\S]*?{{-? section\.settings\.body -?}}[\s\S]*?{%-? endif -?%}/,
    'the optional rich text must render only when content exists',
  );
});

test('exposes locations header layout, typography, color, and spacing controls through scoped styles', () => {
  const sectionPath = 'sections/locations-header.liquid';
  const source = read(sectionPath);
  const schema = readSectionSchema(sectionPath);
  const settings = Object.fromEntries(schema.settings.map((setting) => [setting.id, setting]));

  assert.equal(settings.heading?.type, 'text', 'the custom heading must be editable');
  assert.equal(settings.body?.type, 'richtext', 'the introduction must support rich text');
  assert.equal(settings.heading_size?.type, 'range', 'the heading size must be editable');
  assert.equal(settings.type_preset?.type, 'select', 'the heading typography preset must be editable');
  assert.equal(settings.body_type_preset?.type, 'select', 'the body typography preset must be editable');
  assert.equal(settings.body_type_preset?.label, 't:settings.preset', 'the body preset must use an existing theme-editor label');
  assert.equal(settings.content_width?.type, 'select', 'the header content width must be configurable');
  assert.equal(settings.alignment?.type, 'text_alignment', 'the header alignment must be configurable');
  assert.equal(settings.background_color?.type, 'color', 'the header background color must be configurable');
  assert.equal(settings.text_color?.type, 'color', 'the header text color must be configurable');
  assert.equal(settings['padding-block-start']?.type, 'range', 'the header top spacing must be configurable');
  assert.equal(settings['padding-block-end']?.type, 'range', 'the header bottom spacing must be configurable');

  assert.match(source, /render 'contrast-override',[\s\S]*?text_color: section\.settings\.text_color/, 'custom colors must use the theme contrast helper');
  assert.match(source, /--locations-header-content-width:/, 'content width must be published as a section-scoped CSS variable');
  assert.match(source, /--locations-header-alignment:/, 'alignment must be published as a section-scoped CSS variable');
  assert.match(source, /assign heading_preset = section\.settings\.type_preset \| default: 'rte'/, 'the heading must resolve its preset');
  assert.match(source, /assign body_preset = section\.settings\.body_type_preset \| default: 'rte'/, 'the body must resolve its preset');
  assert.match(source, /--locations-header-heading-size: {{ section\.settings\.heading_size }}px;/, 'the heading size must be published as a scoped CSS variable');
  assert.match(
    source,
    /<h1 class="locations-header__heading {{ heading_preset }}" style="font-size: var\(--locations-header-heading-size\);">/,
    'the heading-size setting must be consumed inline so it overrides every h1–h6 preset selector',
  );
  assert.match(source, /class="locations-header__body text-block {{ body_preset }}/, 'the body must apply the selected preset class');
  assert.match(source, /render 'text-block-styles'/, 'body presets must use the theme text-block styles');
  assert.match(
    source,
    /--locations-header-text-color: {{ section\.settings\.text_color \| default: 'var\(--color-foreground\)' }};/,
    'a custom text color must work without requiring a custom background color',
  );
  assert.match(
    source,
    /\.locations-header\s*\{[\s\S]*?--color: var\(--locations-header-text-color\);[\s\S]*?color: var\(--locations-header-text-color\);/,
    'the text-block color token must inherit into paragraph and heading body presets',
  );
  assert.match(source, /render 'spacing-style', settings: section\.settings/, 'spacing controls must use the theme spacing helper');
});
