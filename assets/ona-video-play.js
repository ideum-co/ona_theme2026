/**
 * Play handler for the legacy `.play-video` poster buttons used by the ported ONA
 * sections (testimonials, partnership, exclusive access, expressions, supported,
 * training). The old theme drove these from a script in `main.js`, which this theme
 * does not carry -- so the poster was clickable but nothing played. This restores it.
 *
 * Each video block renders a player element by `data-id`, a poster image
 * (`.scale-cover-image`) and a `.play-video` button carrying:
 *   - data-type : 'upload' | 'embed'
 *   - data-id   : the player element's id
 *   - data-video: the provider video id (or the <video> is found by id)
 *   - data-url  : the original URL (used to tell YouTube from Vimeo)
 *
 * On click we reveal/start the right player and hide the poster and button. One
 * delegated listener covers every block on the page, including slider clones.
 */
(() => {
  if (window.__onaVideoPlayBound) return;
  window.__onaVideoPlayBound = true;

  const startUpload = (video) => {
    if (video.dataset.src && !video.getAttribute('src')) {
      video.src = video.dataset.src;
    }
    video.setAttribute('controls', '');
    video.muted = false;
    const played = video.play();
    if (played && typeof played.catch === 'function') played.catch(() => {});
  };

  const startVimeo = (iframe) => {
    const src = iframe.getAttribute('src') || '';
    if (!src.includes('autoplay=1')) {
      iframe.src = src + (src.includes('?') ? '&' : '?') + 'autoplay=1';
    }
  };

  const startYouTube = (placeholder, videoId) => {
    if (!videoId) return;
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`;
    iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('title', 'Video');
    iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;';
    placeholder.replaceWith(iframe);
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest('.play-video');
    if (!button) return;
    event.preventDefault();

    const { type, id, video: videoId, url = '' } = button.dataset;
    const player = id ? document.getElementById(id) : null;

    // Hide the poster and the button so the player shows through.
    const poster = button.parentElement?.querySelector('.scale-cover-image');
    if (poster) poster.style.display = 'none';
    button.style.display = 'none';

    if (!player) return;

    const isVimeo = url.includes('vimeo') || (player.tagName === 'IFRAME' && (player.getAttribute('src') || '').includes('vimeo'));

    if (type === 'upload' || player.tagName === 'VIDEO') {
      startUpload(player);
    } else if (isVimeo) {
      startVimeo(player);
    } else {
      startYouTube(player, videoId);
    }
  });
})();
