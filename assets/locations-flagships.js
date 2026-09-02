const HTMLElementBase = globalThis.HTMLElement ?? class {};

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
    this.slides = [...(this.querySelectorAll?.('[data-gallery-slide]') ?? [])];
    if (this.slides.length <= 1) return;

    this.currentIndex = 0;
    this.viewport = this.querySelector('[data-gallery-viewport]');
    this.previousButton = this.querySelector('[data-gallery-previous]');
    this.nextButton = this.querySelector('[data-gallery-next]');
    this.status = this.querySelector('[data-gallery-status]');
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.previousButton?.addEventListener('click', () => this.show(this.currentIndex - 1));
    this.nextButton?.addEventListener('click', () => this.show(this.currentIndex + 1));
    this.viewport?.addEventListener('keydown', (event) => this.onKeydown(event));
    this.updateStatus();
  }

  onKeydown(event) {
    const nextIndex = galleryIndexForKey(event.key, this.currentIndex, this.slides.length);
    if (nextIndex === null) return;
    event.preventDefault();
    this.show(nextIndex);
  }

  show(index) {
    const count = this.slides.length;
    this.currentIndex = ((index % count) + count) % count;
    const slide = this.slides[this.currentIndex];

    this.viewport?.scrollTo({
      left: slide.offsetLeft,
      behavior: galleryScrollBehavior(this.reducedMotion),
    });
    this.updateStatus();
  }

  updateStatus() {
    if (this.status) this.status.textContent = `Image ${this.currentIndex + 1} of ${this.slides.length}`;
  }
}

if (globalThis.customElements && !customElements.get('locations-flagship-gallery')) {
  customElements.define('locations-flagship-gallery', LocationsFlagshipGallery);
}
