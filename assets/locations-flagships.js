const HTMLElementBase = globalThis.HTMLElement ?? class {};
const SCROLL_SYNC_DELAY_MS = 50;
const PROGRAMMATIC_SCROLL_SETTLE_MS = 150;

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
