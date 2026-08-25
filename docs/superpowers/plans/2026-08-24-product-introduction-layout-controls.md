# Product Introduction Layout Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable media and inner-content width controls to Product introduction while its background remains full width.

**Architecture:** Keep `.product-intro` as the full-width visual background and add a `.product-intro__inner` grid that owns page width, maximum width, column proportions, and media extension. Expose values through schema settings and section-scoped CSS custom properties, without modifying any template JSON.

**Tech Stack:** Shopify Liquid, Shopify theme schema JSON, CSS, Node.js built-in test runner.

## Global Constraints

- Do not modify `templates/index.json` or any other template JSON.
- Preserve all existing Product introduction values and rendering paths.
- The background color and optional background image must remain full width.
- New defaults are Media width `medium`, Media height `medium`, Section width `page-width`, Limit content width enabled, Max width `1280px`.
- Do not expose Extend media to screen edge: the media is the center column and horizontal extension would overlap adjacent content.

---

### Task 1: Product introduction layout contract

**Files:**
- Create: `tests/product-introduction-layout-controls.test.mjs`
- Modify: `sections/product-intro.liquid`

**Interfaces:**
- Consumes: existing `section.settings`, existing Product introduction media/model rendering, and theme page-margin variables.
- Produces: schema settings `media_width`, `media_height`, `section_width`, `limit_content_width`, and `max_width`; markup class `.product-intro__inner`; CSS variables `--product-intro-max-width` and `--product-intro-media-height`.

- [ ] **Step 1: Write the failing schema and source-contract test**

Create a Node test that reads `sections/product-intro.liquid`, extracts its schema JSON, and asserts:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../sections/product-intro.liquid', import.meta.url), 'utf8');
const schemaMatch = source.match(/{% schema %}\\s*([\\s\\S]*?)\\s*{% endschema %}/);
assert.ok(schemaMatch, 'Product introduction schema must exist');
const schema = JSON.parse(schemaMatch[1]);
const setting = (id) => schema.settings.find((item) => item.id === id);

test('exposes Product introduction layout controls', () => {
  assert.deepEqual(setting('media_width').options.map(({ value }) => value), ['narrow', 'medium', 'wide']);
  assert.equal(setting('media_width').default, 'medium');
  assert.deepEqual(setting('media_height').options.map(({ value }) => value), ['auto', 'small', 'medium', 'large', 'full-screen']);
  assert.equal(setting('media_height').default, 'medium');
  assert.deepEqual(setting('section_width').options.map(({ value }) => value), ['page-width', 'full-width']);
  assert.equal(setting('section_width').default, 'page-width');
  assert.equal(setting('limit_content_width').default, true);
  assert.deepEqual(
    { min: setting('max_width').min, max: setting('max_width').max, step: setting('max_width').step, default: setting('max_width').default },
    { min: 800, max: 1800, step: 20, default: 1280 },
  );
  assert.equal(setting('max_width').visible_if, '{{ section.settings.limit_content_width }}');
});

test('keeps the background outside the constrained inner grid', () => {
  assert.match(source, /class="product-intro spacing-style"[\\s\\S]*?<div[\\s\\S]*?class="product-intro__inner/);
  assert.match(source, /--product-intro-max-width: {{ settings\\.max_width \\| default: 1280 }}px/);
  assert.match(source, /--product-intro-media-height:/);
  assert.match(source, /\\.product-intro__inner\\s*\\{/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run `node --test tests/product-introduction-layout-controls.test.mjs`.

Expected: FAIL because the schema controls and inner wrapper do not exist.

- [ ] **Step 3: Add schema settings without touching template JSON**

Add a Layout header and the five settings to `sections/product-intro.liquid`. Use existing translation keys. Define media-height values `auto`, `small`, `medium`, `large`, and `full-screen`, with default `medium`.

- [ ] **Step 4: Move the existing grid into an inner wrapper**

Keep the existing outer element and background declarations. Add this wrapper around the existing wordmark, media, and details nodes:

```liquid
<div
  class="product-intro__inner product-intro__inner--{{ settings.section_width | default: 'page-width' }} product-intro__inner--media-{{ settings.media_width | default: 'medium' }}{% if settings.limit_content_width %} product-intro__inner--limited{% endif %}"
>
  <!-- Existing wordmark, media, and details nodes remain unchanged. -->
</div>
```

Publish these variables on the outer element:

```liquid
--product-intro-max-width: {{ settings.max_width | default: 1280 }}px;
--product-intro-media-height: var(--product-intro-media-height-{{ settings.media_height | default: 'medium' }});
```

- [ ] **Step 5: Implement responsive grid sizing and media extension**

Change `.product-intro` to own only background, color, and section spacing. Move grid rules to `.product-intro__inner`; center it, apply page margins for `page-width`, and apply the maximum width only with `--limited`.

Define a responsive height scale:

```css
.product-intro {
  --product-intro-media-height-auto: auto;
  --product-intro-media-height-small: 40svh;
  --product-intro-media-height-medium: 60svh;
  --product-intro-media-height-large: 80svh;
  --product-intro-media-height-full-screen: 100svh;
}

.product-intro__media {
  block-size: var(--product-intro-media-height, 60svh);
}
```

On desktop, map media width to column proportions: narrow `1fr 0.75fr 1fr`, medium `1fr 1.1fr 1fr`, and wide `1fr 1.5fr 1fr`. Keep all three columns inside the selected page/max-width constraint.

- [ ] **Step 6: Run the focused test and inspect protected JSON**

Run:

```bash
node --test tests/product-introduction-layout-controls.test.mjs
git diff -- templates/index.json
```

Expected: test PASS and no output for the template JSON diff.

- [ ] **Step 7: Commit the feature**

```bash
git add sections/product-intro.liquid tests/product-introduction-layout-controls.test.mjs
git commit -m "feat(product-intro): add layout controls"
```

---

### Task 2: Regression and theme validation

**Files:**
- Modify only if validation exposes a defect: `sections/product-intro.liquid`, `tests/product-introduction-layout-controls.test.mjs`

**Interfaces:**
- Consumes: Task 1 layout contract.
- Produces: a clean branch ready for a PR to `main`.

- [ ] **Step 1: Run the full automated suite**

Run `node --test tests/*.test.mjs`.

Expected: all tests PASS.

- [ ] **Step 2: Run Theme Check and filter to the changed Liquid file**

Run `shopify theme check --output json`.

Expected: no offenses whose path is `sections/product-intro.liquid`. Existing unrelated repository offenses are outside this change.

- [ ] **Step 3: Verify formatting and protected files**

Run:

```bash
git diff --check origin/main...HEAD
git diff --exit-code origin/main...HEAD -- templates/index.json
git status --short
```

Expected: no whitespace errors, no template JSON diff, and a clean worktree.

- [ ] **Step 4: Record any validation-only correction**

If validation requires a correction, rerun Steps 1–3 and commit:

```bash
git add sections/product-intro.liquid tests/product-introduction-layout-controls.test.mjs
git commit -m "fix(product-intro): correct layout control integration"
```

If no correction is needed, do not create an empty commit.
