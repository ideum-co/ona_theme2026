/*
 * Black Friday banner countdown.
 *
 * A copy of `bfcm-countdown.js`, deliberately NOT a modification of it. That
 * element is wired into `sections/bfcm-landing.liquid` and its status strings
 * are hard-coded; the homepage banner needs its own wording, and the landing
 * page must keep rendering exactly as it does today. Two elements, one date
 * engine each, no shared mutation.
 *
 * The only behavioural change from the original is that every visible string
 * comes from a data attribute instead of a literal, so the section schema owns
 * the wording and Macarena can edit it without a deploy.
 *
 * Markup contract (see ona-bf-countdown-banner.liquid):
 *   data-start-at / data-end-at  ISO 8601 WITH an explicit offset
 *   [data-countdown-status]      the eyebrow line
 *   [data-countdown-clock]       wrapper for the digit cards
 *   [data-countdown-fallback]    shown instead of the clock once live/ended
 *   [data-countdown-{days,hours,minutes,seconds}]
 */
class BfBannerCountdown extends HTMLElement {
  connectedCallback() {
    // An ISO string without an offset is parsed as local time by the browser
    // and as UTC by some engines, which silently shifts the countdown by the
    // viewer's timezone. Refuse rather than render a wrong number.
    const hasExplicitOffset = (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(value || '');
    if (!hasExplicitOffset(this.dataset.startAt) || !hasExplicitOffset(this.dataset.endAt)) return;

    this.startAt = Date.parse(this.dataset.startAt);
    this.endAt = Date.parse(this.dataset.endAt);
    if (!Number.isFinite(this.startAt) || !Number.isFinite(this.endAt) || this.endAt <= this.startAt) return;

    this.labelBefore = this.dataset.labelBefore || 'Starts in';
    this.labelLive = this.dataset.labelLive || 'On now';
    this.labelEnded = this.dataset.labelEnded || 'That is a wrap';
    this.textLive = this.dataset.textLive || '';
    this.textEnded = this.dataset.textEnded || '';

    this.status = this.querySelector('[data-countdown-status]');
    this.clock = this.querySelector('[data-countdown-clock]');
    this.fallback = this.querySelector('[data-countdown-fallback]');
    this.values = ['days', 'hours', 'minutes', 'seconds'].map((unit) =>
      this.querySelector(`[data-countdown-${unit}]`)
    );
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

  update() {
    const now = Date.now();

    if (now >= this.endAt) {
      this.status.textContent = this.labelEnded;
      this.fallback.textContent = this.textEnded;
      this.clock.hidden = true;
      this.fallback.hidden = false;
      return false;
    }

    if (now >= this.startAt) {
      if (this.status.textContent !== this.labelLive) {
        this.status.textContent = this.labelLive;
        this.fallback.textContent = this.textLive;
      }
      this.clock.hidden = true;
      this.fallback.hidden = false;
      return true;
    }

    const remaining = Math.ceil((this.startAt - now) / 1000);
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
    if (this.status.textContent !== this.labelBefore) this.status.textContent = this.labelBefore;
    this.clock.hidden = false;
    this.fallback.hidden = true;
    return true;
  }
}

if (!customElements.get('bf-banner-countdown')) {
  customElements.define('bf-banner-countdown', BfBannerCountdown);
}
