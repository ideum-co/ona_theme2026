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
          videoElement.play().catch(() => {});
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
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._mobileMedia && this._syncPlayback) this._mobileMedia.removeEventListener('change', this._syncPlayback);
  }
}

if (!customElements.get('video-background-component')) {
  customElements.define('video-background-component', VideoBackgroundComponent);
}
