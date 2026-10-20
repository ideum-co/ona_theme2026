import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const sectionSource = read('sections/locations-flagships.liquid');
/*
 * Markup only. The source explains in a {% comment %} why it does NOT render
 * role="tabpanel", and a guard that reads prose as markup fails on correct
 * code -- which is exactly what happened first time. It could equally be
 * fooled into passing by a comment, so stripping them is the fix in both
 * directions.
 */
const section = sectionSource.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');
const script = read('assets/locations-flagships.js');
const tabs = script.slice(script.indexOf('class LocationsFlagshipsTabs'));

/*
 * The previous theme's locations-content laid ONA's own venues out as a
 * master/detail: a column of venue names, with the gallery, address, hours and
 * website swapping beside them as you picked one. The Horizon port rendered
 * every venue expanded in a flat list, so the names stopped being a control.
 */

test('the section provides the tablist container and the panels', () => {
  assert.match(section, /role="tablist"/, 'the venue names need a tablist container');
  assert.match(section, /data-flagship-nav/, 'the element needs to find the nav');
  /*
   * role="tabpanel" is NOT rendered here. Unenhanced -- no JavaScript, or fewer
   * than two venues -- a card with tabpanel semantics is a panel with no
   * controlling tab and no accessible name. The element adds the role when it
   * builds the tablist and strips it when it stands down. Codex, #231.
   */
  assert.doesNotMatch(section, /role="tabpanel"/, 'tabpanel semantics are added only once enhanced');
  assert.match(tabs, /panel\.setAttribute\('role', 'tabpanel'\)/, 'the element adds the role');

  /*
   * The buttons are deliberately NOT rendered here. LocationsFlagshipsLoader
   * calls list.replaceChildren() once it has aggregated venues from every
   * paginated page, so markup-rendered buttons would point at panels that no
   * longer exist, and a per-page Liquid counter would emit duplicate ids.
   */
  assert.doesNotMatch(section, /role="tab"(?!list)/, 'tabs are built from the cards, not rendered per page');
  assert.doesNotMatch(section, /flagship_nav_index|FlagshipTab-\{\{/, 'no Liquid-side tab ids survive pagination');
});

test('the tablist is rebuilt when the loader replaces the list', () => {
  /*
   * This is the case that makes a markup-rendered tablist unsafe. The section
   * paginates at 250 and the loader replaces the whole list with cards
   * aggregated from every page. A tablist that snapshotted its panels at
   * connect would leave every later venue with a panel and no tab -- and since
   * the collapsed layout hides any card without `is-active`, those venues
   * would be unreachable. Codex caught this on #231.
   */
  assert.match(tabs, /new MutationObserver\(\(\) => this\.refresh\(\)\)/, 'the tablist must follow the list');
  assert.match(tabs, /observe\(this\.list, \{ childList: true \}\)/, 'it is childList changes that matter');
  assert.match(tabs, /refresh\(\)\s*\{/, 'there must be a single rebuild path');
  assert.match(tabs, /this\.observer\?\.disconnect\(\)/, 'and it must be torn down');

  // Ids are assigned at rebuild time, so tabs and panels cannot drift apart.
  assert.match(tabs, /panel\.id = panelId/, 'panels are given their id here');
  assert.match(tabs, /button\.setAttribute\('aria-controls', panelId\)/, 'and the tab points at it');
  assert.match(tabs, /panel\.setAttribute\('aria-labelledby', tabId\)/, 'and the panel names its tab back');
});

test('fewer than two venues means no tablist and nothing hidden', () => {
  /*
   * Zero panels also happens before the loader finishes. Either way the
   * collapsed layout has to come off, or a card sits hidden behind a control
   * that is not there.
   */
  const guard = tabs.match(/if \(this\.panels\.length < 2\) \{([\s\S]*?)\n    \}/);
  assert.ok(guard, 'there must be a guard for fewer than two venues');
  assert.match(guard[1], /classList\.remove\('is-enhanced'\)/, 'the collapsed layout must come off');
  assert.match(guard[1], /this\.nav\.replaceChildren\(\)/, 'and the stale buttons must go');
  assert.match(guard[1], /removeAttribute\('role'\)/, 'and the orphaned tabpanel role with them');
  assert.match(guard[1], /removeAttribute\('aria-labelledby'\)/, 'including a label pointing at a deleted tab');
});

test('without JavaScript every venue is still readable', () => {
  /*
   * The nav is hidden and the cards are all visible until the element connects
   * and adds `is-enhanced`. A tablist that hides content before its script runs
   * turns a slow load into an empty page -- and this page already ships 1.35MB
   * of <main>.
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
   * the `.is-enhanced` selector above, so it failed against correct CSS -- the
   * first draft of this test did exactly that.
   */
  assert.doesNotMatch(
    section,
    /(?:^|\n)\s*\.locations-flagships__card \{[^}]*display: none/,
    'the unqualified card rule must not hide anything',
  );
  assert.match(tabs, /this\.classList\.add\('is-enhanced'\)/, 'the element opts in to the collapsed layout');
});

test('selection moves the panel and the accessibility tree together', () => {
  /*
   * aria-selected, the roving tabindex and the visible panel all change in one
   * pass. Splitting them is how a tablist announces one venue while showing
   * another.
   */
  const select = tabs.match(/select\(index\)\s*\{([\s\S]*?)\n  \}/);
  assert.ok(select, 'there must be a single select()');
  assert.match(select[1], /aria-selected/, 'selection must be exposed');
  assert.match(select[1], /tabIndex/, 'a roving tabindex keeps one stop in the tablist');
  assert.match(select[1], /classList\.toggle\('is-active'/, 'the panel must follow');

  assert.match(tabs, /ArrowRight|ArrowLeft/, 'a tablist is arrow-key navigable');
  // Rebuilding must not silently jump the reader back to the first venue.
  assert.match(tabs, /b\.dataset\.locationId === selected/, 'the open venue survives a rebuild');
});
