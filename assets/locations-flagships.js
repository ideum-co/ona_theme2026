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
