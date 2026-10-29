import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const SNIPPET = 'snippets/appstle-portal-styles.liquid';
const LAYOUT = 'layout/theme.liquid';
const CARD_BLOCK = 'blocks/_card.liquid';

/*
 * Measured on https://onacoffee.com.au/apps/subscriptions on 2026-10-26.
 *
 * Appstle's portal renders inside this theme's layout, and ships markup using the bare class
 * name `card`. blocks/_card.liquid claims that same bare selector in the shared bundle, so the
 * winning rule on Appstle's card came from our own styles.css:
 *
 *   display: flex | flex-direction: column | width: 100% | height: 100%
 *   overflow: hidden | container-type: inline-size
 *
 * These are the declarations that clip or distort a box whose contents we do not control. The
 * guards below pin the two halves that make the fix work -- that the override is scoped so it
 * cannot reach the theme's own cards, and that every clipping declaration is actually answered.
 * Asserting the snippet merely exists would pass while the leak stayed open.
 */

// Every property blocks/_card.liquid sets that can clip or reflow foreign markup, and the value
// that hands the box back. `position` and the border-* declarations are deliberately absent:
// they do not clip, and reverting `position: relative` could pull the containing block out from
// under an absolutely positioned Appstle child.
const NEUTRALISED = {
  display: 'block',
  width: 'auto',
  height: 'auto',
  overflow: 'visible',
  'container-type': 'normal',
};

/** The snippet's CSS with Liquid comments and the stylesheet wrapper stripped. */
function portalCss() {
  const raw = read(SNIPPET);
  const body = raw.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');
  const match = body.match(/\{%\s*stylesheet\s*%\}([\s\S]*?)\{%\s*endstylesheet\s*%\}/);
  assert.ok(match, `${SNIPPET} must wrap its rules in a stylesheet block so Shopify collects them`);
  return match[1];
}

/** The selector list of the rule that mentions `.card`, with comments removed. */
function cardRuleSelectors() {
  const css = portalCss().replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = css.match(/([^{}]*\.card[^{}]*)\{/);
  assert.ok(rule, `${SNIPPET} must carry a rule targeting Appstle's .card`);
  return rule[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

test('the leak this fixes is real: the theme claims a bare .card in the shared bundle', () => {
  const card = read(CARD_BLOCK);
  assert.match(
    card,
    /^\s*\.card\s*\{/m,
    `${CARD_BLOCK} is expected to define a bare .card -- if that selector was scoped or renamed, ` +
      `the portal override is dead weight and this snippet should be removed, not left to rot`
  );
  for (const prop of Object.keys(NEUTRALISED)) {
    assert.match(
      card,
      new RegExp(`\\.card\\s*\\{[^}]*\\b${prop}\\s*:`, 's'),
      `${CARD_BLOCK}'s .card no longer sets ${prop}; re-measure the portal before trimming the override`
    );
  }
});

test('every scoped selector is anchored to an Appstle container, never a bare .card', () => {
  const selectors = cardRuleSelectors();
  assert.ok(selectors.length >= 1, 'expected at least one scoped selector');
  for (const sel of selectors) {
    assert.match(
      sel,
      /^\.(appstle-customer-portal|appstle-wrapper)\s+\.card$/,
      `"${sel}" is not anchored to an Appstle container. A bare or loosely scoped .card here ` +
        `would strip geometry from every product card in the theme`
    );
  }
});

test('both Appstle portal containers are covered', () => {
  const selectors = cardRuleSelectors().join(' ');
  for (const container of ['appstle-customer-portal', 'appstle-wrapper']) {
    assert.match(
      selectors,
      new RegExp(`\\.${container}\\s+\\.card`),
      `.${container} was present in the live portal markup and must be covered`
    );
  }
});

test('every clipping declaration is answered with the measured value', () => {
  const css = portalCss();
  for (const [prop, value] of Object.entries(NEUTRALISED)) {
    assert.match(
      css,
      new RegExp(`\\b${prop}\\s*:\\s*${value}\\s*;`),
      `${prop} must be reset to ${value}; leaving it inherited is what clips a populated card`
    );
  }
});

test('position is left alone on purpose', () => {
  const css = portalCss().replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(
    css,
    /(^|[;{\s])position\s*:/,
    'reverting position: relative could remove the containing block an absolutely positioned ' +
      'Appstle child depends on; it does not clip, so it stays'
  );
});

test('the snippet is actually rendered, or none of it ships', () => {
  const layout = read(LAYOUT);
  const stripped = layout.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');
  assert.match(
    stripped,
    /\{%-?\s*render\s+'appstle-portal-styles'\s*-?%\}/,
    `${LAYOUT} must render 'appstle-portal-styles'; an unrendered snippet is never collected ` +
      `into styles.css and the override silently does nothing`
  );
});
