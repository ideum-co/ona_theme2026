import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const stripBanner = (text) => text.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');

const band = read('snippets/ona-band.liquid');
const legacyCss = read('assets/legacy-page-layout.css');
const template = JSON.parse(stripBanner(read('templates/page.wholesale.json')));

/* The hidden H1 is a bare <h1> with no surface of its own, so it is the one section on the
   page that cannot carry a band. Everything else on the page is expected to offer one. */
const UNBANDABLE = new Set(['ona-sr-heading']);
const live = template.order
  .map((key) => ({ key, type: template.sections[key].type, settings: template.sections[key].settings ?? {} }))
  .filter((section) => !UNBANDABLE.has(section.type));

const sectionSource = new Map(live.map(({ type }) => [type, read(`sections/${type}.liquid`)]));

const schemaOf = (source) => {
  const match = source.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  assert.ok(match, 'section has no schema block');
  return JSON.parse(match[1]);
};

test('every bandable section on the page both declares the setting and renders the snippet', () => {
  for (const { type } of live) {
    const source = sectionSource.get(type);
    const settings = schemaOf(source).settings ?? [];
    const declared = settings.filter((setting) => setting.id === 'band_background');

    assert.equal(declared.length, 1, `${type}: band_background declared ${declared.length} times`);
    assert.equal(declared[0].type, 'color', `${type}: band_background must be a color setting`);
    assert.ok(
      !('default' in declared[0]),
      `${type}: band_background carries a default -- an unset band has to fall through to the page background`
    );
    assert.match(
      source,
      /\{%-?\s*render\s+'ona-band',\s*section:\s*section\s*-?%\}/,
      `${type}: declares band_background but never renders 'ona-band', so the setting does nothing`
    );
  }
});

/*
 * The setting lives in the section schema but the paint happens in the snippet, so a section
 * can render the snippet while the schema insertion landed in a block's settings array instead
 * of the schema's own -- ona-exclusive-access declares "blocks" before "settings", and the
 * first match in that file belongs to a block. Reading the parsed schema's top-level settings
 * is what distinguishes the two; a text search for the id cannot.
 */
test('the setting sits in the schema itself, never in a block', () => {
  for (const { type } of live) {
    const schema = schemaOf(sectionSource.get(type));
    for (const block of schema.blocks ?? []) {
      const stray = (block.settings ?? []).filter((setting) => setting.id === 'band_background');
      assert.equal(stray.length, 0, `${type}: band_background landed on block "${block.type}"`);
    }
  }
});

/*
 * .more-btn and .wholesale-roaster-form-btn resolve --color-primary-button-background, which is
 * the page foreground (#470a12). On the maroon bands that is maroon on maroon -- an invisible
 * CTA on the two sections whose whole job is the call to action. The snippet has to re-point the
 * button pair against the band, so this asserts the tokens are emitted inside the same rule that
 * sets the background, and that they are not simply the page's own values restated.
 */
test('a band re-points the primary button against itself', () => {
  const rule = band.match(/#shopify-section-\{\{\s*section\.id\s*\}\}\s*\{([\s\S]*?)\n\s*\}/);
  assert.ok(rule, 'the snippet emits no rule scoped to the section wrapper');
  const body = rule[1];

  for (const token of [
    '--color-background',
    '--color-foreground',
    '--color-primary-button-background',
    '--color-primary-button-text',
  ]) {
    assert.ok(body.includes(`${token}:`), `the band rule never sets ${token}`);
  }

  const valueOf = (token) => body.match(new RegExp(`${token}:\\s*([^;]+);`))[1].trim();
  assert.equal(
    valueOf('--color-primary-button-background'),
    valueOf('--color-foreground'),
    'the button background must be the band text colour, or it disappears into a dark band'
  );
  assert.equal(
    valueOf('--color-primary-button-text'),
    valueOf('--color-background'),
    'the button label must be the band colour, or it disappears into the button'
  );
});

test('the band picks its text colour by contrast rather than assuming a light background', () => {
  assert.match(band, /color_brightness/, 'the snippet never measures the band brightness');
  assert.match(band, /color_contrast/, 'the snippet never checks the page text colour against the band');
  assert.match(band, /--palette-lightest/, 'the snippet has no light text to fall back to on a dark band');
  assert.match(band, /--palette-darkest/, 'the snippet has no dark text to fall back to on a light band');
});

/*
 * A band is only as tall as the section's own padding: with no padding the colour hugs the text
 * and the page reads as mis-struck rather than banded. .col-4-icons and .add-faqs-section were
 * both missing from the page-gap list, which was invisible while the page was one flat colour.
 * This measures the root class of each banded section off the section file, so a band added to
 * a section with no vertical padding fails here rather than on the live page.
 */
test('every banded section has vertical padding to fill', () => {
  const padded = [...legacyCss.matchAll(/#MainContent\s*:is\(([^)]*)\)\s*\{[^}]*padding-block\s*:/g)]
    .flatMap((match) => match[1].split(','))
    .map((selector) => selector.trim().replace(/^\./, ''));
  const paddedSingly = [...legacyCss.matchAll(/#MainContent\s+\.([\w-]+)\s*\{[^}]*padding-block\s*:/g)].map(
    (match) => match[1]
  );
  const hasPadding = new Set([...padded, ...paddedSingly]);

  for (const { key, type, settings } of live) {
    if (!settings.band_background) continue;
    const rootClasses = sectionSource
      .get(type)
      .match(/<(?:section|div)\b[^>]*class="([^"]+)"/)[1]
      .split(/\s+/)
      .filter(Boolean);
    assert.ok(
      rootClasses.some((className) => hasPadding.has(className)),
      `${key} (${type}) is banded but none of its root classes [${rootClasses.join(', ')}] get padding-block`
    );
  }
});

/*
 * The rhythm is the design: three tones, with the repeated sourcing strips carrying the mid
 * tone and the maroon reserved for the two CTA moments. Two neighbouring sections painted the
 * same colour merge into one band twice the height, which is the failure the rhythm exists to
 * avoid -- and it is invisible in a diff, because each section reads fine on its own.
 */
test('no two neighbouring sections share a band colour', () => {
  const sequence = template.order.map((key) => template.sections[key].settings?.band_background ?? 'page');
  for (let i = 1; i < sequence.length; i += 1) {
    if (sequence[i] === 'page') continue;
    assert.notEqual(
      sequence[i],
      sequence[i - 1],
      `${template.order[i - 1]} and ${template.order[i]} are both ${sequence[i]}`
    );
  }
});

test('the bands use the three agreed tones and no others', () => {
  const PALETTE = new Set(['#ebe4d4', '#470a12']);
  const used = new Set(
    template.order.map((key) => template.sections[key].settings?.band_background).filter(Boolean)
  );
  for (const colour of used) {
    assert.ok(PALETTE.has(colour), `${colour} is not one of the agreed band tones`);
  }
  assert.equal(used.size, 2, 'the page should carry exactly the sand and maroon bands');
});
