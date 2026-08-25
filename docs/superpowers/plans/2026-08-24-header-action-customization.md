# Header Action Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved desktop header action strip with exact icon assets and expose button text size, shared icon size, and independent transparent/solid state colors in the Shopify editor.

**Architecture:** `sections/header.liquid` owns merchant settings and publishes state-aware CSS variables. `snippets/header-actions.liquid` owns the ordered account/search/cart sequence, while `snippets/header-row.liquid` continues appending the menu trigger last. Three cleaned SVG assets provide the approved geometry and use `currentColor` so one state variable controls all icons.

**Tech Stack:** Shopify Liquid, section schema JSON, CSS custom properties, SVG, Node.js built-in test runner, Shopify Theme Check.

## Global Constraints

- Work only in `ideum-co/ona_theme2026` on `codex/header-action-customization` based on current `main`.
- Desktop order is exactly Shop, Subscribe, Customer account, Search, Shopping bag, Menu.
- Use the supplied user, search, and bag SVG geometry; remove Illustrator metadata and fixed white fills.
- Preserve existing Shop and Subscribe destinations, account behavior, search modal, cart drawer/link and count, and menu drawer behavior.
- Preserve current mobile behavior; this project does not redesign the mobile header.
- Transparent homepage and solid/sticky/internal states have independent button and icon colors.
- Button text size is shared by Shop and Subscribe; icon size is shared by account, search, bag, and menu.
- Visual icon size must not reduce existing interactive target dimensions.

---

### Task 1: Approved SVG assets and ordered desktop actions

**Files:**
- Create: `assets/icon-header-user.svg`
- Create: `assets/icon-header-search.svg`
- Create: `assets/icon-header-bag.svg`
- Modify: `sections/header.liquid`
- Modify: `snippets/header-actions.liquid`
- Modify: `snippets/search.liquid`
- Create: `tests/header-action-customization.test.mjs`

**Interfaces:**
- Consumes: source SVG files from `/Users/usuario/Downloads/icon-user.svg`, `/Users/usuario/Downloads/icon-search.svg`, and `/Users/usuario/Downloads/icon-bag.svg`.
- Produces: `header-actions` parameter `search_markup`; theme assets `icon-header-user.svg`, `icon-header-search.svg`, and `icon-header-bag.svg`; desktop order Shop, Subscribe, account, search, bag, then the row-owned menu trigger.

- [ ] **Step 1: Write the failing asset and order test**

Create `tests/header-action-customization.test.mjs` to read the Header section, Header actions snippet, Search snippet, Header row, and the three new assets. Assert that the assets exist, preserve `viewBox="0 0 27 29.4"`, contain `currentColor`, contain neither `#fff` nor `AdobeIllustrator`/`aipgf`; assert the section passes `search_markup` into `header-actions`; assert the snippet output order is account markup, `{{ search_markup }}`, then cart markup; assert quick links precede the `header-actions` render and Header row appends `first` after `actions` in the right column. Assert each existing interaction hook remains: Shopify account element, search modal click target, cart drawer trigger or cart URL, cart live region, and menu drawer trigger.

- [ ] **Step 2: Run the new test and verify RED**

Run: `node --test tests/header-action-customization.test.mjs`

Expected: FAIL because the optimized assets and `search_markup` interface do not exist.

- [ ] **Step 3: Create optimized theme-owned icons**

Copy only the source `viewBox` and path geometry into minimal SVG assets. Use this structure for each asset:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 27 29.4" fill="currentColor" aria-hidden="true">
  <!-- Original path geometry only; no defs, style, metadata, or fixed fill. -->
</svg>
```

- [ ] **Step 4: Wire the ordered desktop action sequence**

Move the `capture actions` block in `sections/header.liquid` below the search capture so it can pass the captured desktop search markup:

```liquid
capture actions
  echo '<span class="header-quick-links">...Shop...Subscribe...</span>'
  render 'header-actions', customer_account_menu: section.settings.customer_account_menu, display_style: section.settings.actions_display_style, section: section, search_markup: search
endcapture
```

Update the Header actions doc contract, replace inline account/cart icons with the approved assets, and render `{{ search_markup }}` after account and before cart. Update `snippets/search.liquid` to use `icon-header-search.svg`. Prevent the separate desktop Header row search item from rendering while retaining the existing mobile duplicate and search modal behavior.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `node --test tests/header-action-customization.test.mjs`

Expected: all header asset/order assertions PASS.

- [ ] **Step 6: Commit the ordered action deliverable**

```bash
git add assets/icon-header-user.svg assets/icon-header-search.svg assets/icon-header-bag.svg sections/header.liquid snippets/header-actions.liquid snippets/search.liquid tests/header-action-customization.test.mjs
git commit -m "feat(header): use approved ordered action icons"
```

### Task 2: Header action sizes and state colors

**Files:**
- Modify: `sections/header.liquid`
- Modify: `snippets/header-actions.liquid`
- Modify: `snippets/header-drawer.liquid`
- Modify: `tests/header-action-customization.test.mjs`

**Interfaces:**
- Consumes: section settings `quick_link_font_size`, `header_icon_size`, `solid_action_button_background`, `solid_action_button_text`, `solid_action_icon_color`, `transparent_action_button_background`, `transparent_action_button_text`, and `transparent_action_icon_color`.
- Produces: effective CSS variables `--header-action-button-background`, `--header-action-button-text`, `--header-action-icon-color`, `--header-quick-link-font-size`, and `--header-action-icon-size`.

- [ ] **Step 1: Extend the test with the full schema contract**

Assert these exact schema definitions:

```js
{
  quick_link_font_size: { type: 'range', min: 12, max: 28, step: 1, unit: 'px', default: 16 },
  header_icon_size: { type: 'range', min: 16, max: 40, step: 1, unit: 'px', default: 27 },
  solid_action_button_background: { type: 'color', default: '#8a1238' },
  solid_action_button_text: { type: 'color', default: '#ffffff' },
  solid_action_icon_color: { type: 'color', default: '#4b0b16' },
  transparent_action_button_background: { type: 'color', default: '#8a1238' },
  transparent_action_button_text: { type: 'color', default: '#ffffff' },
  transparent_action_icon_color: { type: 'color', default: '#ffffff' }
}
```

Assert the section publishes all solid and transparent source variables with Liquid `default` fallbacks, the normal state maps effective variables to solid values, and the actual transparent selector maps them to transparent values. Assert Shop/Subscribe consume button background/text/font size. Assert account, search, bag, and menu consume the shared effective icon color/size. Assert interactive parents retain `min-width`/`min-height` of `var(--minimum-touch-target)` or the existing equivalent.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/header-action-customization.test.mjs`

Expected: FAIL because the new settings and state variables are absent.

- [ ] **Step 3: Add the Header actions schema group**

Under Header utilities, add literal, merchant-readable labels and the eight settings with the exact IDs, ranges, and defaults above. Group the six color settings under `Solid header colors` and `Transparent header colors` schema headers.

- [ ] **Step 4: Publish safe source and effective variables**

On `#header-component`, emit the configured values with explicit defaults. Define the effective variables from the solid sources by default. In the selector that represents the active transparent state, remap only the three effective color variables to their transparent sources. Keep size variables state-independent.

- [ ] **Step 5: Apply button and icon variables without shrinking targets**

Style `.header-quick-links .button` with the effective background, text color, and font size. Style only SVG/icon wrappers with the shared icon size; keep action buttons and the menu summary at their existing minimum target size. Apply `currentColor` through the effective icon color to account, search, bag, and menu, including hover and sticky transitions.

- [ ] **Step 6: Run the focused and full tests and verify GREEN**

Run: `node --test tests/header-action-customization.test.mjs && node --test tests/*.test.mjs`

Expected: all header assertions and all repository regression tests PASS.

- [ ] **Step 7: Commit the customization controls**

```bash
git add sections/header.liquid snippets/header-actions.liquid snippets/header-drawer.liquid tests/header-action-customization.test.mjs
git commit -m "feat(header): add action size and state color controls"
```

### Task 3: Integrated verification and pull request

**Files:**
- Verify: `assets/icon-header-user.svg`
- Verify: `assets/icon-header-search.svg`
- Verify: `assets/icon-header-bag.svg`
- Verify: `sections/header.liquid`
- Verify: `snippets/header-actions.liquid`
- Verify: `snippets/header-drawer.liquid`
- Verify: `snippets/search.liquid`
- Verify: `tests/header-action-customization.test.mjs`

**Interfaces:**
- Consumes: Tasks 1 and 2 commits.
- Produces: a verified branch and pull request against current `main`.

- [ ] **Step 1: Run all regression tests**

Run: `node --test tests/*.test.mjs`

Expected: every test passes with zero failures.

- [ ] **Step 2: Run repository validation**

Run: `git diff --check` and Shopify Theme Check. If the installed CLI cannot check individual files, run the repository check and separately report offenses intersecting changed Liquid files versus the pre-existing baseline.

- [ ] **Step 3: Inspect the complete branch diff**

Run: `git diff origin/main...HEAD -- assets/icon-header-user.svg assets/icon-header-search.svg assets/icon-header-bag.svg sections/header.liquid snippets/header-actions.liquid snippets/header-drawer.liquid snippets/search.liquid tests/header-action-customization.test.mjs`.

Expected: only the approved header action scope is present; order and state wiring are visible; mobile behavior and interaction hooks remain intact.

- [ ] **Step 4: Push and open a pull request**

Push `codex/header-action-customization` and create one PR against `main`. Do not merge it. The PR description must name the exact desktop order, list all editor controls, identify the supplied SVG assets, and include fresh test and Theme Check evidence.
