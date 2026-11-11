/**
 * Hero typewriter — types the hero heading out on load, like a signature being written.
 *
 * Opt-in via `.hero--type-heading` on the hero wrapper. The full heading always ships in the
 * HTML, so a no-JS visit, reduced motion, a rich (multi-node) heading, or any thrown error all
 * leave the real text exactly where it was — the effect only ever *replaces* text it first read.
 */

const SPEED_MS = 55; // per character
const START_DELAY_MS = 260;

const prefersReduced = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function typeHeading(hero) {
  const title = hero.querySelector('.hero__content-wrapper > .text-block:first-child');
  if (!title || title.dataset.typed) return;

  // Only a single plain text run. Anything richer (links, line breaks, nested markup) is left
  // untouched rather than risk mangling it.
  if (title.children.length > 0) return;
  const text = (title.textContent || '').replace(/\s+/g, ' ').trim();
  if (!text) return;

  title.dataset.typed = 'pending';

  // A hidden full-text ghost reserves the final box so nothing below shifts while it types.
  const ghost = document.createElement('span');
  ghost.className = 'hero-typing__ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.textContent = text;

  const live = document.createElement('span');
  live.className = 'hero-typing__live';

  // The real, announced text — present in full for screen readers from the first frame.
  const output = document.createElement('span');
  output.className = 'hero-typing__text';

  const caret = document.createElement('span');
  caret.className = 'hero-typing__caret';
  caret.setAttribute('aria-hidden', 'true');

  live.append(output, caret);
  title.textContent = '';
  title.append(ghost, live);
  title.classList.add('hero-typing');

  let i = 0;
  const tick = () => {
    i += 1;
    output.textContent = text.slice(0, i);
    if (i < text.length) {
      window.setTimeout(tick, SPEED_MS);
    } else {
      title.classList.add('hero-typing--done');
      title.dataset.typed = 'done';
    }
  };
  window.setTimeout(tick, START_DELAY_MS);
}

try {
  const hero = document.querySelector('.hero--type-heading');
  if (hero && !prefersReduced()) typeHeading(hero);
} catch (error) {
  // Leave the real heading in place.
}
