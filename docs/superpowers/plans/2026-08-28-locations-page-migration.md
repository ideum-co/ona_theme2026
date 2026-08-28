# Locations Page Migration Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-08-28-locations-page-and-subscriber-modal-design.md`

**Goal:** Add an editable `page.locations` template that reproduces the Locations experience using native theme sections and the existing location metaobjects, without changing existing template JSON or Theme Editor data.

**Architecture:** The alternate page template composes a header, a metaobject-backed store finder, and a metaobject-backed flagship presentation. Each section owns its schema and scoped styling; the interactive sections use dedicated, dependency-free JavaScript assets. The location list remains functional when Google Maps or geolocation is unavailable.

**Constraints:** Do not edit `templates/index.json`, `templates/page.json`, or `config/settings_data.json`. Do not copy the exported API key, jQuery code, Accentuate dependencies, or `flagship-stores` blog dependency.

## Task 1: Lock the template contract with tests

**Files:**
- Create: `tests/locations-page-template.test.mjs`
- Create: `templates/page.locations.json`
- Create: `sections/locations-header.liquid`
- Create: `sections/locations-store-finder.liquid`
- Create: `sections/locations-flagships.liquid`

1. Write a failing Node test that asserts the alternate template exists, references exactly the three migrated section types, and leaves `page.json` separate.
2. Assert all referenced section files exist and expose valid section schemas.
3. Create the minimal template and section shells with safe presentation defaults.
4. Run `node --test tests/locations-page-template.test.mjs` and commit the passing contract.

## Task 2: Build the editable locations header

**Files:**
- Modify: `sections/locations-header.liquid`
- Modify: `tests/locations-page-template.test.mjs`

1. Add tests for page-title fallback, custom heading, rich text, content width, alignment, color scheme, and section spacing controls.
2. Implement semantic heading and rich-text markup with section-scoped CSS variables.
3. Verify empty optional content does not create unwanted spacing.
4. Run the focused test and `shopify theme check sections/locations-header.liquid` when the CLI is available.

## Task 3: Migrate the store finder

**Files:**
- Modify: `sections/locations-store-finder.liquid`
- Create: `assets/locations-store-finder.js`
- Create: `assets/map-active.svg`
- Create: `tests/locations-store-finder.test.mjs`

1. Add failing tests proving data comes from `shop.metaobjects.store_location.values` and `shop.metaobjects.store_tag.values`, no API key is hardcoded, and accessible labels/status controls exist.
2. Render a section-scoped JSON payload containing only normalized location/tag fields and editor settings.
3. Add schema controls for copy, Google Maps key, default view/radius, enabled filters, content width, colors, and spacing.
4. Implement a custom element supporting text search, state/tag/radius filters, result count, geolocation, list/map toggle, directions, and external links.
5. Load Google Maps only when a key exists. If loading/geolocation/coordinates fail, preserve the location list and show a non-blocking status.
6. Verify keyboard interaction, selected toggle state, responsive behavior, and reduced motion.
7. Run the focused tests plus `node --check assets/locations-store-finder.js`.

## Task 4: Replace the legacy flagship dependency

**Files:**
- Modify: `sections/locations-flagships.liquid`
- Create: `assets/locations-flagships.js`
- Create: `tests/locations-flagships.test.mjs`

1. Add failing tests proving the section filters `store_location` records by a related `store_tag` whose slug is `flagship`.
2. Assert migrated files contain neither `blogs.flagship-stores` nor Accentuate references.
3. Render title, address, hours, overview, website, and an image gallery; use optional `gallery` values and fall back to `image`.
4. Add editor controls for heading/introduction, width, colors, media presentation, alignment, and spacing.
5. Implement keyboard-operable gallery controls only when multiple images exist, with useful alt text and reduced-motion behavior.
6. Run the focused tests and `node --check assets/locations-flagships.js`.

## Task 5: Document Shopify admin migration and verify

**Files:**
- Create: `docs/locations-metaobject-migration.md`
- Modify: relevant tests only if verification exposes a gap

1. Document assigning `page.locations`, creating/reusing the `flagship` tag, assigning it to records, optionally adding `gallery`, and supplying the Google Maps key in the section setting.
2. Run all repository tests, JavaScript syntax checks, Theme Check on changed Liquid, and `git diff --check`.
3. Confirm `git diff origin/main -- templates/index.json templates/page.json config/settings_data.json` is empty.
4. Review the page in Shopify Theme Editor at desktop and mobile widths before opening the PR.

