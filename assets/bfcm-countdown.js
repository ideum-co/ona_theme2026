/*
 * BFCM landing-page countdown.
 *
 * A COPY of the date engine, deliberately NOT shared with the homepage banner
 * (bf-banner-countdown.js) or the Water For Good counter. Each surface keeps
 * its own element so one campaign's wording can never leak into another's.
 *
 * Two live phases (Macarena/Sarah, 13 Nov 2026):
 *   before the start -> count down to the start, status = data-label-before ("Starts in")
 *   during the sale  -> count down to the END,   status = data-label-live   ("Ends in")
 *   after the end    -> status = data-label-ended, show the static line, stop
 *
 * The phase is written onto the closest [data-bfcm-root] as data-phase, which
 * is how the section promotes "Shop sale" to the primary button once live. All
 * visible strings come from data attributes, so the section schema owns them.
 */
class BfcmCountdown extends HTMLElement {
  connectedCallback() {
    const hasExplicitOffset = (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(value || '');
    if (!hasExplicitOffset(this.dataset.startAt) || !hasExplicitOffset(this.dataset.endAt)) return;
    this.startAt = Date.parse(this.dataset.startAt);
    this.endAt = Date.parse(this.dataset.endAt);
    if (!Number.isFinite(this.startAt) || !Number.isFinite(this.endAt) || this.endAt <= this.startAt) return;

    this.labelBefore = this.dataset.labelBefore || 'Starts in';
    this.labelLive = this.dataset.labelLive || 'Ends in';
    this.labelEnded = this.dataset.labelEnded || 'That is a wrap';
    this.textEnded = this.dataset.textEnded || '';

    this.root = typeof this.closest === 'function' ? this.closest('[data-bfcm-root]') : null;
    this.status = this.querySelector('[data-countdown-status]');
    this.clock = this.querySelector('[data-countdown-clock]');
    this.fallback = this.querySelector('[data-countdown-fallback]');
    this.values = ['days', 'hours', 'minutes', 'seconds'].map((unit) => this.querySelector(`[data-countdown-${unit}]`));
    if (!this.status || !this.clock || !this.fallback || this.values.some((value) => !value)) return;

    if (this.update()) {
      this.interval = window.setInterval(() => {
        if (!this.update()) this.disconnectedCallback();
      }, 1000);
    }
  }

  disconnectedCallback() {
    window.clearInterval(this.interval);
  }

  setPhase(phase) {
    if (this.root && this.root.dataset.phase !== phase) this.root.dataset.phase = phase;
  }

  tick(target, label) {
    const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
    const parts = [
      Math.floor(remaining / 86400),
      Math.floor((remaining % 86400) / 3600),
      Math.floor((remaining % 3600) / 60),
      remaining % 60,
    ];
    parts.forEach((value, index) => {
      const text = String(value).padStart(2, '0');
      if (this.values[index].textContent !== text) this.values[index].textContent = text;
    });
    if (this.status.textContent !== label) this.status.textContent = label;
    this.clock.hidden = false;
    this.fallback.hidden = true;
  }

  update() {
    const now = Date.now();

    if (now >= this.endAt) {
      this.status.textContent = this.labelEnded;
      this.fallback.textContent = this.textEnded;
      this.clock.hidden = true;
      this.fallback.hidden = false;
      this.setPhase('ended');
      return false;
    }

    if (now >= this.startAt) {
      this.tick(this.endAt, this.labelLive);
      this.setPhase('live');
      return true;
    }

    this.tick(this.startAt, this.labelBefore);
    this.setPhase('before');
    return true;
  }
}

if (!customElements.get('bfcm-countdown')) {
  customElements.define('bfcm-countdown', BfcmCountdown);
}
