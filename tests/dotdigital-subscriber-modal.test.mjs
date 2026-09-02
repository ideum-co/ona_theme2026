import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schema = JSON.parse(readFileSync(new URL('../config/settings_schema.json', import.meta.url), 'utf8'));
const settings = schema.flatMap((section) => section.settings ?? []);
const setting = (id) => settings.find((entry) => entry.id === id);

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
