# Story with video editor controls implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Story with video independent native typography controls for heading, body, and button, plus four-sided internal padding controls for its text and media containers.

**Architecture:** Keep the section's current markup and video pipeline. Add prefixed typography settings consumed through a small section-specific helper, use native preset/custom classes on each text role, and map independent padding settings to scoped logical CSS variables with legacy horizontal fallbacks.

**Tech Stack:** Shopify Liquid, JSON section schema, Horizon typography and spacing tokens, CSS custom properties, Node.js source-level regression harness, Shopify Theme Check.

## Global Constraints

- Modify only Story with video and a focused helper/test required by it.
- Preserve heading semantics, logo, video sources, playback, poster, aspect ratio, maximum width, overhang, play control, links, colors, and outer section padding.
- Heading, body, and button typography must be independent per section instance.
- Every role supports Default, Paragraph, H1-H6, and Custom with font, size, line height, letter spacing, case, and wrap.
- Body rich text must use Horizon's `text-block` cascade for semantic child headings.
- The section must scope native `--color` to `settings.text_color`; button colors remain explicit and independent.
- Intro and media containers each expose top, bottom, left, and right internal padding.
- Existing `intro_padding_inline` and `media_padding_inline` values remain hidden legacy fallbacks when newer side-specific settings are absent.
- Existing defaults render unchanged and mobile must not gain overflow or forced whitespace.

## File map

- Create `snippets/story-video-typography-style.liquid`: emit Custom typography variables for a prefixed Story with video text role.
- Create `tests/story-video-editor-controls.test.mjs`: regression checks for role presets, runtime bindings, color, padding, fallbacks, and preserved video hooks.
- Modify `sections/story-video.liquid`: schema, markup classes/variables, color token, and padding bindings.

---

### Task 1: Independent typography for heading and body

**Files:**
- Create: `tests/story-video-editor-controls.test.mjs`
- Create: `snippets/story-video-typography-style.liquid`
- Modify: `sections/story-video.liquid`

**Interfaces:**
- Consumes: prefixed settings `body_type_preset`, `body_font`, `body_font_size`, `body_line_height`, `body_letter_spacing`, `body_case`, and `body_wrap`.
- Produces: helper call `{% render 'story-video-typography-style', settings: settings, prefix: 'body', type: 'body' %}` and native classes on `.story-video__body`.

- [ ] **Step 1: Add a failing regression harness**

Create a Node built-in test that reads the section/helper and asserts:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';

const section = fs.readFileSync('sections/story-video.liquid', 'utf8');
const helperPath = 'snippets/story-video-typography-style.liquid';

for (const suffix of ['type_preset', 'font', 'font_size', 'line_height', 'letter_spacing', 'case', 'wrap']) {
  assert.match(section, new RegExp(`"id"\\s*:\\s*"body_${suffix}"`), `body missing ${suffix}`);
}

assert.match(section, /class="story-video__body text-block/);
assert.match(section, /render 'story-video-typography-style'[\s\S]*?prefix: 'body'/);
assert.match(section, /--color:\s*\{\{ settings\.text_color \}\}/);
assert.ok(fs.existsSync(helperPath), 'missing Story video typography helper');
```

- [ ] **Step 2: Run RED**

Run: `node tests/story-video-editor-controls.test.mjs`

Expected: FAIL with `body missing type_preset`.

- [ ] **Step 3: Implement the prefixed typography helper**

Model the helper on `snippets/product-highlight-typography-style.liquid`. It must resolve the prefixed preset/font/size/line-height/letter-spacing/case/wrap values, emit nothing unless preset is `custom`, and output the same variables as `snippets/typography-style.liquid`:

```liquid
--font-family
--font-weight
--font-size
--line-height
--letter-spacing
--text-transform
--text-wrap
```

Keep its API exactly `settings`, `prefix`, and `type`.

- [ ] **Step 4: Bind heading and body to native presets**

Derive `heading_preset` from `settings.type_preset | default: 'rte'` and `body_preset` from `settings.body_type_preset | default: 'rte'`.

The heading keeps its semantic tag and existing unprefixed Custom settings. Add the selected preset class; add `custom-typography custom-font-size` for Custom; use a `--default` modifier for legacy heading size/family rules.

The body wrapper must have:

```liquid
story-video__body text-block rte {{ body_preset }}
```

plus Custom classes and the helper style render. Move the fixed body size to `.story-video__body--default` so presets are not overridden.

On the section root, add:

```liquid
--color: {{ settings.text_color }};
```

- [ ] **Step 5: Add body schema controls**

After `body`, add its typography header and complete preset/Custom group. Copy option values/defaults from the existing heading group, changing IDs and every `visible_if` to the `body_` prefix. Keep the legacy heading size setting hidden but functional under Default.

- [ ] **Step 6: Run GREEN and commit**

Run:

```bash
node tests/story-video-editor-controls.test.mjs
git diff --check
```

Expected: PASS and exit 0.

Commit:

```bash
git add sections/story-video.liquid snippets/story-video-typography-style.liquid tests/story-video-editor-controls.test.mjs
git commit -m "feat(story-video): add text typography controls"
```

---

### Task 2: Independent button typography

**Files:**
- Modify: `tests/story-video-editor-controls.test.mjs`
- Modify: `sections/story-video.liquid`

**Interfaces:**
- Consumes: helper from Task 1 with prefix `button` and type `body`.
- Produces: button preset/custom classes without changing `.button` layout or its explicit color variables.

- [ ] **Step 1: Extend the harness with failing button runtime assertions**

Add:

```js
for (const suffix of ['type_preset', 'font', 'font_size', 'line_height', 'letter_spacing', 'case', 'wrap']) {
  assert.match(section, new RegExp(`"id"\\s*:\\s*"button_${suffix}"`), `button missing ${suffix}`);
}
assert.match(section, /class="button story-video__button[^\"]*\{\{ button_preset \}\}/);
assert.match(section, /render 'story-video-typography-style'[\s\S]*?prefix: 'button'/);
assert.match(section, /\.story-video__button\.button[\s\S]*?--button-background-color/);
assert.match(section, /\.story-video__button\.button[\s\S]*?--button-color/);
```

- [ ] **Step 2: Run RED**

Run: `node tests/story-video-editor-controls.test.mjs`

Expected: FAIL on the missing button preset binding.

- [ ] **Step 3: Bind the button and add its complete schema group**

Derive `button_preset`, add it to the existing anchor class, add Custom classes conditionally, and render the helper inline with prefix `button`. Add the complete prefixed preset/Custom schema group next to the existing button content settings. Do not remove or override `button_background` or `button_text`.

- [ ] **Step 4: Run GREEN and commit**

Run:

```bash
node tests/story-video-editor-controls.test.mjs
git diff --check
```

Expected: PASS.

Commit:

```bash
git add sections/story-video.liquid tests/story-video-editor-controls.test.mjs
git commit -m "feat(story-video): add button typography controls"
```

---

### Task 3: Four-sided intro and media padding

**Files:**
- Modify: `tests/story-video-editor-controls.test.mjs`
- Modify: `sections/story-video.liquid`

**Interfaces:**
- Consumes: settings `intro_padding_block_start`, `intro_padding_block_end`, `intro_padding_inline_start`, `intro_padding_inline_end`, `media_padding_block_start`, `media_padding_block_end`, `media_padding_inline_start`, `media_padding_inline_end`.
- Produces: four scoped leaf variables for each container; hidden legacy settings supply fallback values.

- [ ] **Step 1: Add failing padding and compatibility assertions**

Add assertions for all eight side-specific IDs and for bindings equivalent to:

```liquid
--story-video-intro-padding-inline-start: {{ settings.intro_padding_inline_start | default: settings.intro_padding_inline | default: 0 }}px;
--story-video-intro-padding-inline-end: {{ settings.intro_padding_inline_end | default: settings.intro_padding_inline | default: 0 }}px;
--story-video-media-padding-inline-start: {{ settings.media_padding_inline_start | default: settings.media_padding_inline | default: 0 }}px;
--story-video-media-padding-inline-end: {{ settings.media_padding_inline_end | default: settings.media_padding_inline | default: 0 }}px;
```

Assert CSS applies separate block/inline start/end variables and the legacy IDs remain in schema with `visible_if: "{{ false }}"`.

- [ ] **Step 2: Run RED**

Run: `node tests/story-video-editor-controls.test.mjs`

Expected: FAIL with `missing intro_padding_inline_start`.

- [ ] **Step 3: Implement four-sided bindings and schema**

Replace shorthand variables and declarations with block-start, block-end, inline-start, and inline-end variables for both containers. Add left/right range settings with `0` defaults. Keep the old horizontal settings hidden and use them only as fallback when new saved values are absent.

- [ ] **Step 4: Run complete automated validation**

Run:

```bash
node tests/story-video-editor-controls.test.mjs
shopify theme check --path .
git diff --check
```

Expected: harness and diff check exit 0. Record whole-theme baseline errors separately; require zero offenses in `sections/story-video.liquid` and `snippets/story-video-typography-style.liquid`.

- [ ] **Step 5: Verify behavior in a development preview when authorized**

Check two section instances with different heading/body/button presets, Custom font roles, four-sided intro/media padding, empty text values, uploaded/external video, and a 390px viewport. Do not create or update a remote development theme without explicit store authorization.

- [ ] **Step 6: Commit final spacing changes**

```bash
git add sections/story-video.liquid tests/story-video-editor-controls.test.mjs
git commit -m "feat(story-video): add four-sided internal padding"
```
