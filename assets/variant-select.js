import { AnchoredPopoverComponent } from '@theme/anchored-popover';

/**
 * A custom element that presents a product option as an anchored dropdown panel instead of a
 * native select or a row of buttons: every value gets its variant image, its availability and a
 * radio.
 *
 * Rendered by the `variant-picker` block in its `custom_dropdown` style, on the product page and
 * inside product cards. The radios are the variant picker's own, so selecting one bubbles a
 * `change` up to `<variant-picker>` and the usual re-render takes over - price, media and the add
 * to cart button all update themselves. This component only has to close the panel afterwards,
 * because that re-render replaces the markup underneath it.
 *
 * Open and close are handled natively through `popovertarget`; `AnchoredPopoverComponent` supplies
 * the anchor position for browsers without CSS anchor positioning.
 *
 * @extends AnchoredPopoverComponent
 */
export class VariantSelectComponent extends AnchoredPopoverComponent {
  connectedCallback() {
    super.connectedCallback();

    this.addEventListener('click', this.#handleOptionClick);
    this.addEventListener('change', this.#showSelectedValue);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.removeEventListener('click', this.#handleOptionClick);
    this.removeEventListener('change', this.#showSelectedValue);
  }

  /**
   * Writes the picked value onto the trigger.
   *
   * The trigger label is server-rendered, so on the product page the re-render brings it back
   * updated on its own. Inside a product card it does not: `VariantPicker#updateVariantPicker`
   * skips the morph when the card and the product page are configured with different variant
   * styles, which is what keeps the card from turning into the product page's buttons. Price,
   * media and availability are handled by `product-card.js` straight off the fetched HTML, so
   * this label was the one thing left showing a stale value - and on a card with no price block
   * it is the only feedback there is.
   *
   * Doing it here also means the trigger updates on the spot instead of waiting for the fetch.
   *
   * @param {Event} event - The change event.
   */
  #showSelectedValue = (event) => {
    const input = event.target;

    if (!(input instanceof HTMLInputElement) || input.type !== 'radio') return;

    const target = this.querySelector('.variant-select__trigger-value');

    if (target) {
      const optionTitle = input.closest('.variant-select__option')?.querySelector('.variant-select__option-title');
      target.textContent = (optionTitle?.textContent ?? input.value).trim();
    }

    if (this.dataset.mode === 'cart') this.#pointFormAtVariant(input);
  };

  /**
   * Points a standalone add to cart form at the picked variant.
   *
   * Only used by `variant-select-dropdown`, where the dropdown is not inside a `<variant-picker>`
   * and so nothing re-renders the section: the form has to be updated here. The form lives outside
   * this element - the radios must stay out of it so they are not posted to /cart/add - so it is
   * addressed by id.
   *
   * @param {HTMLInputElement} input - The selected radio.
   */
  #pointFormAtVariant(input) {
    const formId = this.dataset.formId;

    if (!formId) return;

    const form = /** @type {any} */ (document.getElementById(formId));

    if (!form) return;

    const unavailable = input.dataset.variantAvailable === 'false';
    const variantIdInput =
      form.refs?.variantId instanceof HTMLInputElement
        ? form.refs.variantId
        : form.querySelector('input[ref="variantId"]');

    if (variantIdInput instanceof HTMLInputElement) {
      variantIdInput.value = input.value;
      variantIdInput.disabled = unavailable;
    }

    const price = form.querySelector('[data-variant-select-price]');

    if (price && input.dataset.variantPrice) price.textContent = input.dataset.variantPrice;

    const submit = form.querySelector('button[type="submit"]');

    if (submit instanceof HTMLButtonElement) submit.disabled = unavailable;
  }

  /**
   * Closes the panel once a value is picked.
   *
   * This listens for `click` rather than `change` on purpose. Arrow keys move between radios and
   * fire `change`, so closing on `change` would shut the panel the moment a keyboard user started
   * moving through the list, leaving them able to reach only the neighbouring value. A click -
   * pointer or Space on a focused radio - is a deliberate pick, so that is what closes it.
   *
   * @param {MouseEvent} event - The click event.
   */
  #handleOptionClick = (event) => {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest('.variant-select__option')) return;

    const { popover, trigger } = this.refs;

    if (!popover.matches(':popover-open')) return;

    popover.hidePopover();
    trigger.focus();
  };

  /**
   * Claims clicks that land inside the panel.
   *
   * Without this, the nearest `on:click` ancestor of a click on the panel's own chrome is
   * `<product-card>` when the dropdown sits in a card, which arms the product page view
   * transition from a panel that is not navigating anywhere. There is nothing to do with the
   * click itself - resolving to this component is the whole point.
   */
  handlePanelClick() {}
}

if (!customElements.get('variant-select-component')) {
  customElements.define('variant-select-component', VariantSelectComponent);
}
