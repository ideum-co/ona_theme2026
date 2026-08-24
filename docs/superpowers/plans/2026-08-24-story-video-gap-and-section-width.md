# Story Video Gap and Section Width Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose uniform vertical spacing between Story intro items and add an optional maximum content width to the generic Section without constraining section backgrounds.

**Architecture:** Story publishes a new section setting through a CSS custom property consumed by its existing intro grid. Generic Section passes width settings into the shared `section` snippet, which caps only `.custom-section-content` while leaving the outer background layers unchanged.

**Tech Stack:** Shopify Liquid, JSON section schemas, CSS custom properties, Node.js built-in test runner, Shopify Theme Check.

## Global Constraints

- Work only in `ideum-co/ona_theme2026` on the branch attached to PR #84.
- Keep the existing Story lateral padding controls.
- Use one uniform Story content gap between logo, heading, body, and button.
- Keep generic Section backgrounds full width when content is limited.
- Preserve existing storefront appearance when new settings have not been changed.

---

### Task 1: Story intro content gap

**Files:**
- Modify: `sections/story-video.liquid`
- Modify: `tests/story-video-editor-controls.test.mjs`

**Interfaces:**
- Consumes: `section.settings.content_gap`, an integer pixel value from the section schema.
- Produces: CSS property `--story-video-content-gap` consumed by `.story-video__intro`.

- [ ] **Step 1: Write the failing regression test**

Add assertions that the Story schema contains a `content_gap` range with `min: 0`, `max: 100`, `step: 1`, `unit: "px"`, and a default matching the current large gap; assert the root style emits `--story-video-content-gap` and `.story-video__intro` uses `gap: var(--story-video-content-gap, var(--gap-lg))`.

- [ ] **Step 2: Run the Story test and verify RED**

Run: `node --test tests/story-video-editor-controls.test.mjs`

Expected: FAIL because `content_gap` and `--story-video-content-gap` do not exist.

- [ ] **Step 3: Add the minimal Story implementation**

In `sections/story-video.liquid`, add the range setting near the intro layout controls, emit:

```liquid
--story-video-content-gap: {{ settings.content_gap }}px;
```

and replace the fixed intro gap with:

```css
gap: var(--story-video-content-gap, var(--gap-lg));
```

Choose the numeric default by resolving the current `--gap-lg` token in the theme so the initial rendering is unchanged.

- [ ] **Step 4: Run the Story test and verify GREEN**

Run: `node --test tests/story-video-editor-controls.test.mjs`

Expected: all Story tests PASS.

- [ ] **Step 5: Commit the Story gap deliverable**

```bash
git add sections/story-video.liquid tests/story-video-editor-controls.test.mjs
git commit -m "fix(story-video): expose intro content gap"
```

### Task 2: Generic Section content-width limit

**Files:**
- Modify: `sections/section.liquid`
- Modify: `snippets/section.liquid`
- Create: `tests/section-content-width-controls.test.mjs`

**Interfaces:**
- Consumes: `section.settings.limit_content_width` boolean and `section.settings.max_width` integer pixels.
- Produces: conditional class `custom-section-content--limited` and CSS property `--custom-section-content-max-width` on the content wrapper.

- [ ] **Step 1: Write the failing Section regression tests**

Create a Node test that asserts:

```js
assert.equal(limitSetting.default, false);
assert.equal(maxSetting.visible_if, "{{ section.settings.limit_content_width }}");
assert.match(snippet, /custom-section-content--limited/);
assert.match(snippet, /--custom-section-content-max-width:/);
assert.match(snippet, /max-inline-size: var\(--custom-section-content-max-width/);
assert.match(snippet, /margin-inline: auto/);
```

Also assert that the limited class is on `.custom-section-content`, not `.section-background` or the outer `.section` element.

- [ ] **Step 2: Run the Section test and verify RED**

Run: `node --test tests/section-content-width-controls.test.mjs`

Expected: FAIL because the settings and wrapper class do not exist.

- [ ] **Step 3: Add schema controls and content-only styling**

Add this established settings shape after `section_width` in `sections/section.liquid`:

```json
{
  "type": "checkbox",
  "id": "limit_content_width",
  "label": "t:settings.limit_content_width",
  "default": false
},
{
  "type": "range",
  "id": "max_width",
  "label": "t:settings.max_width",
  "min": 800,
  "max": 1800,
  "step": 20,
  "unit": "px",
  "default": 1280,
  "visible_if": "{{ section.settings.limit_content_width }}"
}
```

In `snippets/section.liquid`, conditionally add `custom-section-content--limited`, emit `--custom-section-content-max-width: {{ section.settings.max_width }}px`, and style only that wrapper:

```css
.custom-section-content--limited {
  inline-size: 100%;
  max-inline-size: var(--custom-section-content-max-width, 1280px);
  margin-inline: auto;
}
```

- [ ] **Step 4: Run the Section test and verify GREEN**

Run: `node --test tests/section-content-width-controls.test.mjs`

Expected: all Section width tests PASS.

- [ ] **Step 5: Commit the Section width deliverable**

```bash
git add sections/section.liquid snippets/section.liquid tests/section-content-width-controls.test.mjs
git commit -m "feat(section): add optional content max width"
```

### Task 3: Integrated verification and PR update

**Files:**
- Verify: `sections/story-video.liquid`
- Verify: `sections/section.liquid`
- Verify: `snippets/section.liquid`
- Verify: `tests/*.test.mjs`

**Interfaces:**
- Consumes: the two independently committed deliverables.
- Produces: verified commits pushed to the existing PR #84 branch.

- [ ] **Step 1: Run all repository regression tests**

Run: `node --test tests/*.test.mjs`

Expected: all tests PASS with zero failures.

- [ ] **Step 2: Run scoped Theme Check**

Run: `shopify theme check sections/story-video.liquid sections/section.liquid snippets/section.liquid`

Expected: zero new offenses in the changed files. If the installed CLI accepts only a directory, run the repository check and distinguish pre-existing baseline offenses from changed-file offenses.

- [ ] **Step 3: Inspect the final diff against the PR branch base**

Run: `git diff --check && git status --short && git diff origin/main...HEAD -- sections/story-video.liquid sections/section.liquid snippets/section.liquid tests`

Expected: no whitespace errors, only intended files changed, and both requirements visibly wired from schema to CSS.

- [ ] **Step 4: Push the existing PR branch**

Run: `git push origin codex/story-video-editor-controls`

Expected: push succeeds and PR #84 updates without creating a new PR.
