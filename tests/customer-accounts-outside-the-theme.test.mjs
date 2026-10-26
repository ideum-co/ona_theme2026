import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

/*
 * The store runs new customer accounts, which ignore `templates/customers/*` outright. So a
 * customer-account template added here would read as a fix -- the file is in the theme, the
 * merge goes green, the live site is unchanged -- and the real configuration, which lives in
 * the checkout profile in the Shopify admin, would stay broken while someone believed it was
 * handled. Neither the live theme nor the one before it ever had such a template; this keeps
 * it that way, and points whoever tripped the guard at the document that says where to go.
 */

const DOC = join('docs', 'customer-accounts-and-subscriptions.md');

test('the theme ships no customer-account templates, which new customer accounts ignore', () => {
  const templates = join(root, 'templates');
  const stray = readdirSync(templates).filter((name) => name.startsWith('customers'));
  assert.deepEqual(
    stray,
    [],
    `templates/customers* does nothing under new customer accounts -- see ${DOC}`
  );
  assert.ok(
    !existsSync(join(templates, 'customers')),
    `templates/customers/ does nothing under new customer accounts -- see ${DOC}`
  );
});

test('the document names the three things needed to find the real configuration', () => {
  assert.ok(existsSync(join(root, DOC)), `${DOC} is the only pointer to configuration this repo cannot hold`);
  const doc = readFileSync(join(root, DOC), 'utf8');

  // The admin path, the menu that makes the area reachable, and the app handle that an
  // admin URL guessed from the name "appstle" gets wrong.
  for (const landmark of [
    'Settings → Checkout → Configurations',
    'customer-account-main-menu',
    'subscription-by-rhem',
  ]) {
    assert.ok(doc.includes(landmark), `${DOC} should still name ${landmark}`);
  }
});
