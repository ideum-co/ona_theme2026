import { Component } from '@theme/component';

/**
 * Brings up the 3D model in the product introduction section.
 *
 * The product media gallery defers its models behind a poster and a play button, because a gallery
 * can hold several and they are heavy. Here the model *is* the section's centrepiece, so it loads
 * on its own - but only once it is close to the viewport, so a model further down the page never
 * competes with the hero for bandwidth.
 *
 * `<model-viewer>` handles the rest natively: `auto-rotate`, `rotation-per-second` and
 * `camera-controls` are its own attributes, written straight from the section's settings.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} viewer - The `<model-viewer>` element.
 *
 * @extends Component<Refs>
 */
export class ProductIntroModel extends Component {
  requiredRefs = ['viewer'];

  /** @type {IntersectionObserver | undefined} */
  #observer;

  connectedCallback() {
    super.connectedCallback();

    // `rootMargin` gives the model a head start, so it is usually ready by the time it is on screen.
    this.#observer = new IntersectionObserver(this.#handleIntersect, { rootMargin: '400px' });
    this.#observer.observe(this);

    this.refs.viewer.addEventListener('load', this.#handleLoad, { once: true });
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

  /**
   * Asks Shopify for the `<model-viewer>` element.
   *
   * Loading it through `Shopify.loadFeatures` rather than a CDN tag keeps the request on a domain
   * the storefront already allows, and matches how the product gallery does it. Without the
   * storefront helper the tag stays an unknown element and the poster is what shows, which is why
   * the markup carries one.
   */
  #load() {
    const shopify = /** @type {any} */ (window).Shopify;

    if (typeof shopify?.loadFeatures !== 'function') return;

    shopify.loadFeatures([{ name: 'model-viewer-ui', version: '1.0' }]);
  }

  #handleLoad = () => {
    this.setAttribute('loaded', '');
  };
}

if (!customElements.get('product-intro-model')) {
  customElements.define('product-intro-model', ProductIntroModel);
}
