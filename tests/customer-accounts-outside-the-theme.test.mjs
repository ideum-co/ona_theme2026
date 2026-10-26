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
  // The legacy account layout is the other file someone reaches for, and it is just as inert.
  assert.ok(
    !existsSync(join(root, 'layout', 'customers.liquid')),
    `layout/customers.liquid does nothing under new customer accounts -- see ${DOC}`
  );
});

/*
 * The one thing in this repository that can break the account area. `<shopify-account>` is told
 * which menu to show by a theme setting, so blanking or dropping this key empties the header's
 * account dropdown of the Subscriptions item while the admin still reads as correct. The file is
 * shop-owned and editor-writable, and this repo has lost keys from it before, so the value is
 * pinned rather than merely present.
 */
test('the header still points the account dropdown at the customer account menu', () => {
  const raw = readFileSync(join(root, 'sections', 'header-group.json'), 'utf8');
  const group = JSON.parse(raw.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));

  const found = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    if (typeof node.customer_account_menu === 'string') found.push(node.customer_account_menu);
    Object.values(node).forEach(walk);
  };
  walk(group);

  assert.deepEqual(
    found,
    ['customer-account-main-menu'],
    `the header's shopify-account component reads this handle; emptying it hides the ` +
      `Subscriptions item from the account dropdown -- see ${DOC}`
  );

  assert.match(
    readFileSync(join(root, 'snippets', 'header-actions.liquid'), 'utf8'),
    /<shopify-account[\s\S]{0,120}menu="\{\{ customer_account_menu \}\}"/,
    'if the header stops passing the handle through, pinning the setting guards nothing'
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
