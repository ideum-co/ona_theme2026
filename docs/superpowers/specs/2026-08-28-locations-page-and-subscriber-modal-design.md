# Locations page and subscriber modal migration

## Objective

Migrate the published ONA Locations experience into the 2026 theme as a dedicated, editable Shopify page template, and integrate the existing Dotdigital new-subscriber campaign globally without duplicating or rebuilding its externally managed form.

## Source audit

The exported theme contains:

- `templates/page.location.json`, composed of page title, store finder, flagship intro, and locations content sections.
- `sections/ona-store-finder.liquid`, a newer store finder that reads `store_location` and `store_tag` metaobjects.
- `sections/ona-locations-content.liquid`, a legacy flagship section that ignores most of its schema blocks and instead reads the `flagship-stores` blog plus Accentuate metafields.
- `assets/ona-store-finder.js` and `assets/map-active.svg`, required by the newer finder.
- A hardcoded Dotdigital `popoverv3.js` campaign loader in `layout/theme.liquid` for campaign `7M6W-AH9/welcomenewsletter`.

The legacy global stylesheet and jQuery-based location scripts will not be copied.

## Page template architecture

Create `templates/page.locations.json`. This is a new alternate page template and does not replace `templates/page.json` or modify any existing page/template instance.

The template contains three editable sections:

1. **Locations header**
   - Page title fallback with an optional custom title.
   - Rich-text introduction.
   - Theme-editor controls for typography, colors, width, alignment, and spacing.

2. **Store finder**
   - Reads `shop.metaobjects.store_location.values`.
   - Reads `shop.metaobjects.store_tag.values` for venue filters.
   - Supports text/address search, state and tag filters, distance filtering, geolocation, list/map views, result count, directions, external website links, and responsive layouts.
   - Loads a dedicated JavaScript asset once and uses a section-scoped configuration object.
   - Google Maps API key is supplied through a section setting. No API key from the exported theme is committed.
   - Missing coordinates exclude only the affected location from map results.
   - Missing API key or Maps load failure leaves the list usable and shows a non-blocking map status.

3. **Flagship locations**
   - Reads the same `store_location` entries and selects those carrying a `store_tag` whose slug is `flagship`.
   - Uses the existing fields referenced by the finder: title, address, hours, website, overview, and image.
   - Uses optional `gallery` images when that field is available; otherwise falls back to `image`.
   - Supports an editable section heading, introduction, color treatment, content width, image presentation, and spacing.
   - Does not read the `flagship-stores` blog or Accentuate metafields.

## Metaobject requirements

The Shopify admin remains the source of location records. The theme cannot create or alter metaobject definitions.

Existing requirements:

- `store_location`: `title`, `storeaddress`, `suburb`, `state`, `latitude`, `longitude`, `time`, `overview`, `storeaddressurl`, `image`, and `tags`.
- `store_tag`: `label` and `slug`.

Migration requirements:

- Create or reuse a `store_tag` record with slug `flagship`.
- Assign that tag to each flagship `store_location`.
- Optionally add `gallery` to `store_location` as a list of file/image references. The section remains functional without it.

No store records are mutated by theme code.

## Dotdigital integration

The theme continues using the externally managed Dotdigital campaign:

- Domain: `news.onacoffee.com.au`.
- Campaign path: `7M6W-AH9/welcomenewsletter`.
- Delay: 2 seconds.
- Cookie expiry: 365 days.
- Hide after submission: enabled.
- Existing campaign design, email/mobile fields, eligibility rules, submission handling, and discount behavior stay in Dotdigital.

Create a dedicated snippet for the loader and render it once from `layout/theme.liquid`.

Add global Theme settings:

- Enable new-subscriber modal.
- Dotdigital campaign path, defaulting to the approved campaign.
- Delay in seconds, defaulting to 2.
- Cookie expiry in days, defaulting to 365.

Behavior:

- The external script is emitted only when the feature is enabled and the campaign path is present.
- It is not emitted during Shopify design mode, preventing the modal from blocking the editor.
- The URL parameters are escaped and generated in one place.
- The integration does not reproduce or intercept subscriber data inside Shopify.
- The Dotdigital chat app embed is independent and is not changed.
- The old hardcoded script is not copied alongside the snippet, preventing duplicate modals.

## Editing and data boundaries

Template JSON stores only section composition and safe presentation defaults. Location content remains in metaobjects so it can be shared by the finder and flagship section.

The migration will not modify:

- `templates/index.json`;
- existing alternate page templates;
- homepage settings;
- existing metaobject records;
- app embed configuration in `config/settings_data.json`.

## Accessibility and responsive behavior

- Search and filters retain explicit labels and keyboard-operable buttons.
- List/map toggles expose their selected state.
- Map failure does not hide the accessible location list.
- Flagship galleries use meaningful image alt text and keyboard-operable controls when multiple images exist.
- Desktop and mobile layouts are implemented without the exported theme's jQuery dependency.
- Motion respects `prefers-reduced-motion`.

## Verification

Automated regression tests verify:

- the new template references only available migrated sections;
- the template remains separate from `page.json`;
- sections expose their intended editor settings;
- finder data comes from `store_location` and `store_tag`;
- flagship data uses the `flagship` tag and contains an image fallback;
- no Accentuate or `blogs.flagship-stores` dependency exists in migrated files;
- no Google Maps key from the export is committed;
- Dotdigital is rendered once, uses the approved defaults, is guarded by enablement and design mode, and is not duplicated;
- `templates/index.json` and `config/settings_data.json` are unchanged.

Run the complete repository test suite, Theme Check on changed Liquid files, JavaScript syntax/lint checks available in the repository, and `git diff --check` before delivery.

