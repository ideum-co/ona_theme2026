/**
 * Story-video scroll scale — fallback driver for browsers without CSS scroll-driven animations.
 *
 * Where `animation-timeline: view()` is supported, the CSS in story-video.liquid does all the work
 * and this script no-ops. Elsewhere, it writes `--sv-scale` on each opted-in `.story-video__media`
 * from its position in the viewport: full size (1) at centre, easing to 0.92 at the edges, so the
 * video breathes with the scroll in both directions. Transform only, rAF-throttled, and it only
 * observes the few media on the page, so it costs nothing until one is near the viewport.
 */

const MIN_SCALE = 0.92;

const prefersReduced = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const cssHandlesIt = () =>
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('animation-timeline', 'view()');

function init() {
  const media = Array.from(document.querySelectorAll('.story-video--scroll-scale .story-video__media'));
  if (!media.length || prefersReduced() || cssHandlesIt()) return;

  const active = new Set();
  let ticking = false;

  const update = () => {
    ticking = false;
    const viewportCenter = window.innerHeight / 2;
    for (const el of active) {
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const reach = viewportCenter + rect.height / 2;
      const distance = reach > 0 ? Math.min(1, Math.abs(center - viewportCenter) / reach) : 0;
      const scale = 1 - (1 - MIN_SCALE) * distance;
      el.style.setProperty('--sv-scale', scale.toFixed(3));
    }
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };

  // Only drive the elements that are actually near the viewport.
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) active.add(entry.target);
        else {
          active.delete(entry.target);
          entry.target.style.removeProperty('--sv-scale');
        }
      }
      update();
    },
    { rootMargin: '20% 0px 20% 0px' }
  );

  media.forEach((el) => io.observe(el));
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
