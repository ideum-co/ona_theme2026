import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(resolve(import.meta.dirname, '../assets/bfcm-countdown.js'), 'utf8');
const startAt = '2026-11-27T00:00:00+11:00';
const endAt = '2026-12-01T00:00:00+11:00';

function mount(now, dates = { startAt, endAt }) {
  const nodes = new Map();
  for (const name of ['status', 'clock', 'fallback', 'days', 'hours', 'minutes', 'seconds']) {
    nodes.set(`[data-countdown-${name}]`, { hidden: name === 'clock', textContent: '' });
  }
  let intervalCallback;
  let cleared = false;
  let scheduled = false;
  let Countdown;
  class Element {
    constructor() { this.dataset = dates; }
    querySelector(selector) { return nodes.get(selector); }
  }
  vm.runInNewContext(source, {
    HTMLElement: Element,
    Date: { parse: Date.parse, now: () => now },
    customElements: { get: () => undefined, define: (_name, constructor) => { Countdown = constructor; } },
    window: {
      setInterval: (callback) => { scheduled = true; intervalCallback = callback; return 1; },
      clearInterval: () => { cleared = true; },
    },
  });
  const element = new Countdown();
  element.connectedCallback();
  return {
    nodes,
    get scheduled() { return scheduled; },
    get cleared() { return cleared; },
    advanceTo(value) { now = value; intervalCallback?.(); },
  };
}

test('counts down to the launch, then keeps a live clock to the end of the sale', () => {
  // Before the sale: "Starts in", counting to the Sydney launch instant.
  const countdown = mount(Date.parse('2026-11-26T23:59:58+11:00'));
  assert.equal(countdown.nodes.get('[data-countdown-status]').textContent, 'Starts in');
  assert.deepEqual(
    ['days', 'hours', 'minutes', 'seconds'].map((unit) => countdown.nodes.get(`[data-countdown-${unit}]`).textContent),
    ['00', '00', '00', '02'],
  );
  assert.equal(countdown.nodes.get('[data-countdown-clock]').hidden, false);

  // Once the sale opens the clock does NOT stop: it flips to "Ends in" and
  // counts down to the end instead (startAt..endAt is four whole days here).
  countdown.advanceTo(Date.parse(startAt));
  assert.equal(countdown.nodes.get('[data-countdown-status]').textContent, 'Ends in');
  assert.equal(countdown.nodes.get('[data-countdown-clock]').hidden, false);
  assert.deepEqual(
    ['days', 'hours', 'minutes', 'seconds'].map((unit) => countdown.nodes.get(`[data-countdown-${unit}]`).textContent),
    ['04', '00', '00', '00'],
  );
  assert.equal(countdown.cleared, false);

  // At the end: the ended status, the clock hidden, and the timer cleared.
  countdown.advanceTo(Date.parse(endAt));
  assert.equal(countdown.nodes.get('[data-countdown-status]').textContent, 'That is a wrap');
  assert.equal(countdown.nodes.get('[data-countdown-clock]').hidden, true);
  assert.equal(countdown.cleared, true);
});

test('shows an ended state after the campaign and keeps invalid dates as static fallback', () => {
  const ended = mount(Date.parse(endAt));
  assert.equal(ended.nodes.get('[data-countdown-status]').textContent, 'That is a wrap');
  assert.equal(ended.scheduled, false);

  const invalid = mount(Date.parse(startAt), { startAt: 'invalid', endAt });
  assert.equal(invalid.scheduled, false);
  assert.equal(invalid.nodes.get('[data-countdown-clock]').hidden, true);

  const noOffset = mount(Date.parse(startAt), { startAt: '2026-11-27T00:00:00', endAt });
  assert.equal(noOffset.scheduled, false);
  assert.equal(noOffset.nodes.get('[data-countdown-clock]').hidden, true);
});
