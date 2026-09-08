import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const themeRoot = resolve(import.meta.dirname, '..');
const read = (relativePath) => readFileSync(resolve(themeRoot, relativePath), 'utf8');
const schema = JSON.parse(read('config/settings_schema.json'));
const settings = schema.flatMap((section) => section.settings ?? []);
const setting = (id) => settings.find((entry) => entry.id === id);

const themeSourceFiles = (relativeDirectory) => readdirSync(resolve(themeRoot, relativeDirectory), { withFileTypes: true })
  .flatMap((entry) => {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    return entry.isDirectory() ? themeSourceFiles(relativePath) : [relativePath];
  })
  .filter((relativePath) => /\.(liquid|js)$/.test(relativePath));

test('Dotdigital subscriber modal can be enabled globally', () => {
  assert.deepEqual(setting('dotdigital_subscriber_modal_enabled'), {
    type: 'checkbox',
    id: 'dotdigital_subscriber_modal_enabled',
    label: 'Enable Dotdigital subscriber modal',
    default: true,
  });
});

test('Dotdigital subscriber campaign path has the approved default', () => {
  assert.deepEqual(setting('dotdigital_subscriber_campaign'), {
    type: 'text',
    id: 'dotdigital_subscriber_campaign',
    label: 'Dotdigital campaign path',
    default: '7M6W-AH9/welcomenewsletter',
  });
});

test('Dotdigital subscriber modal delay is bounded in seconds', () => {
  assert.deepEqual(setting('dotdigital_subscriber_delay'), {
    type: 'range',
    id: 'dotdigital_subscriber_delay',
    label: 'Subscriber modal delay',
    min: 0,
    max: 60,
    step: 1,
    unit: 'sec',
    default: 2,
  });
});

test('Dotdigital subscriber modal cookie expiry is bounded in days', () => {
  assert.deepEqual(setting('dotdigital_subscriber_cookie_days'), {
    type: 'range',
    id: 'dotdigital_subscriber_cookie_days',
    label: 'Subscriber modal cookie expiry',
    min: 1,
    max: 365,
    step: 1,
    unit: 'days',
    default: 365,
  });
});

test('Dotdigital subscriber loader is guarded, URL-encodes configuration, and leaves subscriber handling to Dotdigital', () => {
  const snippetPath = 'snippets/dotdigital-subscriber-modal.liquid';
  assert.ok(existsSync(resolve(themeRoot, snippetPath)), `${snippetPath} must exist`);

  const snippet = read(snippetPath);
  assert.match(
    snippet,
    /assign dotdigital_campaign = settings\.dotdigital_subscriber_campaign \| strip/,
    'campaign values must be normalized before the blank guard',
  );
  assert.match(
    snippet,
    /if settings\.dotdigital_subscriber_modal_enabled and dotdigital_campaign != blank and request\.design_mode == false/,
    'the loader must not run when disabled, unconfigured, or in the theme editor',
  );
  assert.match(
    snippet,
    /assign dotdigital_campaign = dotdigital_campaign \| url_encode/,
    'the campaign path must be URL-encoded before it is placed in the external URL',
  );
  assert.match(
    snippet,
    /\/\/news\.onacoffee\.com\.au\/resources\/sharing\/popoverv3\.js\?sharing=lp-popover&domain=news\.onacoffee\.com\.au&id=\{\{ dotdigital_campaign \}\}&default-cookies-expiry-length-in-days=\{\{ settings\.dotdigital_subscriber_cookie_days \| url_encode \}\}&hide-after-submission=true&delay=\{\{ settings\.dotdigital_subscriber_delay \| url_encode \}\}/,
    'the sole loader URL must preserve the approved legacy endpoint and configurable timing values',
  );
  assert.doesNotMatch(
    snippet,
    /<(?:form|input)\b|\b(?:fetch|XMLHttpRequest|addEventListener)\b/i,
    'the theme must not reproduce the form or intercept subscriber data',
  );
});

test('Dotdigital subscriber loader is rendered once at the end of the body', () => {
  const layout = read('layout/theme.liquid');
  const renders = layout.match(/\{%-?\s*render\s+'dotdigital-subscriber-modal'\s*-?%\}/g) ?? [];

  assert.equal(renders.length, 1, 'theme.liquid must render the global loader exactly once');
  assert.ok(
    layout.indexOf(renders[0]) < layout.lastIndexOf('</body>'),
    'the global loader must be rendered before the closing body tag',
  );
});

test('theme-controlled source contains one Dotdigital popover loader reference', () => {
  const source = ['assets', 'blocks', 'layout', 'sections', 'snippets']
    .flatMap(themeSourceFiles)
    .map(read)
    .join('\n');

  assert.equal(
    (source.match(/popoverv3\.js/g) ?? []).length,
    1,
    'the theme must have one external Dotdigital popover loader',
  );
});
