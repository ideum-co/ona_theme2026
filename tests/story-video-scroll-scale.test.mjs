import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

const section = read('sections/story-video.liquid');
const js = read('assets/story-video-scale.js');

test('the scroll scale is opt-in and wired through the section', () => {
  const schema = JSON.parse(section.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/)[1]);
  const setting = schema.settings.find((s) => s.id === 'scroll_scale');
  assert.ok(setting, 'the section exposes a scroll_scale setting');
  assert.equal(setting.default, false, 'off by default');
  assert.match(section, /settings\.scroll_scale %\} story-video--scroll-scale/, 'the setting adds the hook class');
  assert.match(section, /settings\.scroll_scale -%\}\s*<script src="\{\{ 'story-video-scale\.js'/, 'and loads the fallback only when on');
});

test('the modern path is a CSS scroll-driven animation, gated on motion', () => {
  assert.match(
    section,
    /@media \(prefers-reduced-motion: no-preference\) \{\s*@supports \(animation-timeline: view\(\)\) \{[\s\S]*?animation-timeline: view\(\)/,
    'view() timeline runs only when motion is allowed and the browser supports it',
  );
  assert.match(section, /@keyframes story-video-scroll-scale \{[\s\S]*?scale\(1\)[\s\S]*?scale\(0\.92\)/, 'full size at centre, eased at the edges');
  assert.match(
    section,
    /@media \(prefers-reduced-motion: reduce\) \{\s*\.story-video--scroll-scale \.story-video__media \{\s*transform: none/,
    'reduced motion holds it still',
  );
});

test('the JS fallback no-ops where CSS can do it, and only touches transform', () => {
  assert.match(js, /CSS\.supports\('animation-timeline', 'view\(\)'\)/, 'it defers to CSS where view() timelines exist');
  assert.match(js, /prefersReduced\(\)/, 'and bails under reduced motion');
  assert.match(js, /setProperty\('--sv-scale'/, 'it drives the scale through a transform custom property, nothing layout-affecting');
  assert.match(js, /requestAnimationFrame\(update\)/, 'scroll work is rAF-throttled');
  assert.match(js, /new IntersectionObserver/, 'and only runs for media near the viewport');
});
