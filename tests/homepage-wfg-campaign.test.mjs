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
 * The Water For Good campaign is two sections that only make sense together:
 * the banner says what the campaign is and links to the article, the counter
 * shows the money raised and links to the participating coffees. The 2026
 * homepage shipped the counter alone, so a live campaign showed a number with
 * nothing next to it explaining the number.
 *
 * The two destinations are not interchangeable and were checked against the
 * live store: the article returns 200, and so does the collection.
 */
test('the campaign banner sits directly above the counter and the two links point apart', () => {
  const home = parse('templates/index.json');
  const banner = home.sections.wfg_campaign_banner;
  const counter = home.sections.wfg_donation_counter;

  assert.ok(banner, 'the campaign banner must be on the homepage');
  assert.equal(banner.type, 'ona-campaign-banner');
  assert.ok(!banner.disabled, 'the banner is the campaign explanation; disabled it explains nothing');
  assert.ok(!counter.disabled, 'the counter must stay live');

  assert.equal(
    home.order.indexOf('wfg_campaign_banner') + 1,
    home.order.indexOf('wfg_donation_counter'),
    'the banner must render immediately above the counter, as it does on the legacy theme',
  );

  assert.match(
    banner.settings.cta_url,
    /^shopify:\/\/blogs\//,
    'the banner CTA goes to the campaign ARTICLE',
  );
  assert.match(
    counter.settings.learn_more_url,
    /^shopify:\/\/collections\//,
    'the counter CTA goes to the participating COLLECTION, not the article',
  );
  assert.notEqual(
    banner.settings.cta_url,
    counter.settings.learn_more_url,
    'the two calls to action do different jobs and must not collapse onto one destination',
  );
});
