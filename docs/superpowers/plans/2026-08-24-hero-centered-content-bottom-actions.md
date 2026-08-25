# Hero Centered Content and Bottom Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Center the homepage Hero heading and description in both axes while pinning their existing button Group to a configurable 60px bottom offset.

**Architecture:** Add an opt-in Hero section modifier and a section-scoped CSS offset. CSS removes a direct button-containing Group from normal flow and bottom-centers that Group, leaving all other direct blocks centered; the homepage template enables the option and removes the Group’s obsolete 100px top-padding workaround.

**Tech Stack:** Shopify Liquid, JSON section templates, CSS, Node.js built-in test runner, Shopify Theme Check.

## Global Constraints

- Existing Hero sections and presets remain unchanged unless `pin_button_group_to_bottom` is enabled.
- Target only a direct `.group-block` whose `.group-block-content` contains a Button block; never depend on generated block IDs.
- Use one desktop/mobile offset from 0px to 200px, in 4px steps, defaulting to 60px.
- Preserve block editor attributes, button content/settings, animation, and Group responsive direction.
- Enable the option only for `hero_ona` and reset only `group_L3tYP4.settings.padding-block-start` to 0.

---

### Task 1: Hero center and bottom-action behavior

**Files:**
- Create: `tests/hero-centered-content-bottom-actions.test.mjs`
- Modify: `sections/hero.liquid`
- Modify: `templates/index.json`

**Interfaces:**
- Consumes: existing `.hero__content-wrapper`, `.group-block`, `.group-block-content`, and `.button` markup.
- Produces: settings `pin_button_group_to_bottom: boolean`, `button_group_bottom_spacing: number`; class `.hero--bottom-actions`; CSS variable `--hero-bottom-actions-offset`.

- [ ] **Step 1: Write the failing regression test**

Create `tests/hero-centered-content-bottom-actions.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hero = readFileSync(new URL('../sections/hero.liquid', import.meta.url), 'utf8');
const homepage = JSON.parse(readFileSync(new URL('../templates/index.json', import.meta.url), 'utf8'));
const schemaSource = hero.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/)?.[1];
assert.ok(schemaSource, 'Hero must contain a schema');
const schema = JSON.parse(schemaSource);
const setting = (id) => schema.settings.find((entry) => entry.id === id);

assert.equal(setting('pin_button_group_to_bottom')?.type, 'checkbox');
assert.equal(setting('pin_button_group_to_bottom')?.default, false);
assert.deepEqual(
  Object.fromEntries(['min', 'max', 'step', 'default'].map((key) => [key, setting('button_group_bottom_spacing')?.[key]])),
  { min: 0, max: 200, step: 4, default: 60 },
);
assert.match(hero, /hero--bottom-actions/);
assert.match(hero, /--hero-bottom-actions-offset:\s*\{\{ section\.settings\.button_group_bottom_spacing \| default: 60 \}\}px/);
assert.match(hero, /\.hero--bottom-actions \.hero__content-wrapper\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;/);
assert.match(hero, /\.hero--bottom-actions \.hero__content-wrapper > \.group-block:has\(> \.group-block-content \.button\)/);
assert.match(hero, /inset-inline-start:\s*50%;[\s\S]*?inset-block-end:\s*var\(--hero-bottom-actions-offset[\s\S]*?transform:\s*translateX\(-50%\);/);

const homepageHero = homepage.sections.hero_ona;
assert.equal(homepageHero.settings.pin_button_group_to_bottom, true);
assert.equal(homepageHero.settings.button_group_bottom_spacing, 60);
assert.equal(homepageHero.blocks.group_L3tYP4.settings['padding-block-start'], 0);

console.log('hero centered content and bottom actions regression harness: PASS');
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test tests/hero-centered-content-bottom-actions.test.mjs
```

Expected: FAIL because `pin_button_group_to_bottom` does not exist.

- [ ] **Step 3: Add the section settings and rendering hooks**

In `sections/hero.liquid`, append the modifier to the root Hero class only when enabled:

```liquid
{% if section.settings.pin_button_group_to_bottom %} hero--bottom-actions{% endif %}
```

Publish the offset in the root inline style only when enabled:

```liquid
{% if section.settings.pin_button_group_to_bottom %}
  --hero-bottom-actions-offset: {{ section.settings.button_group_bottom_spacing | default: 60 }}px;
{% endif %}
```

Add these schema settings immediately after `animate_content`:

```json
{
  "type": "checkbox",
  "id": "pin_button_group_to_bottom",
  "label": "Pin button group to bottom",
  "default": false
},
{
  "type": "range",
  "id": "button_group_bottom_spacing",
  "label": "Button group bottom spacing",
  "min": 0,
  "max": 200,
  "step": 4,
  "unit": "px",
  "default": 60,
  "visible_if": "{{ section.settings.pin_button_group_to_bottom }}"
}
```

- [ ] **Step 4: Add the opt-in positioning CSS**

Add to the Hero stylesheet:

```css
.hero--bottom-actions .hero__content-wrapper {
  position: absolute;
  inset: 0;
  align-items: center;
  justify-content: center;
}

.hero--bottom-actions .hero__content-wrapper > .group-block:has(> .group-block-content .button) {
  position: absolute;
  inset-inline-start: 50%;
  inset-block-end: var(--hero-bottom-actions-offset, 60px);
  width: min(100%, calc(100% - (2 * var(--page-margin, 1rem))));
  transform: translateX(-50%);
}
```

This selector excludes nested Groups and top-level Groups without buttons. Keep positioning on the Group wrapper so button animation transforms remain independent.

- [ ] **Step 5: Enable the homepage behavior**

In `templates/index.json`, add to `sections.hero_ona.settings`:

```json
"pin_button_group_to_bottom": true,
"button_group_bottom_spacing": 60
```

Change only this existing value:

```json
"group_L3tYP4": {
  "settings": {
    "padding-block-start": 0
  }
}
```

- [ ] **Step 6: Run targeted and complete tests**

Run:

```bash
node --test tests/hero-centered-content-bottom-actions.test.mjs
node --test tests/*.test.mjs
```

Expected: both commands PASS with zero failures.

- [ ] **Step 7: Validate Liquid and the diff**

Run:

```bash
git diff --check
shopify theme check --path . --output json --no-color | jq -e '[.[] | select(.path | endswith("sections/hero.liquid"))] | length == 0'
```

Expected: clean diff and `true` for zero Hero offenses.

- [ ] **Step 8: Commit the implementation**

```bash
git add sections/hero.liquid templates/index.json tests/hero-centered-content-bottom-actions.test.mjs
git commit -m "feat(hero): pin action group to bottom"
```
