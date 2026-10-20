const HTMLElementBase = globalThis.HTMLElement ?? class {};

/*
 * One-at-a-time slider for the ported `ona-*` sections.
 *
 * Several sections were ported as sliders -- a track with one `.slider-block`
 * per slide -- but without the stylesheet or script that drove them, so every
 * slide rendered at full size, one under the next. Measured on
 * /pages/wholesale: the testimonial section ran 1,988px with four episodes
 * stacked, and `supported` 1,688px with three.
 *
 * Progressive enhancement. The track flows normally and every slide is visible
 * until this element connects and adds `is-enhanced`; only then do the slides
 * stack into one grid cell with one shown. Without JavaScript the page is tall
 * but complete, which is the right way round -- a slider that hides its slides
 * before its script runs loses content on a slow connection.
 *
 * The buttons are built here rather than in Liquid so the tablist cannot drift
 * out of step with the slides, and labels come from each slide's
 * `data-slide-label` so the wording stays authored in the section.
 */
class OnaSlider extends HTMLElementBase {
  connectedCallback() {
    this.nav = this.querySelector('[data-slider-nav]');
    this.track = this.querySelector('[data-slider-track]');
    if (!this.nav || !this.track) return;

    this.addEventListener('click', this.#onClick);
    this.addEventListener('keydown', this.#onKeydown);
    this.refresh();

    if (globalThis.MutationObserver) {
      this.observer = new MutationObserver(() => this.refresh());
      this.observer.observe(this.track, { childList: true });
    }
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick);
    this.removeEventListener('keydown', this.#onKeydown);
    this.observer?.disconnect();
  }

  /** Rebuilds the tablist from whatever slides are in the track right now. */
  refresh() {
    this.slides = Array.from(this.track.querySelectorAll('[data-slider-slide]'));

    /*
     * One slide needs no controls, and zero means there is nothing to show.
     * Either way `is-enhanced` comes off, so no slide is ever left hidden
     * behind a control that is not there.
     */
    if (this.slides.length < 2) {
      this.classList.remove('is-enhanced');
      this.nav.replaceChildren();
      this.tabs = [];
      return;
    }

    const uid = this.dataset.uid ?? (this.dataset.uid = Math.random().toString(36).slice(2, 8));
    const tabs = this.slides.map((slide, i) => {
      const slideId = `OnaSlide-${uid}-${i + 1}`;
      const tabId = `OnaSlideTab-${uid}-${i + 1}`;
      slide.id = slideId;
      slide.setAttribute('role', 'tabpanel');
      slide.setAttribute('aria-labelledby', tabId);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ona-slider__tab';
      button.setAttribute('role', 'tab');
      button.id = tabId;
      button.setAttribute('aria-controls', slideId);
      button.textContent = slide.dataset.slideLabel?.trim() || String(i + 1);
      return button;
    });

    this.nav.replaceChildren(...tabs);
    this.tabs = tabs;
    this.classList.add('is-enhanced');
    this.select(Math.min(this.activeIndex ?? 0, tabs.length - 1));
  }

  #onClick = (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (!tab || !this.contains(tab)) return;
    this.select(this.tabs.indexOf(tab));
  };

  #onKeydown = (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (!tab || !this.contains(tab)) return;

    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    let next = null;
    if (step) next = (this.tabs.indexOf(tab) + step + this.tabs.length) % this.tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = this.tabs.length - 1;
    if (next === null) return;

    event.preventDefault();
    this.select(next);
    this.tabs[next].focus();
  };

  /**
   * Moves the selection. The visible slide, aria-selected and the roving
   * tabindex all change in the same pass -- splitting them is how a tablist
   * ends up announcing one slide while showing another.
   */
  select(index) {
    this.activeIndex = index;
    this.tabs.forEach((tab, i) => {
      const isActive = i === index;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.tabIndex = isActive ? 0 : -1;
    });
    this.slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === index);
    });
  }
}

if (globalThis.customElements && !customElements.get('ona-slider')) {
  customElements.define('ona-slider', OnaSlider);
}

export { OnaSlider };
