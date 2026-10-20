import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const section = read('sections/locations-flagships.liquid');
const script = read('assets/locations-flagships.js');

/*
 * The previous theme's locations-content listed ONA's own venues as clickable
 * names beside the gallery and details -- picking a name was how you moved
 * between them. The Horizon port rendered every venue expanded in a flat list,
 * which lost that, and /pages/locations grew to 1.35MB of <main> partly as a
 * result.
 */

test('the venue names are a real tablist wired to the cards', () => {
  assert.match(section, /role="tablist"/, 'the venue names must be a tablist');
  assert.match(section, /<button\s+type="button"[\s\S]{0,200}role="tab"/, 'each venue name must be a button, not a styled div');
  assert.match(section, /role="tabpanel"/, 'each card must be the panel its name controls');

  // The ids have to line up, or a tab opens the wrong venue.
  assert.match(section, /aria-controls="FlagshipPanel-\{\{ section\.id \}\}-\{\{ flagship_nav_index \}\}"/, 'tabs point at panels by index');
  assert.match(section, /id="FlagshipPanel-\{\{ section\.id \}\}-\{\{ flagship_index \}\}"/, 'panels carry the matching id');
  assert.match(section, /aria-labelledby="FlagshipTab-\{\{ section\.id \}\}-\{\{ flagship_index \}\}"/, 'panels name their tab back');

  /*
   * Both loops filter on the same `flagship` tag and count independently, so
   * the two counters must start together. If one were seeded elsewhere the ids
   * would drift by one and every tab would open its neighbour.
   */
  assert.match(section, /assign flagship_nav_index = 0[\s\S]{0,80}assign flagship_index = 0/, 'both counters reset together');
});

test('without JavaScript every venue is still readable', () => {
  /*
   * The nav is hidden and the cards are all visible until the custom element
   * connects and adds `is-enhanced`. A tablist that hides content before its
   * script runs turns a slow load into an empty page.
   */
  assert.match(section, /\.locations-flagships__nav \{\s*display: none;/, 'the nav starts hidden');
  assert.match(
    section,
    /\.locations-flagships__tabs\.is-enhanced \.locations-flagships__card \{\s*display: none;/,
    'cards are only collapsed once the tablist is driving them',
  );
  /*
   * Anchored to the start of a rule. An unanchored
   * /\.locations-flagships__card \{[^}]*display: none/ also matches the tail of
   * `.locations-flagships__tabs.is-enhanced .locations-flagships__card {`, so
   * it failed against correct CSS -- the first draft of this test did exactly
   * that.
   */
  assert.doesNotMatch(
    section,
    /(?:^|\n)\s*\.locations-flagships__card \{[^}]*display: none/,
    'the unqualified card rule must not hide anything',
  );
  assert.match(script, /this\.classList\.add\('is-enhanced'\)/, 'the element opts in to the collapsed layout');
});

test('selection moves the panel and the accessibility tree together', () => {
  /*
   * aria-selected, the roving tabindex and the visible panel all change in one
   * pass. Splitting them is how a tablist ends up announcing one venue while
   * showing another.
   */
  const select = script.match(/select\(index\)\s*\{([\s\S]*?)\n  \}/);
  assert.ok(select, 'there must be a single select()');
  assert.match(select[1], /aria-selected/, 'selection must be exposed');
  assert.match(select[1], /tabIndex/, 'a roving tabindex keeps one stop in the tablist');
  assert.match(select[1], /classList\.toggle\('is-active'/, 'the panel must follow');

  assert.match(script, /ArrowRight|ArrowLeft/, 'a tablist is arrow-key navigable');
  assert.match(script, /if \(this\.tabs\.length < 2/, 'a single venue needs no tablist');
});
