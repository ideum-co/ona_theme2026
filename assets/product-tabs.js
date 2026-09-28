import { Component } from '@theme/component';

/**
 * The product page's tab strip.
 *
 * Enhancement, not structure: the markup renders every panel visible, and this adds the tab
 * behaviour on connect by setting `enhanced` on the host. A page whose JS never arrives still
 * shows all of the content, stacked, instead of one panel and two dead labels.
 *
 * @typedef {object} Refs
 * @property {HTMLButtonElement[]} [tabs] - The labels in the strip.
 * @property {HTMLElement[]} [panels] - One per tab, in the same order.
 * @property {HTMLElement} [indicator] - The bar that marks the current tab.
 * @property {HTMLElement} [strip] - The scroll container the labels sit in.
 *
 * @extends Component<Refs>
 */
export class ProductTabs extends Component {
  #index = 0;
  /** @type {ResizeObserver | undefined} */
  #observer;

  connectedCallback() {
    super.connectedCallback();

    const { tabs, panels } = this.refs;

    // One label per panel or the pairing is guesswork; leave the stacked fallback in place.
    if (!tabs?.length || !panels?.length || tabs.length !== panels.length) return;

    this.setAttribute('enhanced', '');
    // Scrolled into view but not focused: a deep link into the third tab has to be visible in the
    // strip on a phone, while stealing focus on load would jump the page past the product.
    this.select(this.#initialIndex(), undefined, { focus: false });

    this.#observer = new ResizeObserver(() => this.#moveIndicator());
    if (this.refs.strip) this.#observer.observe(this.refs.strip);

    // The labels are set in a webfont, so their widths change under the indicator once it loads.
    document.fonts?.ready.then(() => this.#moveIndicator());

    document.addEventListener('shopify:block:select', this.#handleBlockSelect);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#observer?.disconnect();
    document.removeEventListener('shopify:block:select', this.#handleBlockSelect);
  }

  /**
   * Shows one tab.
   *
   * @param {number | string} input - Index of the tab to show.
   * @param {Event} [event]
   * @param {{focus?: boolean, scroll?: boolean}} [options]
   */
  select(input, event, options = {}) {
    const { focus = true, scroll = true } = options;
    const { tabs, panels } = this.refs;

    if (!tabs?.length || !panels?.length) return;

    const index = Math.min(Math.max(Number(input) || 0, 0), tabs.length - 1);

    this.#index = index;

    tabs.forEach((tab, i) => {
      const current = i === index;

      tab.setAttribute('aria-selected', String(current));
      // Roving tabindex: the strip is one tab stop and the arrows move within it.
      tab.tabIndex = current ? 0 : -1;
    });

    panels.forEach((panel, i) => {
      panel.hidden = i !== index;
    });

    if (focus) tabs[index]?.focus();
    if (scroll) this.#scrollTabIntoView(index);

    this.#moveIndicator();
  }

  /** @param {KeyboardEvent} event */
  handleKeyDown = (event) => {
    const tabs = this.refs.tabs;

    if (!tabs?.length) return;

    const last = tabs.length - 1;
    /** @type {Record<string, number>} */
    const moves = {
      ArrowRight: this.#index === last ? 0 : this.#index + 1,
      ArrowLeft: this.#index === 0 ? last : this.#index - 1,
      Home: 0,
      End: last,
    };

    const next = moves[event.key];

    if (next === undefined) return;

    event.preventDefault();
    this.select(next);
  };

  /**
   * Opens the tab a block belongs to when it is selected in the theme editor, so picking a block
   * that lives in a hidden panel does not select something nobody can see.
   *
   * @param {Event} event
   */
  #handleBlockSelect = (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement) || !this.contains(target)) return;

    const panel = target.closest('[role="tabpanel"]');
    const index = this.refs.panels?.findIndex((candidate) => candidate === panel) ?? -1;

    if (index >= 0) this.select(index, undefined, { focus: false });
  };

  /**
   * The tab to open on load: the one named in the URL fragment, so a link can point at the brew
   * guide, and otherwise the first.
   *
   * @returns {number}
   */
  #initialIndex() {
    const hash = window.location.hash.slice(1);

    if (!hash) return 0;

    const index = this.refs.panels?.findIndex((panel) => panel.id === hash) ?? -1;

    return index >= 0 ? index : 0;
  }

  #moveIndicator() {
    const { indicator, tabs, strip } = this.refs;
    const tab = tabs?.[this.#index];

    if (!indicator || !tab || !strip) return;

    // Offsets rather than bounding rects: the strip scrolls sideways on a phone, and a rect would
    // put the indicator where the tab happens to be on screen instead of where it is in the strip.
    this.style.setProperty('--product-tabs-indicator-offset', `${tab.offsetLeft}px`);
    this.style.setProperty('--product-tabs-indicator-width', `${tab.offsetWidth}px`);
  }

  /** @param {number} index */
  #scrollTabIntoView(index) {
    const { strip, tabs } = this.refs;
    const tab = tabs?.[index];

    if (!strip || !tab || strip.scrollWidth <= strip.clientWidth) return;

    strip.scrollTo({ left: tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2, behavior: 'smooth' });
  }
}

if (!customElements.get('product-tabs-component')) {
  customElements.define('product-tabs-component', ProductTabs);
}
