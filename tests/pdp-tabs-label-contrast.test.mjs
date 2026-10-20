import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tabs = readFileSync(join(root, 'sections/product-tabs.liquid'), 'utf8');
const snippet = readFileSync(join(root, 'snippets/contrast-override.liquid'), 'utf8');

/*
 * product-tabs paints itself with a per-product background but a single stored label colour, so
 * the two are paired by whoever filled the metafield. 55 other sections dodge this by rendering
 * contrast-override.liquid; this one writes its own custom property, so it carries the rule
 * inline instead. These tests exist to stop the inline copy drifting from the original.
 */
test('the tabs correct an unreadable label colour instead of printing it', () => {
  assert.match(tabs, /color_contrast/, 'product-tabs no longer measures the label contrast');
  assert.match(tabs, /color_brightness/, 'product-tabs no longer falls back on background brightness');
  assert.match(
    tabs,
    /var\(--palette-darkest\)/,
    'the light-background fallback should be the palette extreme, not a literal'
  );
  assert.match(
    tabs,
    /var\(--palette-lightest\)/,
    'the dark-background fallback should be the palette extreme, not a literal'
  );
});

/*
 * Both numbers are the snippet's, not ours. If Horizon moves its AA threshold or its brightness
 * midpoint, the two surfaces would disagree about what counts as readable -- which is the
 * original defect wearing a different hat.
 */
test('the tabs use the same thresholds as the theme-wide contrast system', () => {
  const threshold = (text) => text.match(/contrast\s*>=\s*([\d.]+)|contrast\s*<\s*([\d.]+)/);
  const midpoint = (text) => text.match(/brightness\s*>\s*(\d+)/);

  const snippetThreshold = threshold(snippet);
  const tabsThreshold = threshold(tabs);
  assert.ok(snippetThreshold, 'contrast-override.liquid no longer states a contrast threshold');
  assert.ok(tabsThreshold, 'product-tabs.liquid no longer states a contrast threshold');
  assert.equal(
    tabsThreshold[1] ?? tabsThreshold[2],
    snippetThreshold[1] ?? snippetThreshold[2],
    'product-tabs and contrast-override disagree on what contrast is sufficient'
  );

  const snippetMid = midpoint(snippet);
  const tabsMid = midpoint(tabs);
  assert.ok(snippetMid, 'contrast-override.liquid no longer states a brightness midpoint');
  assert.ok(tabsMid, 'product-tabs.liquid no longer states a brightness midpoint');
  assert.equal(
    tabsMid[1],
    snippetMid[1],
    'product-tabs and contrast-override disagree on where a background stops being dark'
  );
});

/*
 * A per-product text metafield is an explicit choice and must survive, exactly as it does in the
 * snippet ("Explicit text_color wins"). The correction is only for the section-level fallback.
 */
test('an explicit per-product label colour is not overridden', () => {
  assert.match(
    tabs,
    /product_text\s*==\s*blank/,
    'the correction should be skipped when the product carries its own text colour'
  );
});
