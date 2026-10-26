import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const css = readFileSync(resolve(root, 'assets/legacy-page-layout.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/*
 * Measured on live at 1373x752 before this rule: the page header ran y=139-412, spending 96px
 * of padding above and 96px below one 60px line of type, and the partnership section then
 * opened with another 96px. The first enquiry action started at y=856 -- 104px below the fold.
 * With the rule it starts at y=690, 62px above it.
 */

test('the wholesale first-screen rule is scoped through a class only that page renders', () => {
  /*
   * `.page-title` is rendered by sections/ona-page-title.liquid, which four templates run:
   * wholesale, learn, faq and faq-subscriptions. Only wholesale is being tightened, so the
   * rule is gated on `.col-4-icons` -- the root class of sections/ona-icon-and-content.liquid.
   * That gate is only as good as the claim that no other page runs that section, which is the
   * part worth guarding: adding ona-icon-and-content to another template would silently crop
   * that page's header too, and nothing about this CSS would look wrong.
   */
  assert.match(
    css,
    /#MainContent:has\(\.col-4-icons\)\s+\.page-title\s*\{[^}]*padding-block-start:[^}]*padding-block-end:\s*0/,
    'the header rule must be gated on :has(.col-4-icons)',
  );

  const templates = readdirSync(join(root, 'templates')).filter((f) => f.endsWith('.json'));
  const running = templates.filter((f) =>
    readFileSync(join(root, 'templates', f), 'utf8').includes('"ona-icon-and-content"'),
  );
  assert.deepEqual(
    running,
    ['page.wholesale.json'],
    'the first-screen rule is scoped through .col-4-icons on the understanding that only the ' +
      'wholesale page renders ona-icon-and-content; another template now does, so the rule ' +
      "crops that page's header too -- re-scope it before adding the section there",
  );
});

test('the partnership rule reaches the first section after the header and no later one', () => {
  /*
   * `.add-image-and-text` is the root class of nine sections on this page, so tightening it
   * by class alone would collapse the spacing all the way down. The selector steps from the
   * section wrapper holding the header to the one immediately after it, which is the only
   * place the extra 96px costs anything.
   */
  assert.match(
    css,
    /#MainContent:has\(\.col-4-icons\)\s+\.shopify-section:has\(\.page-title\)\s*\+\s*\.shopify-section\s+\.add-image-and-text\s*\{/,
    'the partnership rule must be a sibling step from the header section, not a bare .add-image-and-text match',
  );
  assert.doesNotMatch(
    css,
    /#MainContent:has\(\.col-4-icons\)\s+\.add-image-and-text\s*\{/,
    'an unqualified .add-image-and-text rule would tighten every section on the page',
  );
});

test('the wholesale page still opens with the header and the partnership, in that order', () => {
  // The sibling step above is only correct while these two are adjacent in `order`.
  const template = JSON.parse(
    readFileSync(join(root, 'templates/page.wholesale.json'), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''),
  );
  const live = template.order.filter((key) => !template.sections[key].disabled);
  assert.equal(live[0], 'page_header');
  assert.equal(live[1], 'wholesale_partnership');
  assert.equal(template.sections.wholesale_partnership.type, 'ona-wholesale-partnership');
});
