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

  /** @type {string | null} The last value the SERVER accepted. A failed write never lands here,
   *  so the next blur retries instead of assuming the note is saved. */
  #accepted = null;

  /** @type {string | null} The value of the write currently in flight, so an identical one does
   *  not queue up behind it. */
  #sending = null;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #release;

  /**
   * Holds the accelerated checkout buttons while a write is in flight, and lets them go after.
   *
   * `inert` rather than CSS alone: `pointer-events: none` suppresses pointer hit-testing and
   * nothing else, so a keyboard user could still tab to Shop Pay and press Enter on the stale
   * note. `inert` takes the subtree out of focus, activation and the accessibility tree; the
   * CSS beside the buttons in cart-summary.liquid is the visual half of the same state.
   *
   * They are found by selector because they are not inside <cart-note>: Shopify renders them
   * from `content_for_additional_checkout_buttons` further up cart-summary.liquid, so there is
   * no shared ancestor to scope this to. The flag goes on <html> for the same reason.
   *
   * @param {boolean} pending
   */
  #hold = (pending) => {
    clearTimeout(this.#release);
    document.documentElement.toggleAttribute('data-cart-note-pending', pending);
    for (const node of document.querySelectorAll('.additional-checkout-buttons')) {
      node.toggleAttribute('inert', pending);
    }
    /* A shopper must never be locked out of checkout by a background request. If the write has
       not settled in five seconds the network is already in trouble, and being unable to check
       out at all is the worse outcome of the two -- let them go. */
    if (pending) this.#release = setTimeout(() => this.#hold(false), 5000);
  };

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
    /* Only skip when the server already holds this exact value, or is being handed it right
       now. A write that failed leaves `#accepted` alone, so the next blur retries it. */
    if (note === this.#sending || (note === this.#accepted && this.#sending === null)) return;

    if (this.#activeFetch) {
      this.#activeFetch.abort();
    }

    const abortController = new AbortController();
    this.#activeFetch = abortController;
    this.#sending = note;

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

    this.#hold(true);

    try {
      const config = fetchConfig('json', {
        body: JSON.stringify({ note }),
      });

      const response = await fetch(Theme.routes.cart_update_url, {
        ...config,
        signal: abortController.signal,
      });

      const data = await response.json();

      /* Only now. Everything above can throw, and a value recorded as accepted before the
         server accepted it is a note the shopper believes is saved and is not. */
      if (this.#activeFetch === abortController) this.#accepted = note;

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
      /* A superseded write finishes after the one that replaced it started, so releasing
         unconditionally here would let the buttons go while the newer write is still out. */
      if (this.#activeFetch === abortController) {
        this.#activeFetch = null;
        this.#sending = null;
        this.#hold(false);
      }
      cartPerformance.measureFromEvent('note-update:user-action', event);
    }
  };
}

if (!customElements.get('cart-note')) {
  customElements.define('cart-note', CartNote);
}
