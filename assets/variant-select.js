import { AnchoredPopoverComponent } from '@theme/anchored-popover';
import { morph } from '@theme/morph';
import { StandardEvents } from '@shopify/events';

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

    // The plan controls are siblings of this element, not descendants, so their change events
    // never reach the listener above - and the gate below depends on which plan is checked as
    // much as on which variant is picked. Delegated from the document and filtered by form
    // ownership, which is the only relationship that actually ties them to this dropdown.
    if (this.dataset.subscriptionOnly === 'true') {
      document.addEventListener('change', this.#handlePlanChange);

      // The card carries its own variant picker beside this panel, and picking a size there is the
      // same decision as picking one in here. Without this the panel would keep the previous
      // size's plans while the rest of the card moved on.
      this.closest('product-card')?.addEventListener(StandardEvents.productSelect, this.#handleCardSelect);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    document.removeEventListener('change', this.#handlePlanChange);
    this.closest('product-card')?.removeEventListener(StandardEvents.productSelect, this.#handleCardSelect);
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

    this.#applySelection(input);
  };

  /**
   * Everything a picked variant has to change, whoever picked it.
   *
   * Shared with the card's own variant picker, so a size chosen out there goes through the same
   * label update, the same form pointer, the same allocation gate and the same plan refresh as one
   * chosen in this dropdown.
   *
   * @param {HTMLInputElement} input - The selected variant radio.
   */
  #applySelection(input) {
    const target = this.querySelector('.variant-select__trigger-value');

    if (target) {
      const optionTitle = input.closest('.variant-select__option')?.querySelector('.variant-select__option-title');
      target.textContent = (optionTitle?.textContent ?? input.value).trim();
    }

    if (this.dataset.mode === 'cart') this.#pointFormAtVariant(input);

    this.#refreshPlans(input);
  }

  /**
   * Follows the card's own variant picker.
   *
   * `product-form.js` deliberately leaves this panel's form alone - it would otherwise write the
   * new variant id in and enable the button while the panel still showed the previous size's
   * plans - so the panel is responsible for keeping up with the card itself.
   *
   * @param {import('@shopify/events').ProductSelectEvent} event
   */
  #handleCardSelect = (event) => {
    const card = this.closest('product-card');

    if (!card || !(event.target instanceof Element) || event.target.closest('product-card') !== card) return;

    // Held shut from the moment the card's picker moves, not from when the answer arrives: the
    // shopper can open Subscribe in between, and until then every plan on screen is the old size's.
    const panel = this.closest('subscribe-popover-component');

    if (panel) this.#setPlansPending(panel, true);

    event.promise
      .then(({ detail }) => {
        const variantId = detail?.resource?.id;
        const input = [...this.querySelectorAll('.variant-select__input')].find(
          (candidate) => candidate instanceof HTMLInputElement && candidate.value === String(variantId ?? '')
        );

        // A variant this dropdown does not list is not one it can follow. The pending state stays,
        // so the panel keeps refusing rather than offering the previous size's plans.
        if (!(input instanceof HTMLInputElement)) return;

        input.checked = true;
        this.#applySelection(input);
      })
      .catch((error) => {
        console.error(error);
      });
  };

  /**
   * Re-runs the gate when the shopper changes plan rather than variant.
   *
   * Picking a different delivery frequency rewrites the checked radio's value, so a pairing that
   * was allowed a moment ago can stop being allowed - and one that was blocked can become valid,
   * which would otherwise leave a dead button with no way back.
   *
   * @param {Event} event
   */
  #handlePlanChange = (event) => {
    const target = event.target;

    if (!this.#ownsPlanControl(target)) return;

    const variant = this.querySelector('.variant-select__input:checked');

    if (variant instanceof HTMLInputElement) this.#pointFormAtVariant(variant);
  };

  /**
   * Whether a changed control is one of this dropdown's own plan controls.
   *
   * Asked by form ownership rather than by position or class name: the radios reach their form
   * through a `form` attribute from outside it, and the frequency select is not form-associated
   * at all, so it is placed by the radio it belongs to.
   *
   * @param {EventTarget | null} target
   * @returns {boolean}
   */
  #ownsPlanControl(target) {
    const container = document.getElementById(this.dataset.formId ?? '');
    const formElement = container?.querySelector('form');

    if (!(formElement instanceof HTMLFormElement)) return false;

    if (target instanceof HTMLInputElement && target.name === 'selling_plan') {
      return target.form === formElement;
    }

    if (target instanceof HTMLSelectElement) {
      const radio = target.closest('label')?.querySelector('input[name="selling_plan"]');

      return radio instanceof HTMLInputElement && radio.form === formElement;
    }

    return false;
  }

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

    // Nothing in the theme carries this attribute today, so this is inert. Before wiring it onto
    // the subscribe panel's price to fix the staleness there, note that `variantPrice` is the
    // variant's ONE-TIME price: printed into a subscription-only panel it would show the wrong
    // number beside a Subscribe button, which is the class of defect this panel was fixed for.
    const price = form.querySelector('[data-variant-select-price]');

    if (price && input.dataset.variantPrice) price.textContent = input.dataset.variantPrice;

    const submit = form.querySelector('button[type="submit"]');

    // Pending is part of the gate, not a one-off write when the request starts. Every path that
    // re-evaluates the button runs through here - including `#handlePlanChange`, which a keyboard
    // user reaches while the panel is pending because `pointer-events: none` stops pointers and
    // nothing else. Without this term, changing a focused frequency mid-flight re-enabled the
    // button whenever the new variant happened to share the checked plan id, and the previous
    // size's price and frequency could be submitted.
    if (submit instanceof HTMLButtonElement) {
      submit.disabled = unavailable || this.#plansPending() || this.#missingPlanFor(input, form);
    }
  }

  /**
   * Whether this panel is still waiting to be told what the picked variant can be bought on.
   *
   * @returns {boolean}
   */
  #plansPending() {
    return this.closest('subscribe-popover-component')?.hasAttribute('data-plans-pending') ?? false;
  }

  /**
   * Whether a subscription-only form would post something that is not a subscription.
   *
   * The subscribe panel renders its plan radios for one variant - whichever was current when the
   * section rendered - and, as the comment above says, nothing re-renders them when this dropdown
   * moves. So the plan on offer can stop matching the variant being bought. Three states all end
   * at an order with no subscription on it, or none that Shopify will accept:
   *
   *   - the rendered variant had no allocation, so there are no plan radios at all to check;
   *   - nothing is checked, so no plan would be posted;
   *   - a plan is checked, but the variant now picked has no allocation for that particular plan -
   *     which is not the same as having no allocations, and is why this compares ids rather than
   *     asking whether the variant subscribes at all.
   *
   * The first two put a full-price one-off in the cart under a button that says Subscribe, which
   * is the shape a live order already arrived in. The third posts a pairing the cart will not
   * take. So all three keep the button shut.
   *
   * Only subscription-only forms are gated. On the product page no plan checked is the one-time
   * purchase, which is a legitimate thing to buy.
   *
   * @param {HTMLInputElement} input - The selected variant radio.
   * @param {Element} form - The `product-form-component` this dropdown points at.
   * @returns {boolean}
   */
  #missingPlanFor(input, form) {
    if (this.dataset.subscriptionOnly !== 'true') return false;

    const formElement = form.querySelector('form');

    if (!(formElement instanceof HTMLFormElement)) return true;

    // Walked rather than read through `elements.namedItem`, which hands back a `RadioNodeList`
    // only when two or more controls share the name and the element itself when just one does -
    // and a lone element reports its `value` whether or not it is checked. One selling plan group
    // is the common shape here, so that is the case it would get wrong.
    const checked = [...formElement.elements].find(
      (element) =>
        element instanceof HTMLInputElement && element.name === 'selling_plan' && element.checked && element.value
    );

    if (!checked) return true;

    const allocated = (input.dataset.variantPlans ?? '').split(',').filter(Boolean);

    return !allocated.includes(checked.value);
  }

  /**
   * Replaces the panel's purchase options with the ones the server renders for the picked variant.
   *
   * Which plans a variant can be bought on is a Liquid question - `selling_plan_allocations` is
   * held per variant, and on this store every subscribable product answers it differently per
   * size: not one of the six shares a plan id between its variants. The panel used to render for
   * whichever variant was current when the card rendered and then stay as it was, so moving the
   * dropdown left the frequencies, prices and plan ids of the previous size on screen. Asking the
   * server for the new size is the same answer the product page gives, rather than a second copy
   * of the rule in JavaScript.
   *
   * Only for a subscribe panel in a card. The product page re-renders its own section on a variant
   * change and would get a redundant request, and a dropdown that is not subscription-only has
   * nothing to refresh.
   *
   * @param {HTMLInputElement} input - The selected variant radio.
   */
  #refreshPlans(input) {
    if (this.dataset.subscriptionOnly !== 'true') return;

    const panel = this.closest('subscribe-popover-component');
    const current = panel?.querySelector('.purchase-options');
    const productUrl = this.dataset.productUrl;

    if (!panel || !current || !productUrl || !input.value) return;

    // Everything on screen belongs to the variant being replaced, so nothing may be bought until
    // the answer arrives. `#missingPlanFor` would catch most of it - the checked plan usually is
    // not allocated to the new variant - but a plan the two sizes happened to share would slip
    // through, and a shopper who submits mid-flight should not be racing the panel either way.
    this.#setPlansPending(panel, true);

    this.#plansController?.abort();
    this.#plansController = new AbortController();

    const { signal } = this.#plansController;
    const url = `${productUrl.split('?')[0]}?section_id=section-rendering-subscribe-panel&variant=${encodeURIComponent(
      input.value
    )}`;

    fetch(url, { signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Subscribe panel render failed: ${response.status}`);

        return response.text();
      })
      .then((text) => {
        // A response that lost the race must not touch the panel: the controller it was started
        // with has been replaced, so its result describes a variant the shopper has moved on from.
        if (signal.aborted) return;

        const incoming = new DOMParser().parseFromString(text, 'text/html').querySelector('.purchase-options');

        if (!incoming) throw new Error('Subscribe panel render carried no purchase options');

        if (!this.#adoptPanelIds(current, incoming)) {
          throw new Error('Subscribe panel has no form to point the fetched plans at');
        }

        this.#morphPreservingFocus(current, incoming);
        this.#setPlansPending(panel, false);

        // The server preselects a plan this variant really is allocated, so the gate should now
        // open the button - but it is the gate that decides, not this assumption.
        this.#pointFormAtVariant(input);
      })
      .catch((error) => {
        if (signal.aborted) return;

        // Pending is deliberately left set. The panel on screen does not describe the picked
        // variant, so there is nothing here it is safe to buy - and clearing it would fall back on
        // `#missingPlanFor` alone, which lets a plan the two sizes happen to share through beside
        // the wrong price. The next variant change retries. Re-run the gate so the button is shut
        // now rather than at the next event.
        this.#pointFormAtVariant(input);
        console.error(error);
      });
  }

  /** @type {AbortController | undefined} */
  #plansController;

  /**
   * Marks the panel as waiting and keeps the submit shut while it is.
   *
   * @param {Element} panel - The `subscribe-popover-component`.
   * @param {boolean} pending - Whether a render is in flight.
   */
  #setPlansPending(panel, pending) {
    panel.toggleAttribute('data-plans-pending', pending);

    const form = document.getElementById(this.dataset.formId ?? '');
    const submit = form?.querySelector('button[type="submit"]');

    if (submit instanceof HTMLButtonElement && pending) submit.disabled = true;
  }

  /**
   * Copies the live panel's own identifiers onto the fetched markup.
   *
   * The Section Rendering API cannot be told the calling block's id, so the section renders
   * placeholders. `form` is what reaches the add to cart form from outside it, and markup left
   * carrying the placeholder would belong to no form at all: nothing would be posted, and the gate
   * would read no checked plan and hold the button shut.
   *
   * The form is resolved through the `product-form-component` this dropdown already points at,
   * never from the markup being replaced. A variant with no allocations renders no radios and so
   * no `[form]` element anywhere in the panel, so reading it from there would come back empty the
   * next time the shopper picked a size that does subscribe - and, the panel having no `[form]`
   * left to read, would stay empty for every change after it. The button would be shut for good on
   * a variant whose plans were on screen.
   *
   * Written before the morph, so the two trees agree and the panel is never briefly pointed at a
   * form that does not exist.
   *
   * @param {Element} current - The purchase options on screen.
   * @param {Element} incoming - The purchase options just fetched.
   * @returns {boolean} Whether the fetched markup can be trusted to belong to this panel.
   */
  #adoptPanelIds(current, incoming) {
    const uniqueId = current.getAttribute('data-purchase-options-id');

    if (uniqueId != null) incoming.setAttribute('data-purchase-options-id', uniqueId);

    // `getAttribute('id')`, never `.id`. Every Shopify product form carries an `<input name="id">`
    // for the variant, and a form's named controls shadow its own properties - so `form.id` hands
    // back that input element, not the string. Stringified into the `form` attribute it becomes
    // "[object HTMLInputElement]", the radios belong to no form at all, nothing is posted, and the
    // gate reads no checked plan and shuts the button for good. Measured on the preview theme.
    const formId = document.getElementById(this.dataset.formId ?? '')?.querySelector('form')?.getAttribute('id');

    // Without it the radios would be owned by the placeholder. Better to keep the stale panel and
    // let the gate refuse than to show plans that cannot be submitted.
    if (!formId) return false;

    for (const element of incoming.querySelectorAll('[form]')) element.setAttribute('form', formId);

    return true;
  }

  /**
   * Morphs the new purchase options in, putting focus back where the shopper left it.
   *
   * Morphing keeps matching nodes in place, so focus usually survives on its own - but the number
   * of plan cards changes with the variant, and a shopper who was inside the control when the list
   * shortened would otherwise be dropped onto `<body>` mid-task.
   *
   * @param {Element} current - The purchase options on screen.
   * @param {Element} incoming - The purchase options just fetched.
   */
  #morphPreservingFocus(current, incoming) {
    const active = document.activeElement;
    const hadFocus = active instanceof HTMLElement && current.contains(active);
    const focusSelector = hadFocus ? (active.matches('[data-plan-select]') ? '[data-plan-select]' : '.purchase-options__radio') : null;

    morph(current, incoming);

    if (!focusSelector) return;

    if (document.activeElement !== document.body && current.contains(document.activeElement)) return;

    const checked = current.querySelector('.purchase-options__radio:checked');
    const fallback = checked?.closest('.purchase-options__card')?.querySelector(focusSelector) ?? current.querySelector(focusSelector);

    if (fallback instanceof HTMLElement) fallback.focus();
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
