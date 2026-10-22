import { Component } from '@theme/component';
import { debounce, fetchConfig } from '@theme/utilities';
import { cartPerformance } from '@theme/performance';
import { CartErrorEvent, CartNoteUpdateEvent } from '@shopify/events';

/**
 * A custom element that displays a cart note.
 */
class CartNote extends Component {
  /** @type {AbortController | null} */
  #activeFetch = null;

  /** @type {string | null} The last value handed to the server, so a blur after no change is free. */
  #lastWritten = null;

  /** @type {number} In-flight writes. While above zero the accelerated buttons are held back. */
  #inFlight = 0;

  /**
   * Handles updates to the cart note as the shopper types. Debounced path. The flush path below shares #write so the two cannot drift.
   * @param {InputEvent} event
   */
  updateCartNote = debounce((event) => this.#write(event), 200);

  /**
   * Writes the note immediately, cancelling any debounced write still waiting.
   *
   * The note is only on the server once #write's fetch resolves, and the accelerated checkout
   * buttons are rendered outside `cart-form` with no `form` attribute, so that path does not
   * submit the textarea -- it leaves with whatever note the server already had. Typing a grind
   * request and going straight to Shop Pay would lose it. Blur fires before the tap completes,
   * which closes the 200 ms debounce window; #write's pending flag closes the rest.
   * @param {Event} event
   */
  flushCartNote = (event) => {
    this.updateCartNote.cancel();
    this.#write(event);
  };

  /**
   * @param {Event} event
   */
  #write = async (event) => {
    if (!(event.target instanceof HTMLTextAreaElement)) return;

    const note = event.target.value;
    if (note === this.#lastWritten) return;
    this.#lastWritten = note;

    if (this.#activeFetch) {
      this.#activeFetch.abort();
    }

    const abortController = new AbortController();
    this.#activeFetch = abortController;

    // Dispatch the cart note update event before the fetch with a promise for the result
    const isDialog = Boolean(this.closest('dialog'));
    const deferredPromise = CartNoteUpdateEvent.createPromise();

    this.dispatchEvent(
      new CartNoteUpdateEvent({
        context: isDialog ? 'dialog' : 'cart',
        note,
        promise: deferredPromise.promise,
      })
    );

    /* Held on the root element rather than on this one: the accelerated buttons live outside
       <cart-note>, further up in cart-summary.liquid, so no shared ancestor selector reaches
       both. The CSS that reads it is in cart-summary.liquid beside those buttons. */
    this.#inFlight += 1;
    document.documentElement.setAttribute('data-cart-note-pending', '');

    try {
      const config = fetchConfig('json', {
        body: JSON.stringify({ note }),
      });

      const response = await fetch(Theme.routes.cart_update_url, {
        ...config,
        signal: abortController.signal,
      });

      const data = await response.json();

      deferredPromise.resolve({ cart: CartNoteUpdateEvent.createCartFromAjaxResponse(data) });
    } catch (error) {
      deferredPromise.reject(error);
      // Don't dispatch error for user-triggered aborts
      if (error instanceof Error && error.name !== 'AbortError') {
        this.dispatchEvent(
          new CartErrorEvent({
            error: error.message || 'Failed to update cart note',
            code: 'SERVICE_UNAVAILABLE',
          })
        );
      }
    } finally {
      this.#activeFetch = null;
      this.#inFlight -= 1;
      if (this.#inFlight <= 0) {
        this.#inFlight = 0;
        document.documentElement.removeAttribute('data-cart-note-pending');
      }
      cartPerformance.measureFromEvent('note-update:user-action', event);
    }
  };
}

if (!customElements.get('cart-note')) {
  customElements.define('cart-note', CartNote);
}
