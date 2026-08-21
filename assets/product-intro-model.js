import { Component } from '@theme/component';

/**
 * Brings up the 3D model in the product introduction section.
 *
 * The product media gallery defers its models behind a poster and a play button, because a gallery
 * can hold several and they are heavy. Here the model *is* the section's centrepiece, so it comes
 * up on its own once it is close to the viewport - a model further down the page never competes
 * with the hero for bandwidth.
 *
 * The element itself is not created here when the model belongs to a product: `model_viewer_tag`
 * emits it, which is also what tells Shopify to ship the `<model-viewer>` implementation to the
 * page at all. This component only writes the section's settings onto it. A model that is not
 * attached to a product has no filter to go through, so it is built here instead, and it only
 * works once something else on the page has brought the element in.
 *
 * @extends Component<{}>
 */
export class ProductIntroModel extends Component {
  /** @type {IntersectionObserver | undefined} */
  #observer;

  connectedCallback() {
    super.connectedCallback();

    const viewer = this.querySelector('model-viewer');

    // Configuration is declarative and must not wait on anything: the element `model_viewer_tag`
    // emits renders on its own, and an observer that never fires - a background tab, say - would
    // otherwise leave it unconfigured.
    if (viewer) this.#applySettings(viewer);

    // `rootMargin` gives the model a head start, so it is usually ready by the time it is on screen.
    this.#observer = new IntersectionObserver(this.#handleIntersect, { rootMargin: '400px' });
    this.#observer.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#observer?.disconnect();
  }

  /** @param {IntersectionObserverEntry[]} entries */
  #handleIntersect = (entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;

    this.#observer?.disconnect();
    this.#load();
  };

  async #load() {
    let viewer = this.querySelector('model-viewer');

    if (!viewer) {
      viewer = this.#buildViewer();
      if (viewer) this.#applySettings(viewer);
    }

    if (!viewer) return;

    // The UI wrapper is what the product gallery loads too. It is not needed to render the model,
    // so a failure here is not fatal.
    const shopify = /** @type {any} */ (window).Shopify;
    shopify?.loadFeatures?.([{ name: 'model-viewer-ui', version: '1.0' }]);

    if (!customElements.get('model-viewer') && !(await this.#loadViewerLibrary())) {
      console.warn(
        '[product-intro] The <model-viewer> element could not be loaded, so the 3D model cannot render.'
      );
      return;
    }

    await customElements.whenDefined('model-viewer');

    // Marked for styling only. Nothing is hidden until it arrives: `model-viewer` shows its own
    // poster while it loads, and a reveal that depended on this would strand the model invisible
    // wherever the observer above never gets to run.
    viewer.addEventListener('load', () => this.setAttribute('loaded', ''), { once: true });

    if (/** @type {any} */ (viewer).loaded) this.setAttribute('loaded', '');
  }

  /**
   * Brings in the bundled viewer.
   *
   * Only the Content > Files path needs it. `Shopify.loadFeatures('model-viewer-ui')` cannot cover
   * this: that bundle is the controls wrapper and does not define the element - Shopify ships the
   * element itself only to pages that render a model through `model_viewer_tag`, which a file that
   * is not attached to a product never reaches.
   *
   * @returns {Promise<boolean>} Whether the element is available afterwards.
   */
  async #loadViewerLibrary() {
    const src = this.dataset.viewerSrc;

    if (!src) return false;

    try {
      await import(src);
    } catch (error) {
      console.warn('[product-intro] Could not load the 3D viewer:', error);
      return false;
    }

    return Boolean(customElements.get('model-viewer'));
  }

  /**
   * Builds the element for a model that lives in Content > Files rather than on the product.
   *
   * @returns {HTMLElement | null}
   */
  #buildViewer() {
    const { src, alt, poster } = this.dataset;

    if (!src) return null;

    const viewer = document.createElement('model-viewer');

    viewer.className = 'product-intro__model-viewer';
    viewer.setAttribute('src', src);
    viewer.setAttribute('alt', alt ?? '');
    viewer.setAttribute('reveal', 'auto');
    if (poster) viewer.setAttribute('poster', poster);

    this.appendChild(viewer);

    return viewer;
  }

  /**
   * Writes the section's settings onto the viewer.
   *
   * `model_viewer_tag` takes no attributes of its own beyond its documented parameters, so the
   * rotation and lighting settings have to land here.
   *
   * @param {Element} viewer - The `<model-viewer>` element.
   */
  #applySettings(viewer) {
    const { shadow, exposure, autoRotate, allowRotation } = this.dataset;

    viewer.classList.add('product-intro__model-viewer');

    if (shadow) viewer.setAttribute('shadow-intensity', shadow);
    if (exposure) viewer.setAttribute('exposure', exposure);

    if (autoRotate) {
      viewer.setAttribute('auto-rotate', '');
      viewer.setAttribute('auto-rotate-delay', '0');
      viewer.setAttribute('rotation-per-second', `${autoRotate}deg`);
    }

    if (allowRotation !== undefined) {
      viewer.setAttribute('camera-controls', '');
      // Vertical swipes keep scrolling the page instead of orbiting the model.
      viewer.setAttribute('touch-action', 'pan-y');
      viewer.setAttribute('disable-zoom', '');
    }

    viewer.setAttribute('interaction-prompt', 'none');
  }
}

if (!customElements.get('product-intro-model')) {
  customElements.define('product-intro-model', ProductIntroModel);
}
