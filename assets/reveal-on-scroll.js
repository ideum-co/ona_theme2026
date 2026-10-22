/**
 * Reveal on scroll — a light, dependency-free entrance for elements marked
 * `data-reveal`. An element fades and lifts into place the first time it enters
 * the viewport, then is left alone (reveal once). A `data-reveal-group` staggers
 * its own `data-reveal` children by writing `--reveal-index` on each.
 *
 * This only decides WHEN; the motion itself is CSS (assets/base.css), gated on
 * both `prefers-reduced-motion: no-preference` and the `reveal-ready` class that
 * the inline head script adds. So:
 *   - No JS, or the script fails  -> `reveal-ready` is never set -> every
 *     `[data-reveal]` stays visible. Nothing is ever hidden behind motion.
 *   - `prefers-reduced-motion: reduce` -> no hidden state, and this script
 *     reveals everything at once with no transition.
 */

const REVEALED = 'is-revealed';

const prefersReduced = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let io;
function observer() {
  io ??= new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add(REVEALED);
        obs.unobserve(entry.target);
      }
    },
    // Trigger a touch before the element is fully in view, so it is already
    // settling as it arrives rather than popping in late.
    { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
  );
  return io;
}

/** Numbers each group's own reveal children so CSS can stagger them. */
function stagger(scope) {
  for (const group of scope.querySelectorAll('[data-reveal-group]')) {
    let i = 0;
    for (const item of group.querySelectorAll('[data-reveal]')) {
      // Only this group's direct reveal descendants, not a nested group's.
      if (item.closest('[data-reveal-group]') !== group) continue;
      item.style.setProperty('--reveal-index', i);
      i += 1;
    }
  }
}

function init(root) {
  const scope = root && root.querySelectorAll ? root : document;
  const items = scope.querySelectorAll('[data-reveal]:not(.is-revealed)');
  if (!items.length) return;

  // Reduced motion, or no IntersectionObserver: show everything now, no animation.
  if (prefersReduced() || typeof IntersectionObserver === 'undefined') {
    items.forEach((el) => el.classList.add(REVEALED));
    return;
  }

  stagger(scope);
  const obs = observer();
  items.forEach((el) => obs.observe(el));
}

init();

// Re-arm after a section re-renders in the theme editor (its nodes are new).
document.addEventListener('shopify:section:load', (event) => init(event.target));
