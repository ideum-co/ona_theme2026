import { DialogComponent, DialogOpenEvent } from '@theme/dialog';
import { StandardEvents } from '@shopify/events';

/**
 * A custom element that presents variant options as a modal list instead of inline buttons
 * or a native select.
 *
 * It runs in one of two modes, set through `data-mode`:
 *
 * - `option` - rendered by the `variant-picker` block, on the product page and inside product
 *   cards. The radios are the variant picker's own, so selecting one bubbles a `change` to
 *   `<variant-picker>` and the usual re-render takes over: price, media and the add to cart
 *   button all update themselves. The modal only has to get out of the way, so it closes.
 * - `cart` - rendered by `variant-select-modal` behind a card's quick add button, for cards that
 *   have no variant picker of their own. Self-contained: it lists every variant and owns an add
 *   to cart form, and selecting a variant points that form at the chosen id.
 *
 * @extends DialogComponent
 */
export class VariantSelectComponent extends DialogComponent {
  requiredRefs = ['dialog'];

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener('change', this.#handleChange);
    this.addEventListener(DialogOpenEvent.eventName, this.#revealSelectedOption);
    this.addEventListener(StandardEvents.cartLinesUpdate, this.#handleCartUpdate);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.removeEventListener('change', this.#handleChange);
    this.removeEventListener(DialogOpenEvent.eventName, this.#revealSelectedOption);
    this.removeEventListener(StandardEvents.cartLinesUpdate, this.#handleCartUpdate);
  }

  /** @returns {'option' | 'cart'} */
  get #mode() {
    return this.dataset.mode === 'cart' ? 'cart' : 'option';
  }

  /**
   * Handles a variant being picked in the list.
   *
   * @param {Event} event - The change event.
   */
  #handleChange = (event) => {
    const input = event.target;

    if (!(input instanceof HTMLInputElement) || input.type !== 'radio') return;

    // In `option` mode the variant picker re-renders this subtree, which would tear the open
    // dialog down mid-flight. Close first and let it take over.
    if (this.#mode === 'option') {
      this.closeDialog();
      return;
    }

    this.#pointFormAtVariant(input);
  };

  /**
   * Claims clicks that land inside the dialog.
   *
   * Without this, the nearest `on:click` ancestor of a click on the backdrop or the header is
   * `<product-card>` when the modal sits in a card, which arms the product page view transition
   * from inside a modal that is not navigating anywhere. There is nothing to do with the click
   * itself - resolving to this component is the whole point.
   */
  handleDialogClick() {}

  /**
   * Points the add to cart form at the selected variant and syncs the price and button state.
   *
   * @param {HTMLInputElement} input - The selected radio.
   */
  #pointFormAtVariant(input) {
    const unavailable = input.dataset.variantAvailable === 'false';
    const variantIdInput = this.#variantIdInput;

    if (variantIdInput) {
      variantIdInput.value = input.value;
      variantIdInput.disabled = unavailable;
    }

    const price = this.querySelector('.variant-select__price');
    if (price && input.dataset.variantPrice) price.textContent = input.dataset.variantPrice;

    const submitButton = this.querySelector('.variant-select__submit');
    if (submitButton instanceof HTMLButtonElement) submitButton.disabled = unavailable;
  }

  /**
   * The hidden input the add to cart form posts as the variant id.
   *
   * @returns {HTMLInputElement | null}
   */
  get #variantIdInput() {
    const productForm = /** @type {any} */ (this.querySelector('product-form-component'));
    const fromRefs = productForm?.refs?.variantId;

    if (fromRefs instanceof HTMLInputElement) return fromRefs;

    const fallback = this.querySelector('input[ref="variantId"]');
    return fallback instanceof HTMLInputElement ? fallback : null;
  }

  /**
   * Brings the selected option into view when the list is long enough to scroll.
   */
  #revealSelectedOption = () => {
    const checked = this.querySelector('.variant-select__input:checked');

    checked?.closest('.variant-select__option')?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  };

  /**
   * Closes the modal once the item actually lands in the cart.
   *
   * @param {import('@shopify/events').CartLinesUpdateEvent} event - The cart lines update event.
   */
  #handleCartUpdate = (event) => {
    event.promise
      ?.then(({ detail }) => {
        if (detail?.didError) return;
        this.closeDialog();
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[variant-select] Event promise rejected:', error);
      });
  };
}

if (!customElements.get('variant-select-component')) {
  customElements.define('variant-select-component', VariantSelectComponent);
}
