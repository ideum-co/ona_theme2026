import { Component } from '@theme/component';

/**
 * Switches which top level item's content the desktop mega menu shows.
 *
 * Opening and closing belong to the drawer's `<details>`, which wraps this element, so none of
 * that is repeated here.
 *
 * Pointer and keyboard focus both switch the panel, but a click is left alone: the top level
 * entries are real links and following them is the expected behaviour.
 *
 * @typedef {object} Refs
 * @property {HTMLAnchorElement[]} primaryLinks - The top level links.
 * @property {HTMLElement[]} contents - The panel shown for each of them.
 *
 * @extends Component<Refs>
 */
export class HeaderMegaMenu extends Component {
  requiredRefs = ['primaryLinks', 'contents'];

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener('pointerenter', this.#handleActivate, true);
    this.addEventListener('focusin', this.#handleActivate);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.removeEventListener('pointerenter', this.#handleActivate, true);
    this.removeEventListener('focusin', this.#handleActivate);
  }

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
