import { Component } from '@theme/component';

/**
 * Switches which top level item's content the desktop mega menu shows.
 *
 * Opening and closing belong to the drawer's `<details>`, which wraps this element, so none of
 * that is repeated here.
 *
 * Pointer and keyboard focus both switch the panel, but a click on a top level entry is left
 * alone: they are real links and following them is the expected behaviour.
 *
 * The one thing it does own is the summary's toggle, see `#handleSummaryClick`.
 *
 * @typedef {object} Refs
 * @property {HTMLAnchorElement[]} primaryLinks - The top level links.
 * @property {HTMLElement[]} contents - The panel shown for each of them.
 *
 * @extends Component<Refs>
 */
export class HeaderMegaMenu extends Component {
  requiredRefs = ['primaryLinks', 'contents'];

  /** @type {HTMLDetailsElement | null} */
  #details = null;

  /** @type {HTMLElement | null} */
  #summary = null;

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener('pointerenter', this.#handleActivate, true);
    this.addEventListener('focusin', this.#handleActivate);

    this.#details = this.closest('details');
    this.#summary = this.#details?.querySelector('summary') ?? null;
    this.#summary?.addEventListener('click', this.#handleSummaryClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.removeEventListener('pointerenter', this.#handleActivate, true);
    this.removeEventListener('focusin', this.#handleActivate);
    this.#summary?.removeEventListener('click', this.#handleSummaryClick);
  }

  /**
   * Takes over the summary's toggle on desktop.
   *
   * `component.js` delegates `on:click` from the document in the capture phase and never calls
   * `preventDefault`, so the summary's native toggle runs after `header-drawer.js` has decided what
   * to do. On closing, that routine removes `open` once the drawer's animations settle - and with
   * the drawer hidden on desktop there is nothing to settle, so it lands in a microtask, before the
   * native toggle, which then flips `open` straight back on. The panel is gone but the details is
   * open: scroll stays locked and the menu cannot be reopened.
   *
   * Suppressing the native toggle and setting `open` here keeps the attribute and the class in
   * step, whatever the animations do. Below 750px the drawer is what renders and the theme's own
   * behaviour is left untouched.
   *
   * @param {MouseEvent} event
   */
  #handleSummaryClick = (event) => {
    if (!this.#details || !window.matchMedia('(min-width: 750px)').matches) return;

    // The delegated handler has already run and read this same value to pick open or close.
    const opening = !this.#details.open;

    event.preventDefault();

    // Closing is left to `header-drawer.js`, which removes `open` when it has finished.
    if (opening) this.#details.open = true;
  };

  /** @param {Event} event */
  #handleActivate = (event) => {
    if (!(event.target instanceof Element)) return;

    const link = event.target.closest('[data-index]');

    if (!(link instanceof HTMLElement)) return;

    this.select(link.dataset.index);
  };

  /**
   * Shows the content for one top level item.
   *
   * @param {string | undefined} index - The item's index.
   */
  select(index) {
    if (index == null) return;

    const { primaryLinks, contents } = this.refs;

    for (const link of primaryLinks) {
      if (link.dataset.index === index) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }

    for (const content of contents) {
      content.toggleAttribute('hidden', content.dataset.index !== index);
    }
  }
}

if (!customElements.get('header-megamenu')) {
  customElements.define('header-megamenu', HeaderMegaMenu);
}
