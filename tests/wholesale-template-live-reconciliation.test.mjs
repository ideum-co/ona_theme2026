import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const raw = readFileSync(resolve(root, 'templates/page.wholesale.json'), 'utf8');
const template = JSON.parse(raw.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));

/*
 * templates/page.wholesale.json is editor-owned: the merchant changes it in the Shopify theme
 * editor, and the GitHub integration pushes this file's WHOLE contents over the top of whatever
 * the editor last wrote. So anything the merchant set here that the repository does not also
 * carry is not merely out of sync -- it is deleted on the next merge that touches this file.
 *
 * On 2026-10-26 the live theme (154676789439) and this file disagreed. Reconciling them was
 * verified end-to-end rather than by reading: the staging theme (161282195647) carries this
 * repository's copy, so rendering /pages/wholesale from both themes and diffing the text showed
 * exactly what a push would change -- nothing removed, and one section added back. These two
 * guards hold the two differences that a diff of this file cannot make obvious on its own.
 */

test('the one-month wholesale trial stays parked, because the offer no longer runs', () => {
  const trial = template.sections.wholesale_sourcing_v6;
  assert.ok(trial, 'the trial section must still exist so the merchant can switch it back on');
  assert.equal(
    trial.disabled,
    true,
    'ONA no longer offers the one-month trial and switched this section off in the editor. ' +
      'The repository copy is pushed over the live file wholesale, so dropping this flag ' +
      'silently re-advertises an offer that is not available.',
  );
  assert.ok(
    template.order.includes('wholesale_sourcing_v6'),
    'parked, not deleted -- removing it from order would discard the copy with it',
  );
});

test("the icon row keeps the merchant's gap below its title", () => {
  /*
   * `title_gap` is Victor's setting (sections/ona-icon-and-content.liquid), schema default 0.
   * The merchant set 36 in the editor. A template without the key renders the default, so
   * losing it closes a 36px gap under "You get more than just great coffee..." -- a change
   * nothing in a JSON diff announces, because the line simply would not be there.
   */
  assert.equal(template.sections.icon_and_content.settings.title_gap, 36);
});

test('the file keeps the banner that marks it editor-owned', () => {
  assert.match(
    raw,
    /^\s*\/\*[\s\S]*auto-generated[\s\S]*theme editor[\s\S]*\*\//,
    'every other template in this theme carries Shopify\'s generated-file banner; this one did ' +
      'not, which is part of why it drifted unnoticed',
  );
});
