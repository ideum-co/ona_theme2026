import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const template = () => {
  const raw = readFileSync(join(root, 'templates/page.wholesale.json'), 'utf8');
  return JSON.parse(raw.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));
};

/*
 * `ona-gust-r` rendered a second, hard-coded copy of the partnership band near the foot of
 * Wholesale -- the same eyebrow, the same heading, the same two paragraphs and the same
 * YouTube video the page already shows at the top -- plus a Shopify contact form ONA does not
 * work from and a `javascript:void(0)` button nothing binds. It was removed rather than
 * restyled. These guards are about the page, not the file: a section can come back under a new
 * name, so check the symptoms the duplicate produced.
 */
test('the duplicate wholesale band is gone, file and reference both', () => {
  assert.ok(
    !existsSync(join(root, 'sections/ona-gust-r.liquid')),
    'sections/ona-gust-r.liquid is back; it was a duplicate of the partnership band'
  );

  const templates = readdirSync(join(root, 'templates')).filter((name) => name.endsWith('.json'));
  assert.ok(templates.length > 5, `only ${templates.length} templates found; the probe is broken`);
  for (const name of templates) {
    const raw = readFileSync(join(root, 'templates', name), 'utf8');
    assert.ok(!raw.includes('ona-gust-r'), `templates/${name} still references ona-gust-r`);
  }
});

/*
 * The duplication is the point, so count the video rather than the section. Two sections
 * pointing at one id is the defect returning under another name.
 */
test('the wholesale page plays the partnership video exactly once', () => {
  const parsed = template();
  const live = Object.values(parsed.sections).filter((section) => !section.disabled);

  const urls = live
    .flatMap((section) => Object.values(section.settings ?? {}))
    .filter((value) => typeof value === 'string' && value.includes('youtu'));
  const partnership = urls.filter((url) => url.includes('42flR1Iwun4'));
  assert.equal(
    partnership.length,
    1,
    `the partnership video is referenced ${partnership.length} times; it is the page's hero and belongs to one section`
  );

  /* The settings above are the merchant's half. A section that hard-codes the id in markup
     would not show up there at all, which is exactly how the duplicate used to hide. */
  const hardCoded = readdirSync(join(root, 'sections'))
    .filter((name) => name.endsWith('.liquid'))
    .filter((name) => readFileSync(join(root, 'sections', name), 'utf8').includes('42flR1Iwun4'));
  assert.deepEqual(hardCoded, [], 'a section hard-codes the partnership video instead of taking it as a setting');
});

/*
 * Removing an enquiry form from an enquiry page is only safe while another route survives, and
 * "the CTA is present" is not the same as "the CTA works" -- the one this replaced was a
 * `javascript:void(0)` anchor with nothing bound to it. Require a real destination.
 */
test('wholesale keeps a working enquiry route and no dead one', () => {
  const parsed = template();
  const types = parsed.order
    .filter((key) => !parsed.sections[key].disabled)
    .map((key) => parsed.sections[key].type);

  const sources = types.map((type) => {
    const path = join(root, 'sections', `${type}.liquid`);
    assert.ok(existsSync(path), `the template runs ${type}, which has no section file`);
    return readFileSync(path, 'utf8');
  });

  const enquiry = sources.filter((source) => source.includes('forms.monday.com'));
  assert.ok(
    enquiry.length > 0,
    'no section on Wholesale links to the enquiry form; removing the contact form left the page with no way to enquire'
  );

  for (const [index, source] of sources.entries()) {
    assert.ok(
      !/href="javascript:void\(0\);?"[^>]*\bclass="[^"]*more-btn/.test(source),
      `${types[index]} carries a dead javascript: enquiry button`
    );
  }
});
