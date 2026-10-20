/**
 * Accordions for the ported `.add-faqs` lists.
 *
 * The legacy theme collapsed every `.faqs-text` and opened one when its title
 * was clicked, adding `is-active` to the title. Without that script every
 * answer rendered open: on /pages/wholesale that was 788px of open copy in
 * `ona-training` alone, which is almost the whole difference between its
 * 1,349px and the old theme's 517px.
 *
 * One delegated listener for the document. The module is imported by each
 * section that needs it; a module with the same URL is evaluated once, so the
 * repeated <script> tags do not stack listeners.
 */
const SELECTOR = '.faqs-toggle';

const panelFor = (toggle) => {
  const block = toggle.closest('.block');
  return block ? block.querySelector('.faqs-text') : null;
};

const setOpen = (toggle, open) => {
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  toggle.closest('.faqs-title')?.classList.toggle('is-active', open);
  // No aria-hidden here: a closed panel is `display: none`, which already
  // takes it out of the accessibility tree. (The coffee tabs need it because
  // they hide with opacity instead.)
  panelFor(toggle)?.classList.toggle('is-active', open);
};

document.addEventListener('click', (event) => {
  const toggle = event.target.closest(SELECTOR);
  if (!toggle) return;
  setOpen(toggle, toggle.getAttribute('aria-expanded') !== 'true');
});
