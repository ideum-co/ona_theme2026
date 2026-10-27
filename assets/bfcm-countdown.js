class BfcmCountdown extends HTMLElement {
  connectedCallback() {
    this.startAt = Date.parse(this.dataset.startAt);
    this.endAt = Date.parse(this.dataset.endAt);
    if (!Number.isFinite(this.startAt) || !Number.isFinite(this.endAt) || this.endAt <= this.startAt) return;

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

  update() {
    const now = Date.now();
    if (now >= this.endAt) {
      this.status.textContent = 'The event has ended';
      this.fallback.textContent = 'Thank you for joining us.';
      this.clock.hidden = true;
      this.fallback.hidden = false;
      return false;
    }

    if (now >= this.startAt) {
      this.status.textContent = 'Black Friday Cyber Monday is on';
      this.fallback.textContent = 'Explore the latest ONA coffees.';
      this.clock.hidden = true;
      this.fallback.hidden = false;
      return false;
    }

    const remaining = Math.ceil((this.startAt - now) / 1000);
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    [days, hours, minutes, seconds].forEach((value, index) => {
      this.values[index].textContent = String(value).padStart(2, '0');
    });
    this.status.textContent = 'Starts in';
    this.clock.hidden = false;
    this.fallback.hidden = true;
    return true;
  }
}

if (!customElements.get('bfcm-countdown')) {
  customElements.define('bfcm-countdown', BfcmCountdown);
}
