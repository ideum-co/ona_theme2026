import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const script = read('assets/ona-slider.js');

/*
 * Several sections were ported as sliders -- a track with one `.slider-block`
 * per slide -- without the stylesheet or script that drove them, so every slide
 * rendered at full size, one under the next. Measured on the live
 * /pages/wholesale at a 1685px viewport: the testimonial section ran 1,988px
 * with four episodes stacked, and `supported` 1,688px with three.
 */
const SECTIONS = ['sections/ona-supported.liquid', 'sections/ona-wholesale-testimonial.liquid'];

test('each ported slider is driven by <ona-slider>', () => {
  for (const file of SECTIONS) {
    const src = read(file);
    assert.match(src, /<ona-slider class="ona-slider">/, `${file}: the track needs an element to drive it`);
    assert.match(src, /<\/ona-slider>/, `${file}: and it has to be closed`);
    assert.match(src, /data-slider-nav/, `${file}: the element needs somewhere to put the tabs`);
    assert.match(src, /data-slider-track/, `${file}: and it needs to find the track`);
    assert.match(src, /data-slider-slide/, `${file}: slides must be marked`);
    assert.match(src, /data-slide-label="/, `${file}: labels stay authored in the section`);
    assert.match(src, /ona-slider\.js' \| asset_url/, `${file}: the script must be loaded`);
  }
});

test('the slider styles ship with the sections, not the shared sheet', () => {
  /*
   * Both sections have a preset, so either can be placed on a JSON template
   * that never loads assets/legacy-page-layout.css. Keeping the collapse in
   * that sheet is how the FAQ sections broke (#218): the script toggles
   * `is-active` while nothing hides or reveals anything.
   */
  for (const file of SECTIONS) {
    const src = read(file);
    const styles = src.match(/\{% stylesheet %\}([\s\S]*?)\{% endstylesheet %\}/);
    assert.ok(styles, `${file}: needs its own stylesheet block`);
    assert.match(styles[1], /\.ona-slider\.is-enhanced \[data-slider-slide\]/, `${file}: must collapse its own slides`);
    assert.match(styles[1], /\.ona-slider__nav \{ display: none; \}/, `${file}: the nav starts hidden`);
  }
  assert.doesNotMatch(
    read('assets/legacy-page-layout.css'),
    /ona-slider|data-slider-slide/,
    'the shared sheet must not be where these rules live',
  );
});

test('without JavaScript every slide is still readable', () => {
  /*
   * The track only becomes a single grid cell once the element connects. A
   * slider that collapses before its script runs loses content on a slow
   * connection -- and these are video testimonials, the page's main content.
   */
  for (const file of SECTIONS) {
    const styles = read(file).match(/\{% stylesheet %\}([\s\S]*?)\{% endstylesheet %\}/)[1];
    assert.match(styles, /\.ona-slider\.is-enhanced \[data-slider-track\] \{ display: grid; \}/, `${file}: stacking is opt-in`);
    assert.doesNotMatch(
      styles,
      /(?:^|\n)\s*\[data-slider-slide\] \{[^}]*visibility: hidden/,
      `${file}: an unqualified rule must not hide slides`,
    );
  }
  assert.match(script, /this\.classList\.add\('is-enhanced'\)/, 'the element opts in to the collapsed layout');
});

test('the tablist is built from the slides and survives changes', () => {
  assert.match(script, /slide\.dataset\.slideLabel/, 'labels come from the section');
  assert.match(script, /new MutationObserver\(\(\) => this\.refresh\(\)\)/, 'the tablist follows the track');
  assert.match(script, /observe\(this\.track, \{ childList: true \}\)/, 'childList changes are what matter');
  assert.match(script, /this\.observer\?\.disconnect\(\)/, 'and it is torn down');

  const guard = script.match(/if \(this\.slides\.length < 2\) \{([\s\S]*?)\n    \}/);
  assert.ok(guard, 'one slide needs no controls');
  assert.match(guard[1], /classList\.remove\('is-enhanced'\)/, 'and nothing may stay hidden');
});

test('selection moves the slide and the accessibility tree together', () => {
  const select = script.match(/select\(index\)\s*\{([\s\S]*?)\n  \}/);
  assert.ok(select, 'there must be a single select()');
  assert.match(select[1], /aria-selected/, 'selection must be exposed');
  assert.match(select[1], /tabIndex/, 'a roving tabindex keeps one stop in the tablist');
  assert.match(select[1], /slide\.classList\.toggle\('is-active'/, 'the slide must follow');
  assert.match(script, /ArrowRight|ArrowLeft/, 'a tablist is arrow-key navigable');
});
