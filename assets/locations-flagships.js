const HTMLElementBase = globalThis.HTMLElement ?? class {};
const SCROLL_SYNC_DELAY_MS = 50;
const PROGRAMMATIC_SCROLL_SETTLE_MS = 150;

export function approvedExternalUrl(value) {
  const candidate = String(value ?? '').trim();
  if (!candidate) return null;
  try {
    const protocol = new URL(candidate).protocol.toLocaleLowerCase();
    return protocol === 'http:' || protocol === 'https:' ? candidate : null;
  } catch {
    return null;
  }
}

function flagshipIdentity(card) {
  const identity = String(card?.dataset?.locationId ?? '').trim();
  return identity || null;
}

function validateFlagshipPage(page) {
  if (!page || !Array.isArray(page.cards)) throw new Error('The flagship page payload is invalid.');
}

export function buildFlagshipsSectionUrl(pageUrl, sectionId, baseUrl = globalThis.location?.href) {
  const url = new URL(pageUrl, baseUrl);
  url.searchParams.set('section_id', sectionId);
  return url.toString();
}

export function buildFirstFlagshipsPageUrl(currentUrl, baseUrl = globalThis.location?.href) {
  const url = new URL(currentUrl, baseUrl);
  url.searchParams.delete('page');
  url.searchParams.delete('section_id');
  url.hash = '';
  return url.toString();
}

export async function loadAllFlagshipPages(initialPage, loadPage) {
  validateFlagshipPage(initialPage);
  const cards = [...initialPage.cards];
  const knownIds = new Set(cards.map(flagshipIdentity).filter(Boolean));
  const visitedUrls = new Set();
  let nextPageUrl = initialPage.nextPageUrl || '';

  while (nextPageUrl) {
    if (visitedUrls.has(nextPageUrl)) throw new Error(`Flagship pagination repeated URL: ${nextPageUrl}`);
    visitedUrls.add(nextPageUrl);
    const page = await loadPage(nextPageUrl);
    validateFlagshipPage(page);
    page.cards.forEach((card) => {
      const identity = flagshipIdentity(card);
      if (identity && knownIds.has(identity)) return;
      if (identity) knownIds.add(identity);
      cards.push(card);
    });
    nextPageUrl = page.nextPageUrl || '';
  }

  return { cards };
}

export function readFlagshipPage(loader) {
  if (!loader) throw new Error('The flagship loader is missing from the response.');
  return {
    cards: [...loader.querySelectorAll('[data-flagship-card]')],
    nextPageUrl: loader.dataset.nextPageUrl || '',
  };
}

export class LocationsFlagshipsLoader extends HTMLElementBase {
  connectedCallback() {
    if (this.loaderInitialized) return;
    this.loaderInitialized = true;
    this.list = this.querySelector('[data-flagship-list]');
    this.pagination = this.querySelector('[data-flagships-fallback-pagination]');
    this.status = this.querySelector('[data-flagships-status]');
    this.cards = [...this.querySelectorAll('[data-flagship-card]')];
    for (const link of this.querySelectorAll('.locations-flagships__website')) {
      if (!approvedExternalUrl(link.getAttribute('href'))) link.remove();
    }
    this.loadRemainingPages().catch(() => {
      if (this.status) {
        this.status.textContent = 'Additional flagship locations could not be loaded. Use the page links to continue.';
      }
    });
  }

  async loadRemainingPages() {
    const currentPage = Number.parseInt(this.dataset.currentPage, 10) || 1;
    const nextPageUrl = this.dataset.nextPageUrl;
    if (!this.list || (!nextPageUrl && currentPage === 1)) return;

    const initialPage =
      currentPage > 1
        ? await this.fetchPage(
            buildFirstFlagshipsPageUrl(this.ownerDocument?.location?.href ?? globalThis.location?.href),
          )
        : { cards: this.cards, nextPageUrl };
    const aggregated = await loadAllFlagshipPages(initialPage, (url) => this.fetchPage(url));
    const fragment = this.ownerDocument.createDocumentFragment();
    aggregated.cards.forEach((card) => fragment.append(card));
    this.list.replaceChildren(fragment);
    this.cards = aggregated.cards;
    if (this.pagination) this.pagination.hidden = true;
  }

  async fetchPage(pageUrl) {
    const url = buildFlagshipsSectionUrl(pageUrl, this.dataset.sectionId, globalThis.location.href);
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!response.ok) throw new Error(`Flagship page request failed with status ${response.status}.`);
    const html = new DOMParser().parseFromString(await response.text(), 'text/html');
    return readFlagshipPage(html.querySelector('locations-flagships-loader'));
  }
}

export function galleryIndexForKey(key, currentIndex, slideCount) {
  const count = Number(slideCount);
  if (!Number.isInteger(count) || count <= 1) return null;

  const current = Math.min(Math.max(Number(currentIndex) || 0, 0), count - 1);
  if (key === 'ArrowRight') return (current + 1) % count;
  if (key === 'ArrowLeft') return (current - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

export function galleryScrollBehavior(prefersReducedMotion) {
  return prefersReducedMotion ? 'auto' : 'smooth';
}

export class LocationsFlagshipGallery extends HTMLElementBase {
  connectedCallback() {
    if (this.galleryInitialized) return;

    this.slides = [...(this.querySelectorAll?.('[data-gallery-slide]') ?? [])];
    if (this.slides.length <= 1) return;

    this.galleryInitialized = true;
    this.currentIndex = 0;
    this.viewport = this.querySelector('[data-gallery-viewport]');
    this.previousButton = this.querySelector('[data-gallery-previous]');
    this.nextButton = this.querySelector('[data-gallery-next]');
    this.status = this.querySelector('[data-gallery-status]');
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.onPreviousClick = () => this.navigateBy(-1);
    this.onNextClick = () => this.navigateBy(1);
    this.onViewportKeydown = (event) => this.onKeydown(event);
    this.onDirectScrollIntent = () => this.cancelProgrammaticScroll();
    this.onViewportScroll = () => {
      if (this.programmaticScrollActive) {
        this.scheduleProgrammaticScrollEnd();
        return;
      }

      clearTimeout(this.scrollSyncTimer);
      this.scrollSyncTimer = setTimeout(() => {
        this.scrollSyncTimer = null;
        this.syncFromViewport();
      }, SCROLL_SYNC_DELAY_MS);
    };
    this.onViewportScrollEnd = () => {
      if (this.programmaticScrollActive) {
        this.cancelProgrammaticScroll();
        return;
      }
      this.flushPendingScrollSync();
    };

    this.previousButton?.addEventListener('click', this.onPreviousClick);
    this.nextButton?.addEventListener('click', this.onNextClick);
    this.viewport?.addEventListener('keydown', this.onViewportKeydown);
    this.viewport?.addEventListener('wheel', this.onDirectScrollIntent, { passive: true });
    this.viewport?.addEventListener('touchstart', this.onDirectScrollIntent, { passive: true });
    this.viewport?.addEventListener('pointerdown', this.onDirectScrollIntent, { passive: true });
    this.viewport?.addEventListener('scroll', this.onViewportScroll, { passive: true });
    this.viewport?.addEventListener('scrollend', this.onViewportScrollEnd);
    this.updateStatus();
  }

  disconnectedCallback() {
    if (!this.galleryInitialized) return;

    this.previousButton?.removeEventListener('click', this.onPreviousClick);
    this.nextButton?.removeEventListener('click', this.onNextClick);
    this.viewport?.removeEventListener('keydown', this.onViewportKeydown);
    this.viewport?.removeEventListener('wheel', this.onDirectScrollIntent);
    this.viewport?.removeEventListener('touchstart', this.onDirectScrollIntent);
    this.viewport?.removeEventListener('pointerdown', this.onDirectScrollIntent);
    this.viewport?.removeEventListener('scroll', this.onViewportScroll);
    this.viewport?.removeEventListener('scrollend', this.onViewportScrollEnd);
    clearTimeout(this.scrollSyncTimer);
    this.scrollSyncTimer = null;
    this.cancelProgrammaticScroll();
    this.galleryInitialized = false;
  }

  onKeydown(event) {
    this.flushPendingScrollSync();
    const nextIndex = galleryIndexForKey(event.key, this.currentIndex, this.slides.length);
    if (nextIndex === null) return;
    event.preventDefault();
    this.show(nextIndex);
  }

  navigateBy(direction) {
    this.flushPendingScrollSync();
    this.show(this.currentIndex + direction);
  }

  flushPendingScrollSync() {
    if (this.scrollSyncTimer === null || this.scrollSyncTimer === undefined) return;
    clearTimeout(this.scrollSyncTimer);
    this.scrollSyncTimer = null;
    this.syncFromViewport();
  }

  scheduleProgrammaticScrollEnd() {
    clearTimeout(this.programmaticScrollTimer);
    this.programmaticScrollTimer = setTimeout(() => {
      this.programmaticScrollTimer = null;
      this.programmaticScrollActive = false;
    }, PROGRAMMATIC_SCROLL_SETTLE_MS);
  }

  cancelProgrammaticScroll() {
    clearTimeout(this.programmaticScrollTimer);
    this.programmaticScrollTimer = null;
    this.programmaticScrollActive = false;
  }

  show(index) {
    const count = this.slides.length;
    this.currentIndex = ((index % count) + count) % count;
    const slide = this.slides[this.currentIndex];

    if (this.viewport) {
      this.programmaticScrollActive = true;
      this.scheduleProgrammaticScrollEnd();
      this.viewport.scrollTo({
        left: slide.offsetLeft,
        behavior: galleryScrollBehavior(this.reducedMotion),
      });
    }
    this.updateStatus();
  }

  syncFromViewport() {
    if (!this.viewport || this.slides.length <= 1) return;

    const scrollLeft = this.viewport.scrollLeft;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    this.slides.forEach((slide, index) => {
      const distance = Math.abs(slide.offsetLeft - scrollLeft);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    if (closestIndex === this.currentIndex) return;
    this.currentIndex = closestIndex;
    this.updateStatus();
  }

  updateStatus() {
    if (this.status) this.status.textContent = `Image ${this.currentIndex + 1} of ${this.slides.length}`;
  }
}

if (globalThis.customElements && !customElements.get('locations-flagship-gallery')) {
  customElements.define('locations-flagship-gallery', LocationsFlagshipGallery);
}

if (globalThis.customElements && !customElements.get('locations-flagships-loader')) {
  customElements.define('locations-flagships-loader', LocationsFlagshipsLoader);
}

/*
 * Venue tablist.
 *
 * The previous theme listed ONA's own venues as clickable names beside the
 * gallery; the Horizon port rendered every venue expanded instead. This
 * restores the one-at-a-time behaviour.
 *
 * The buttons are built here rather than in Liquid because
 * LocationsFlagshipsLoader calls list.replaceChildren() once it has aggregated
 * venues from every paginated page. Markup-rendered buttons would then point at
 * panels that no longer exist, a per-page Liquid counter would emit duplicate
 * ids across pages, and any venue arriving after the first page would have a
 * panel with no tab -- which, with the collapsed layout active, means a venue
 * nobody can reach. Building from the cards and rebuilding on mutation keeps
 * tabs and panels in step by construction.
 *
 * Progressive enhancement: the nav is display:none and every card is visible
 * until this connects and adds `is-enhanced`.
 */
class LocationsFlagshipsTabs extends HTMLElementBase {
  connectedCallback() {
    this.nav = this.querySelector('[data-flagship-nav]');
    this.list = this.querySelector('[data-flagship-list]');
    if (!this.nav || !this.list) return;

    this.addEventListener('click', this.#onClick);
    this.addEventListener('keydown', this.#onKeydown);

    this.refresh();

    if (globalThis.MutationObserver) {
      this.observer = new MutationObserver(() => this.refresh());
      this.observer.observe(this.list, { childList: true });
    }
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick);
    this.removeEventListener('keydown', this.#onKeydown);
    this.observer?.disconnect();
  }

  /**
   * Rebuilds the tablist from whatever cards are in the list right now, keeping
   * the selected venue if it is still present.
   */
  refresh() {
    const selected = this.tabs?.[this.activeIndex ?? 0]?.dataset.locationId ?? null;
    /*
     * A rebuild replaces the buttons, which destroys the focused one. The
     * loader can finish while a keyboard user is part-way along the tablist,
     * and focus would then fall back to <body> mid-interaction -- so remember
     * whether focus was ours and put it back on the equivalent tab.
     */
    const hadFocus = this.tabs?.some((tab) => tab === document.activeElement) ?? false;
    this.panels = Array.from(this.list.querySelectorAll('[data-flagship-card]'));

    /*
     * One venue needs no tablist, and zero means the loader has not finished.
     * Either way the collapsed layout comes off, so nothing is left hidden
     * behind a control that is not there.
     */
    if (this.panels.length < 2) {
      this.classList.remove('is-enhanced');
      this.nav.replaceChildren();
      /*
       * Strip the semantics too. Leaving role="tabpanel" and an
       * aria-labelledby pointing at a button that no longer exists gives a
       * screen reader a panel with no tab and no name -- worse than the plain
       * <article> this started as.
       */
      this.panels.forEach((panel) => {
        panel.removeAttribute('role');
        panel.removeAttribute('aria-labelledby');
        panel.classList.remove('is-active');
      });
      this.tabs = [];
      return;
    }

    const uid = this.dataset.uid ?? (this.dataset.uid = Math.random().toString(36).slice(2, 8));
    const buttons = this.panels.map((panel, i) => {
      const panelId = `FlagshipPanel-${uid}-${i + 1}`;
      const tabId = `FlagshipTab-${uid}-${i + 1}`;
      panel.id = panelId;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tabId);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'locations-flagships__nav-item';
      button.setAttribute('role', 'tab');
      button.id = tabId;
      button.setAttribute('aria-controls', panelId);
      button.dataset.locationId = panel.dataset.locationId ?? '';
      button.textContent = panel.querySelector('.locations-flagships__title')?.textContent?.trim() ?? `Venue ${i + 1}`;
      return button;
    });

    this.nav.replaceChildren(...buttons);
    this.tabs = buttons;
    this.classList.add('is-enhanced');

    const keep = buttons.findIndex((b) => selected && b.dataset.locationId === selected);
    const index = keep >= 0 ? keep : 0;
    this.select(index);
    if (hadFocus) buttons[index].focus();
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
   * Moves the selection. Panel visibility, the accessibility tree and the
   * roving tabindex all change in the same pass -- splitting them is how a
   * tablist ends up announcing one venue while showing another.
   */
  select(index) {
    this.activeIndex = index;
    this.tabs.forEach((tab, i) => {
      const isActive = i === index;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.tabIndex = isActive ? 0 : -1;
    });
    this.panels.forEach((panel, i) => {
      panel.classList.toggle('is-active', i === index);
    });
  }
}

if (globalThis.customElements && !customElements.get('locations-flagships-tabs')) {
  customElements.define('locations-flagships-tabs', LocationsFlagshipsTabs);
}
