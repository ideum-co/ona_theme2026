# Product introduction layout controls

## Objective

Add layout controls to the **Product introduction** section so merchants can constrain its inner content while its background continues to span the viewport.

## Scope

The change is limited to `sections/product-intro.liquid` and focused automated tests. It must not modify `templates/index.json` or any other template JSON because merchants are actively adjusting instance values in the theme customizer.

## Customizer controls

Add the following settings to the section schema:

- **Media width:** `narrow`, `medium`, or `wide`; default `medium`.
- **Media height:** `auto`, `small`, `medium`, `large`, or `full screen`; default `medium`.
- **Section width:** `page-width` or `full-width`; default `page-width`.
- **Limit content width:** checkbox; default enabled.
- **Max width:** range from 800px to 1800px in 20px steps; default 1280px. Show it only when content width limiting is enabled.

Existing section instances will retain every value already stored in template JSON. New schema defaults apply only where Shopify has no saved value.

## Layout behavior

The section background color and optional background image remain on the outer section element and therefore always span the full viewport width.

Introduce an inner layout wrapper around the existing wordmark, media, and details columns:

- `full-width` allows the inner layout to use the full available width.
- `page-width` applies the theme's standard page margins.
- When **Limit content width** is enabled, the inner wrapper is capped at **Max width** and centered.
- **Media width** changes only the desktop column proportions. Mobile remains a single-column layout.
- **Media height** controls the media area's block size using the theme's existing responsive height scale; `auto` preserves the media's natural sizing.

The existing model and image rendering paths, typography, colors, buttons, spacing, and responsive ordering remain unchanged.

## Compatibility and fallbacks

Liquid defaults will mirror the schema defaults so existing instances without saved values render safely. The implementation will not rename existing settings or change product, image, model, typography, color, or spacing values.

The section does not expose **Extend media to screen edge**. Its media occupies the center of a three-column layout, so extending it horizontally would overlap either the wordmark or the details. The required outcome is instead achieved by constraining the complete inner grid while leaving the outer background full width.

## Verification

Focused tests will verify:

- all five schema controls, their options, defaults, ranges, and visibility conditions;
- the outer full-width background remains separate from the constrained inner wrapper;
- each setting is wired to layout classes or CSS custom properties;
- `templates/index.json` is unchanged by the feature.

Run the repository test suite, Theme Check for changed Liquid files, and `git diff --check` before opening a pull request.
