/**
 * Tabs for the "unique coffees" section.
 *
 * The ported markup carries the pieces of a slider the legacy theme drove with
 * slick: one `.slider-block` of three images per coffee, and one
 * `p.slider-handle[data-item="N"]` per coffee. slick is not in this theme, so
 * every block rendered at once -- nine images stacked, 9,110px on
 * /pages/wholesale against the old theme's 475px.
 *
 * The old theme (147508887743, Debut 17.13.0) overlays the blocks and
 * cross-fades between them: `left: 0 / -637px / -1274px` with
 * `opacity: 1 / 0 / 0`. The stacking is CSS here; this only moves the
 * `is-active` flag.
 */
class OnaUniqueCoffees extends HTMLElement {
  connectedCallback() {
    this.handles = [...this.querySelectorAll('[data-item]')];
    this.blocks = [...this.querySelectorAll('.slider-block')];
    this.panels = [...this.querySelectorAll('.faqs-text')];
    if (this.handles.length === 0) return;

    this.addEventListener('click', (event) => {
      const handle = event.target.closest('[data-item]');
      if (handle && this.contains(handle)) this.select(Number(handle.dataset.item));
    });

    // Left/right move between tabs, as a tablist should.
    this.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const current = this.handles.indexOf(document.activeElement.closest('[data-item]'));
      if (current === -1) return;
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 1 : -1;
      const next = (current + step + this.handles.length) % this.handles.length;
      this.select(next);
      this.handles[next].focus();
    });

    this.select(0);
  }

  select(index) {
    this.handles.forEach((handle, i) => {
      const active = i === index;
      handle.classList.toggle('is-active', active);
      handle.setAttribute('aria-selected', active ? 'true' : 'false');
      // Only the selected tab stays in the tab order, per the tablist pattern.
      handle.tabIndex = active ? 0 : -1;
    });
    this.blocks.forEach((block, i) => block.classList.toggle('is-active', i === index));
    this.panels.forEach((panel, i) => panel.classList.toggle('is-active', i === index));
  }
}

if (!customElements.get('ona-unique-coffees')) {
  customElements.define('ona-unique-coffees', OnaUniqueCoffees);
}
