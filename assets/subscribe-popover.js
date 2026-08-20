import { Component } from '@theme/component';
import { StandardEvents } from '@shopify/events';

/**
 * The subscribe panel on a product card.
 *
 * It deliberately does not use the popover API. A popover is promoted to the top layer, which
 * escapes the card's `overflow: hidden` - in a carousel or a grid the panel ended up lying across
 * the next card. Positioning it absolutely inside the card means the card clips it, so it can only
 * ever cover its own product.
 *
 * The cost is that light dismiss, Escape and focus handling are no longer free, so they are
 * implemented here.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} panel - The panel element.
 * @property {HTMLButtonElement} trigger - The button that opens it.
 *
 * @extends Component<Refs>
 */
export class SubscribePopoverComponent extends Component {
  requiredRefs = ['panel', 'trigger'];

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener(StandardEvents.cartLinesUpdate, this.#handleCartUpdate);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#stopListening();
    this.removeEventListener(StandardEvents.cartLinesUpdate, this.#handleCartUpdate);
  }

  get open() {
    return this.hasAttribute('open');
  }

  /** Opens or closes the panel. */
  toggle = () => {
    if (this.open) this.close();
    else this.#open();
  };

  #open() {
    this.setAttribute('open', '');
    this.refs.trigger.setAttribute('aria-expanded', 'true');

    // Deferred so the click that opened the panel does not immediately close it again.
    requestAnimationFrame(() => {
      document.addEventListener('click', this.#handleDocumentClick);
      document.addEventListener('keydown', this.#handleKeyDown);
    });
  }

  /** Closes the panel. */
  close = () => {
    if (!this.open) return;

    this.removeAttribute('open');
    this.refs.trigger.setAttribute('aria-expanded', 'false');
    this.#stopListening();
  };

  #stopListening() {
    document.removeEventListener('click', this.#handleDocumentClick);
    document.removeEventListener('keydown', this.#handleKeyDown);
  }

  /** @param {MouseEvent} event */
  #handleDocumentClick = (event) => {
    if (event.target instanceof Node && this.contains(event.target)) return;

    this.close();
  };

  /** @param {KeyboardEvent} event */
  #handleKeyDown = (event) => {
    if (event.key !== 'Escape') return;

    event.preventDefault();
    this.close();
    this.refs.trigger.focus();
  };

  /**
   * Closes the panel once the item actually reaches the cart, so it does not sit open behind the
   * cart drawer.
   *
   * @param {import('@shopify/events').CartLinesUpdateEvent} event - The cart lines update event.
   */
  #handleCartUpdate = (event) => {
    event.promise
      ?.then(({ detail }) => {
        if (!detail?.didError) this.close();
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[subscribe-popover] Event promise rejected:', error);
      });
  };

  /**
   * Claims clicks inside the panel so they do not resolve to `<product-card on:click>`, which
   * would arm the product page view transition from a panel that is not navigating anywhere.
   */
  handlePanelClick() {}
}

if (!customElements.get('subscribe-popover-component')) {
  customElements.define('subscribe-popover-component', SubscribePopoverComponent);
}
