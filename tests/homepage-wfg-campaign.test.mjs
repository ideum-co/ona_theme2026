import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const parse = (p) =>
  JSON.parse(readFileSync(resolve(root, p), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));

/*
 * Shopify allows at most 25 sections in a JSON template, and exceeding it is
 * not a soft failure: the theme is refused on save, upload or sync. #152 had to
 * cut index.json back under the limit once already, and on 2026-10-21 it was
 * sitting at exactly 25 -- eleven of them disabled -- so the next section
 * anyone added would have broken the homepage sync with no local symptom.
 *
 * DISABLED SECTIONS STILL COUNT. They are entries in `sections`, and that is
 * what the platform measures. "It is turned off" is not headroom.
 *
 * This walks every template rather than naming index.json, so a collection or
 * page template that fills up fails here instead of on the theme.
 */
test('no JSON template exceeds Shopify\'s 25-section limit', () => {
  const templates = readdirSync(resolve(root, 'templates')).filter((f) => f.endsWith('.json'));
  assert.ok(templates.length > 5, 'expected to find the template directory');

  for (const name of templates) {
    const t = parse(`templates/${name}`);
    if (!t.sections) continue;
    const count = Object.keys(t.sections).length;
    assert.ok(
      count <= 25,
      `${name} has ${count} sections; Shopify's limit is 25 and disabled sections count. ` +
        'Free a slot before adding another.',
    );
    assert.deepEqual(
      [...t.order].sort(),
      Object.keys(t.sections).sort(),
      `${name}: every section must appear in order exactly once, or Shopify rejects the template`,
    );
  }
});

/*
 * The Water For Good campaign CLOSED on 31 October 2026 at a final published
 * total of $33,524. The banner ("Campaign running now until...") was removed on
 * 1 November because it asserted a live campaign; the counter stays, reworded
 * to thank people for what they contributed. The section files for both remain
 * in the theme so the pair can be restored for the next campaign.
 *
 * What this guards now:
 *   - the banner does NOT come back by accident while no campaign is running,
 *   - the counter survives the banner's removal, enabled and near the top,
 *   - its CTA still points at the participating COLLECTION, not the article,
 *   - the copy is retrospective, not an active-campaign call to action.
 */
test('the closed campaign leaves the counter alone on the homepage', () => {
  const home = parse('templates/index.json');
  const counter = home.sections.wfg_donation_counter;

  assert.ok(
    !home.sections.wfg_campaign_banner,
    'the campaign banner announces a LIVE campaign; it must not be on the homepage while none is running',
  );
  assert.ok(
    !home.order.includes('wfg_campaign_banner'),
    'a section left in order but not in sections is rejected by Shopify on sync',
  );

  assert.ok(counter, 'the contribution counter must stay on the homepage');
  assert.equal(counter.type, 'ona-donation-counter');
  assert.ok(!counter.disabled, 'the counter must stay live');
  assert.equal(
    home.order.indexOf('wfg_donation_counter'),
    1,
    'the counter stays directly under the hero, where the banner used to sit above it',
  );

  assert.match(
    counter.settings.learn_more_url,
    /^shopify:\/\/collections\//,
    'the counter CTA goes to the participating COLLECTION, not the article',
  );
  assert.match(
    counter.settings.title,
    /CONTRIBUTED/,
    'the closed-campaign copy reports what was contributed; it does not solicit',
  );
  assert.doesNotMatch(
    counter.settings.title,
    /SO FAR/,
    '"SO FAR" reads as a running campaign and was replaced at close-out',
  );
});
