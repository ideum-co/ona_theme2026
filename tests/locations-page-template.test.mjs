import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const themeRoot = resolve(import.meta.dirname, '..');
const read = (relativePath) => readFileSync(resolve(themeRoot, relativePath), 'utf8');
const readTemplate = (relativePath) => JSON.parse(read(relativePath).replace(/^\s*\/\*[\s\S]*?\*\//, ''));
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
    Object.values(template.sections).map((section) => section.type),
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

    const source = read(sectionPath);
    const schemaMatch = source.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);
    assert.ok(schemaMatch, `${sectionPath} must expose a schema`);

    const schema = JSON.parse(schemaMatch[1]);
    assert.equal(typeof schema.name, 'string', `${sectionPath} schema must have a name`);
    assert.ok(schema.name.length > 0, `${sectionPath} schema name must not be empty`);
    assert.ok(Array.isArray(schema.settings), `${sectionPath} schema settings must be an array`);
  }
});
