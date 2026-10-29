/**
 * Behaviour for the `purchase-options` control: keeping the chosen card marked, and folding the
 * delivery frequency a shopper picks into the radio that is actually submitted.
 *
 * This used to be an IIFE printed inside the snippet, once per instance, bound to the radios and
 * selects that existed when it ran. The card subscribe panel now replaces its purchase options
 * with server-rendered markup whenever the variant changes, and HTML inserted that way never runs
 * its scripts - so every control in a refreshed panel was left dead: picking a frequency would not
 * rewrite the radio, update the price, or move the selected state. Listening on the document
 * instead means markup that arrives later is already wired, with nothing to re-initialise.
 */

const ROOT_SELECTOR = '.purchase-options';
const CARD_SELECTOR = '.purchase-options__card';
const RADIO_SELECTOR = '.purchase-options__radio';
const SELECT_SELECTOR = '[data-plan-select]';

/**
 * Marks the card whose radio is checked and clears the rest.
 *
 * @param {Element} root - A `.purchase-options` element.
 */
export function syncCardState(root) {
  for (const radio of root.querySelectorAll(RADIO_SELECTOR)) {
    radio.closest(CARD_SELECTOR)?.classList.toggle('is-selected', /** @type {HTMLInputElement} */ (radio).checked);
  }
}

/**
 * Writes the frequency's price onto the card.
 *
 * @param {HTMLSelectElement} select - The frequency select.
 * @param {Element} card - The card the select belongs to.
 */
function showSelectedPrice(select, card) {
  const option = select.options[select.selectedIndex];
  const priceEl = card.querySelector('.purchase-options__price');

  if (!priceEl || !option) return;

  const price = option.getAttribute('data-price');

  if (price == null) return;

  const compareAt = option.getAttribute('data-compare-at');

  priceEl.innerHTML =
    compareAt && compareAt !== price ? `${price} <s class="purchase-options__compare-price">${compareAt}</s>` : price;
}

/**
 * @param {Event} event - A change event from anywhere in the document.
 */
function handleChange(event) {
  const target = event.target;

  if (!(target instanceof Element)) return;

  const root = target.closest(ROOT_SELECTOR);

  if (!root) return;

  if (target instanceof HTMLInputElement && target.matches(RADIO_SELECTOR)) {
    // The radio carries the plan id that will be posted. Where the group offers several
    // frequencies the shopper's choice lives on the select beside it, so adopt it the moment this
    // card becomes the chosen one - otherwise checking the card would post the frequency the
    // server happened to render first.
    if (target.checked) {
      const select = target.closest(CARD_SELECTOR)?.querySelector(SELECT_SELECTOR);

      if (select instanceof HTMLSelectElement) target.value = select.value;
    }

    syncCardState(root);
    return;
  }

  if (target instanceof HTMLSelectElement && target.matches(SELECT_SELECTOR)) {
    const card = target.closest(CARD_SELECTOR);

    if (!card) return;

    const radio = card.querySelector(RADIO_SELECTOR);

    if (radio instanceof HTMLInputElement) {
      radio.value = target.value;
      radio.checked = true;
    }

    showSelectedPrice(target, card);
    syncCardState(root);
  }
}

// Capture, not bubble. `variant-select.js` also listens for `change` on the document, to decide
// whether the variant now picked can be bought on the plan now checked - and it reads that plan
// off the radio's value, which the handler above is what rewrites. A bubble listener here would
// run after it on a frequency change and leave the gate judging the previous frequency. Capture
// runs from the document down, so this always lands first whatever order the modules load in.
document.addEventListener('change', handleChange, true);
