/**
 * Nudges muted inline videos into autoplaying on mobile.
 *
 * `<video autoplay muted playsinline>` is enough on desktop, but on iOS a video that comes from
 * `video_tag` (the hero's background, for one) often sits on its poster: Safari honours the muted
 * *property* rather than the attribute when deciding whether a muted video may autoplay, and will
 * not start one whose data is not ready yet. This sets the property and asks it to play, retrying
 * once the browser reports it can - the same thing video-background-component does for the deferred
 * background videos, applied to the native ones that have no component of their own.
 *
 * Scoped to videos that already ask to autoplay, so it never starts a video the merchant left
 * paused, and it leaves anything already playing alone.
 */
function nudge(root = document) {
  const videos = root.querySelectorAll('video[autoplay]');

  for (const video of videos) {
    if (!(video instanceof HTMLVideoElement)) continue;
    // A component already drives these; don't fight it.
    if (video.closest('video-background-component')) continue;

    video.muted = true;
    video.playsInline = true;

    const attempt = () => {
      const started = video.play();
      if (started && typeof started.catch === 'function') started.catch(() => {});
    };

    attempt();
    video.addEventListener('canplay', attempt, { once: true });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => nudge());
} else {
  nudge();
}

// The theme editor swaps sections in without a full reload.
document.addEventListener('shopify:section:load', (event) => {
  if (event.target instanceof HTMLElement) nudge(event.target);
});
