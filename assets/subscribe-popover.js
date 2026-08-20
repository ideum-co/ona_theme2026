import { AnchoredPopoverComponent } from '@theme/anchored-popover';
import { StandardEvents } from '@shopify/events';

/**
 * The subscribe panel on a product card.
 *
 * Opening and closing are handled natively through `popovertarget`; this only adds the two things
 * the platform does not do on its own: the anchor position for browsers without CSS anchor
 * positioning, which comes from `AnchoredPopoverComponent`, and closing the panel once the item
 * actually reaches the cart - otherwise it would sit open behind the cart drawer.
 *
 * @extends AnchoredPopoverComponent
 */
export class SubscribePopoverComponent extends AnchoredPopoverComponent {
  connectedCallback() {
    super.connectedCallback();

    this.addEventListener(StandardEvents.cartLinesUpdate, this.#handleCartUpdate);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.removeEventListener(StandardEvents.cartLinesUpdate, this.#handleCartUpdate);
  }

  /**
   * @param {import('@shopify/events').CartLinesUpdateEvent} event - The cart lines update event.
   */
  #handleCartUpdate = (event) => {
    event.promise
      ?.then(({ detail }) => {
        if (detail?.didError) return;

        const { popover } = this.refs;

        if (popover.matches(':popover-open')) popover.hidePopover();
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
