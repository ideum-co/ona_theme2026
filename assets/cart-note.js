import { Component } from '@theme/component';
import { debounce, fetchConfig } from '@theme/utilities';
import { cartPerformance } from '@theme/performance';
import { CartErrorEvent, CartNoteUpdateEvent } from '@shopify/events';

const PENDING = 'data-cart-note-pending';
const UNSAVED = 'data-cart-note-unsaved';

/**
 * Whether a note write is in flight. The flag lives on <html> because the accelerated checkout
 * buttons are rendered outside <cart-note>, so nothing closer reaches both.
 */
const noteIsPending = () => document.documentElement.hasAttribute(PENDING);

/**
 * Whether a write has failed and the server does not hold what the shopper typed. Separate from
 * PENDING because the two need opposite treatment: in flight means wait, unsaved means retry.
 */
const noteIsUnsaved = () => document.documentElement.hasAttribute(UNSAVED);

/** Every mounted <cart-note>, so the document listener can reach one without a shared ancestor. */
const notes = new Set();

/** The flag is on <html> and the state is per instance, so it is recomputed, never toggled. */
const refreshUnsaved = () => {
  document.documentElement.toggleAttribute(UNSAVED, [...notes].some((note) => note.noteUnsaved));
};

/*
 * The hold, as something a cart morph cannot undo.
 *
 * `inert` is set at runtime on markup Shopify renders, and `assets/morph.js` reconciles
 * attributes against the server's copy -- so another cart mutation finishing mid-write (a
 * quantity change right after the shopper leaves the textarea) strips it, and the buttons go
 * back to being keyboard-activatable while the note is still in flight. This listener is on
 * the document, which no morph reaches, and it reads the same flag the CSS reads, so the
 * three halves of the hold cannot drift apart. It also puts `inert` back, since a morph that
 * removed it has just told us it is gone.
 *
 * Module scope, so it registers once however many carts are on the page.
 */
for (const type of ['click', 'keydown']) {
  document.addEventListener(
    type,
    (event) => {
      const pending = noteIsPending();
      if (!pending && !noteIsUnsaved()) return;
      const held = event.target instanceof Element ? event.target.closest('.additional-checkout-buttons') : null;
      if (!held) return;
      if (type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;

      if (pending) {
        event.preventDefault();
        event.stopPropagation();
        held.toggleAttribute('inert', true);
        return;
      }

      /* Not in flight, but the server does not hold what the shopper typed: the last write
         failed. The blur that would have retried it has already happened -- focus left the
         textarea on the first checkout attempt -- so this click is the only thing left that
         can.
         
         Cancel the activation ONLY when a retry is actually going to run. The retry is capped
         at one per value, so once it is spent `retryOnce` does nothing -- and cancelling
         anyway would leave Shop Pay permanently dead, which is far worse than checking out
         with a stale note. The failed write already raised a CartErrorEvent, so the shopper
         was told. */
      const retrying = [...notes].filter((note) => note.canRetryNote());
      if (retrying.length === 0) return;

      event.preventDefault();
      event.stopPropagation();
      for (const note of retrying) note.retryOnce();
    },
    { capture: true }
  );
}

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

  /** @type {boolean} Set when a write fails, cleared when one lands. */
  #unsaved = false;

  /** @type {string | null} The value already retried from a checkout attempt, so a note that
   *  keeps failing costs one retry rather than blocking checkout on every click. */
  #retried = null;

  get noteUnsaved() {
    return this.#unsaved;
  }

  connectedCallback() {
    super.connectedCallback();
    notes.add(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    notes.delete(this);
    /* A drawer closing must not leave the document flagged by a note that is gone. */
    refreshUnsaved();
  }

  /**
   * Whether a retry would actually do something. The document listener asks before cancelling
   * an activation, so a spent retry cannot leave the checkout buttons dead.
   */
  canRetryNote = () => {
    const textarea = this.querySelector('textarea');
    if (!(textarea instanceof HTMLTextAreaElement)) return false;
    return this.#unsaved && textarea.value !== this.#accepted && textarea.value !== this.#retried;
  };

  /**
   * Retries a failed write from the checkout attempt that found it, at most once per value.
   * Editing the note again makes it retryable again, which is the behaviour a shopper expects.
   */
  retryOnce = () => {
    if (!this.canRetryNote()) return;
    const textarea = this.querySelector('textarea');
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    this.#retried = textarea.value;
    this.#write(textarea, new Event('cart-note-retry'));
  };

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
   * no shared ancestor to scope this to. The flag goes on <html> for the same reason -- and
   * because a cart morph can strip `inert` off Shopify's markup, the document listener above
   * is what actually holds the buttons. This is the half that keeps them out of the tab order
   * and the accessibility tree while it survives.
   *
   * @param {boolean} pending
   */
  #hold = (pending) => {
    clearTimeout(this.#release);
    document.documentElement.toggleAttribute(PENDING, pending);
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
  updateCartNote = debounce((event) => this.#write(event.target, event), 200);

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
    this.#write(event.target, event);
  };

  /**
   * The textarea is passed separately from the event because a retry has no user event behind
   * it -- the click it rides on belongs to the checkout button, not to the note.
   *
   * @param {EventTarget | null} textarea
   * @param {Event} event
   */
  #write = async (textarea, event) => {
    if (!(textarea instanceof HTMLTextAreaElement)) return;

    const note = textarea.value;
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

      /* A 429 or a 5xx with a JSON body resolves both the fetch and `response.json()`, so
         without this the note would be recorded as accepted on a request Shopify rejected --
         and the shopper would then skip every retry and leave with the old note. */
      if (!response.ok) throw new Error(`Cart note update rejected with ${response.status}`);

      const data = await response.json();

      /* Only now. Everything above can throw, and a value recorded as accepted before the
         server accepted it is a note the shopper believes is saved and is not. */
      if (this.#activeFetch === abortController) {
        this.#accepted = note;
        this.#unsaved = false;
        this.#retried = null;
        refreshUnsaved();
      }

      deferredPromise.resolve({ cart: CartNoteUpdateEvent.createCartFromAjaxResponse(data) });
    } catch (error) {
      deferredPromise.reject(error);
      // Don't dispatch error for user-triggered aborts
      if (error instanceof Error && error.name !== 'AbortError') {
        /* The server does not hold what the shopper typed, and focus has already left the
           textarea, so no further blur will retry it. The flag is what lets the next checkout
           attempt find that out. */
        this.#unsaved = true;
        refreshUnsaved();
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
