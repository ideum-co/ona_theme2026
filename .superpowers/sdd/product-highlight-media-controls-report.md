# Product highlight media controls

## Scope delivered

- Added a 40–70% Media width range control in 5% steps, defaulting to 50%.
- Added Image fit choices for cover, contain, and fill, with cover as the default.
- Published the controls as section-scoped CSS variables.
- Used `minmax(0, ...)` desktop grid tracks for both right and left media layouts; mobile retains the existing single-column grid below 750px.
- Derived the responsive image `sizes` value in Liquid so it emits the configured desktop width and `100vw` on mobile.
- Left template JSON and `config/settings_data.json` unchanged.

## TDD evidence

- RED: `node --test tests/product-highlight-media-controls.test.mjs` failed because `media_width` was absent.
- GREEN: the focused test passed after implementation.
- A second RED/GREEN cycle corrected the image `sizes` construction so Liquid builds the value before it reaches `image_tag`.

## Verification

- `node --test tests/*.test.mjs` — 74 passing, 0 failing.
- `git diff --check` — clean.
- Protected-file diff against `HEAD` for `templates/*.json` and `config/settings_data.json` — no changes.
- Filtered Theme Check output for `sections/product-highlight.liquid` — no offenses.

## Known baseline concern

`shopify theme check --no-color` inspects 385 files and reports 242 existing offenses across 42 unrelated files (mostly translation parity and duplicate static-block IDs). Those were not changed in this task.
