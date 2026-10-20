import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

test("the contact page still carries ONA's contact details", () => {
  /*
   * The legacy theme's contact page had four sections: the title, a
   * `contact-info` block with email / phone / address / opening hours, the
   * form, and a careers block. The ported template kept only the title, the
   * page body and the form, so the live page fell from 106 words to 26 and
   * from two images to none -- and a customer could not find ONA's phone
   * number, address or opening hours anywhere on it.
   *
   * Rebuilt with stock Horizon `section` / `group` / `text` blocks rather than
   * porting another legacy section, so it stays editable in the theme editor.
   */
  const raw = read('templates/page.contact.json').replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
  const template = JSON.parse(raw);

  assert.ok(template.sections.contact_details, 'the contact details section is gone');
  assert.ok(
    template.order.indexOf('contact_details') < template.order.indexOf('form'),
    'the details belong above the form, as they do on the production page',
  );

  /*
   * The four facts themselves, not just the section's existence -- the section
   * could survive with every block emptied and nothing here would say so.
   */
  for (const [what, needle] of [
    ['email', 'mailto:admin@onacoffee.com.au'],
    ['phone', '02 6162 3321'],
    ['address', 'Wollongong St, Fyshwick ACT 2609'],
    ['opening hours', 'Monday to Friday 9 - 5'],
  ]) {
    assert.ok(raw.includes(needle), `the contact page must still give the ${what}`);
  }

  // A tel: link that keeps the spaces is not dialable from a phone.
  assert.ok(raw.includes('tel:+61261623321'), 'the phone number needs a dialable tel: link');
});

test('the contact page does not say "get in touch" twice', () => {
  /*
   * The page's own body already opens with `<h2>GET IN TOUCH</h2>` and the
   * invitation sentence under it, and `main` renders that body verbatim. The
   * first pass at this section repeated both -- a second "Get in touch" heading
   * and a second "we'd love to hear from you" paragraph -- so the rendered page
   * asked the customer to get in touch twice before showing a single detail.
   *
   * The details themselves are what was missing; the words around them were not.
   */
  const raw = read('templates/page.contact.json').replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
  const template = JSON.parse(raw);
  const details = template.sections.contact_details;

  const texts = [];
  const walk = (node) => {
    for (const b of Object.values(node.blocks ?? {})) {
      if (typeof b.settings?.text === 'string') texts.push(b.settings.text);
      walk(b);
    }
  };
  walk(details);

  for (const text of texts) {
    assert.doesNotMatch(
      text,
      /get in touch|love to hear from you/i,
      `page.content already carries this copy: ${text.slice(0, 60)}`,
    );
  }
});
