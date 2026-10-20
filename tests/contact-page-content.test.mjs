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
  assert.equal(
    template.order[template.order.length - 1],
    'contact_details',
    'the details belong below the page body, as they do on the production page',
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

test('the contact page offers one form, not two', () => {
  /*
   * Measured on the live theme: /pages/contact rendered TWO working forms.
   *
   *   - Globo (Powerful Form Builder) form 62822, posting to form.globo.io,
   *     13 fields, with an enquiry-type router -- General / Orders and order
   *     tracking / Wholesale partnerships / Media / Other -- embedded as a
   *     `globo-formbuilder` div inside the page's own body.
   *   - Horizon's native `contact-form` block, posting to /contact, 7 fields,
   *     no routing. It arrived with the Horizon base template; nobody asked
   *     for it.
   *
   * The Globo one is what admin actually receives enquiries through, so the
   * native duplicate is the one that goes. The eventual destination is
   * Shopify's own Forms app -- already installed on this shop, and the native
   * route -- but migrating the router is its own piece of work, and losing
   * admin's enquiry routing to get there a stage early is not a trade worth
   * making.
   *
   * This asserts the template adds no form of its own. It cannot see the Globo
   * embed, which lives in page content rather than the theme.
   */
  const raw = read('templates/page.contact.json').replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
  const template = JSON.parse(raw);

  const types = [];
  const walk = (node) => {
    for (const b of Object.values(node.blocks ?? {})) {
      if (b.type) types.push(b.type);
      walk(b);
    }
  };
  for (const section of Object.values(template.sections)) {
    if (section.type) types.push(section.type);
    walk(section);
  }

  const forms = types.filter((t) => /contact-form|contact_form/.test(t));
  assert.deepEqual(forms, [], `the page body already carries the Globo form; the template must not add another: ${forms.join(', ')}`);
});
