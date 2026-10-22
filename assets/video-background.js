import { Component } from '@theme/component';

/**
 * A custom element that renders a video background.
 *
 * @typedef {object} Refs
 * @property {HTMLElement[]} videoSources - The video sources.
 * @property {HTMLVideoElement} videoElement - The video element.
 *
 * @extends Component<Refs>
 */
export class VideoBackgroundComponent extends Component {
  requiredRefs = ['videoSources', 'videoElement'];

  connectedCallback() {
    super.connectedCallback();

    const { videoSources, videoElement } = this.refs;

    const deviceLayer = this.closest('.ona-responsive-background');
    if (deviceLayer) {
      const mobile = window.matchMedia('(max-width: 749px)');
      const shouldPlay = () => deviceLayer.classList.contains(mobile.matches ? 'ona-responsive-background--mobile' : 'ona-responsive-background--desktop');
      const syncPlayback = () => {
        if (shouldPlay()) {
          for (const source of videoSources) {
            if (source.dataset.videoSource && !source.src) source.setAttribute('src', source.dataset.videoSource);
          }
          videoElement.load();
          this.#autoplay(videoElement);
        } else {
          videoElement.pause();
        }
      };
      syncPlayback();
      this._mobileMedia = mobile;
      this._syncPlayback = syncPlayback;
      mobile.addEventListener('change', syncPlayback);
      return;
    }

    for (const source of videoSources) {
      const { videoSource } = source.dataset;

      if (videoSource) source.setAttribute('src', videoSource);
    }

    videoElement.load();
    this.#autoplay(videoElement);
  }

  /**
   * Starts a muted inline video so it autoplays on mobile too.
   *
   * The `muted` and `playsinline` HTML attributes are not enough on iOS for a programmatic play:
   * Safari honours the muted *property*, not the attribute, when `play()` is called from script, so
   * it has to be set here. And `play()` is being called right after `load()`, before the video has
   * any data, which rejects on mobile - so a rejection is retried once the video can actually play
   * rather than swallowed.
   *
   * @param {HTMLVideoElement} video
   */
  #autoplay(video) {
    video.muted = true;
    video.playsInline = true;

    const attempt = () => {
      const started = video.play();

      if (started && typeof started.catch === 'function') {
        started.catch(() => {});
      }
    };

    attempt();
    // `canplay` fires once the browser has enough data; retrying there covers the load()/play() race.
    video.addEventListener('canplay', attempt, { once: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._mobileMedia && this._syncPlayback) this._mobileMedia.removeEventListener('change', this._syncPlayback);
  }
}

if (!customElements.get('video-background-component')) {
  customElements.define('video-background-component', VideoBackgroundComponent);
}
