import { Component } from '@theme/component';
import { formatMoney } from '@theme/money-formatting';
import { StandardEvents } from '@shopify/events';

// Live, cart-aware cross-sell endpoint -- ona-smart-cart project
// (~/projects/ona-smart-cart), running on CT100 (pve-r720) behind a
// dedicated Cloudflare Tunnel. Aggregates scores across the WHOLE cart,
// unlike the static per-product metafield product-recommendations.js reads.
const RECOMMEND_ENDPOINT = 'https://ona-smart-cart-api.ideum.co/recommend';

// Every network call here has a hard budget. A slow or down third-party
// endpoint must never visibly delay or block the cart page.
const FETCH_TIMEOUT_MS = 1500;

class CartAwareRecommendations extends Component {
  connectedCallback() {
    super.connectedCallback();
    this.#load();
    document.addEventListener(StandardEvents.cartLinesUpdate, this.#handleCartUpdate);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener(StandardEvents.cartLinesUpdate, this.#handleCartUpdate);
  }

  /** @type {AbortController | null} */
  #activeLoad = null;

  /**
   * CartLinesUpdateEvent fires the moment a mutation is *requested*, not once
   * it lands -- `event.promise` resolves only after the server confirms the
   * change (see component-cart-items.js's deferredUpdatePromise). Reading
   * /cart.js before that resolves would read the pre-mutation cart.
   * @param {import('@shopify/events').CartLinesUpdateEvent} event
   */
  #handleCartUpdate = (event) => {
    event.promise
      ?.then(() => this.#load())
      .catch(() => {
        // A rejected mutation means the cart didn't actually change --
        // current recommendations are still valid, nothing to reload.
      });
  };

  async #load() {
    this.#activeLoad?.abort();
    const controller = new AbortController();
    this.#activeLoad = controller;

    try {
      const skus = await this.#getCartSkus(controller.signal);
      if (!skus.length) return this.#hide();

      const recommendations = await this.#fetchRecommendations(skus, controller.signal);
      if (!recommendations.length) return this.#hide();

      const products = await this.#fetchProductDetails(recommendations, controller.signal);
      if (!products.length) return this.#hide();

      this.#render(products);
    } catch (error) {
      // AbortError is expected whenever the cart changes again mid-fetch --
      // the newer #load() call already owns the UI, this one just stops.
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Cart-aware recommendations error:', error.message);
      }
      this.#hide();
    }
  }

  /**
   * @param {AbortSignal} signal
   * @returns {Promise<string[]>}
   */
  async #getCartSkus(signal) {
    const response = await fetch(`${window.Theme?.routes?.cart_url ?? '/cart'}.js`, { signal });
    if (!response.ok) return [];
    /** @type {{ items: { sku: string }[] }} */
    const cart = await response.json();
    return [...new Set((cart.items ?? []).map((item) => item.sku).filter(Boolean))];
  }

  /**
   * @param {string[]} skus
   * @param {AbortSignal} signal
   * @returns {Promise<{ product_code: string, title: string, handle: string, score: number }[]>}
   */
  async #fetchRecommendations(skus, signal) {
    const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    const combined = AbortSignal.any ? AbortSignal.any([signal, timeout]) : signal;

    const response = await fetch(RECOMMEND_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart: skus }),
      signal: combined,
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.recommendations) ? data.recommendations : [];
  }

  /**
   * Enriches each recommended handle with live image/price from Shopify's
   * own Ajax API -- the endpoint only returns the score graph's own data
   * (code/title/handle), never pricing or imagery, so this is always the
   * current storefront price, not a stale cached one.
   * @param {{ handle: string, title: string }[]} recommendations
   * @param {AbortSignal} signal
   */
  async #fetchProductDetails(recommendations, signal) {
    const results = await Promise.allSettled(
      recommendations.map(async (rec) => {
        const response = await fetch(`/products/${rec.handle}.js`, { signal });
        if (!response.ok) throw new Error(`${rec.handle}: ${response.status}`);
        return response.json();
      })
    );

    return results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => /** @type {PromiseFulfilledResult<any>} */ (result).value);
  }

  /** @param {any[]} products */
  #render(products) {
    const list = this.querySelector('.cart-aware-recommendations__list');
    if (!list) return;

    const format = this.dataset.moneyFormat || '{{amount}}';
    const currency = this.dataset.currency || '';

    list.replaceChildren(
      ...products.map((product) => {
        const item = document.createElement('li');
        item.className = 'cart-aware-recommendations__item resource-list__item';
        const image = product.featured_image || product.images?.[0];
        item.innerHTML = `
          <a href="${product.url}">
            ${image ? `<img src="${image}" alt="${this.#escape(product.title)}" loading="lazy" width="200" height="200" />` : ''}
            <p class="cart-aware-recommendations__item-title">${this.#escape(product.title)}</p>
            <p class="cart-aware-recommendations__item-price">${formatMoney(product.price, format, currency)}</p>
          </a>
        `;
        return item;
      })
    );

    this.classList.remove('hidden');
  }

  #hide() {
    this.classList.add('hidden');
  }

  /** @param {string} value */
  #escape(value) {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }
}

if (!customElements.get('cart-aware-recommendations')) {
  customElements.define('cart-aware-recommendations', CartAwareRecommendations);
}
