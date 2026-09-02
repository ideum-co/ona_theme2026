# Task 4: Flagship locations migration

## Delivered

- Replaced the flagship shell with a section backed by `shop.metaobjects.store_location.values`.
- Selects a location only after a related `store_tag` has the exact slug `flagship`.
- Renders the established location fields: title, address/suburb/state, hours, overview, website, and image media.
- Uses renderable images from the optional `gallery` list and falls back to the existing `image` when the gallery is missing, empty, or contains no renderable image preview.
- Adds a dependency-free custom-element gallery with native previous/next buttons, Arrow Left/Right, Home, and End navigation, a polite position status, swipe/scroll support, and reduced-motion-aware scrolling. Interactive controls and focusable carousel semantics render only when there is more than one image.
- Adds editor controls for heading, introduction, website link copy, content width, alignment, aspect ratio, media fit, colors, and section spacing.
- Uses section-scoped styles plus the theme's `contrast-override` and `spacing-style` helpers, responsive single-column behavior, escaped visible scalar fields, Shopify metafield rendering for structured hours/overview, and safe external-link attributes.

## TDD evidence

### Initial RED

Command:

```sh
node --test tests/locations-flagships.test.mjs
```

Result against the untouched one-heading shell:

```text
tests 8
pass 1
fail 7
```

The expected failures covered the missing `store_location`/`flagship` relation branch, content fields, gallery/fallback, gallery asset and keyboard behavior, editor settings, and asset loading. The legacy-dependency guard was already passing.

### Initial GREEN

Commands:

```sh
node --test tests/locations-flagships.test.mjs
node --check assets/locations-flagships.js
```

Result:

```text
tests 8
pass 8
fail 0
JavaScript syntax: exit 0
```

### Self-review RED/GREEN: unusable gallery references

Self-review found that a nonempty `gallery` with no renderable image preview could mask the existing `image` fallback. A regression contract was added first.

RED:

```text
tests 9
pass 8
fail 1
AssertionError: the image fallback must be selected after gallery references are checked for renderable previews
```

After separating gallery usability from the displayed media count:

```text
tests 9
pass 9
fail 0
```

### Theme parser RED/GREEN

The first fresh Theme Check caught an HTML/Liquid balance error caused by two conditional viewport opening tags:

```text
LiquidHTMLSyntaxError: Attempting to close HtmlElement 'div' before HtmlElement 'locations-flagship-gallery' was closed
```

The viewport now has one balanced opening tag with only its keyboard and carousel attributes conditional. A fresh JSON Theme Check has zero records for `sections/locations-flagships.liquid`.

## Final verification

```text
node --test tests/locations-flagships.test.mjs
9 passing, 0 failing

node --test tests/*.test.mjs
48 passing, 0 failing

node --check assets/locations-flagships.js
exit 0

git diff --check
exit 0, no output

git diff --exit-code -- templates/index.json templates/page.json config/settings_data.json templates/page.locations.json
exit 0, no output

forbidden dependency/key scan over the migrated section and asset
exit 0, no matches
```

Filtered Theme Check command:

```sh
shopify theme check --path . --output json --no-color
```

The fresh JSON output contains no record for `sections/locations-flagships.liquid`, meaning zero flagship-section offenses. The repository-wide command exits 1 because of unrelated pre-existing findings in other theme files.

## Files

- `sections/locations-flagships.liquid`
- `assets/locations-flagships.js`
- `tests/locations-flagships.test.mjs`
- `.superpowers/sdd/2026-08-28-locations-page-migration/task-4-report.md`

## Commit

- `6bf6db1 feat: migrate flagship locations`

## Self-review

- Confirmed `is_flagship` resets for each record and becomes true only through a related tag whose slug is `flagship`; no metaobject data is mutated.
- Confirmed the field names match the finder contract (`title`, `storeaddress`, `suburb`, `state`, `time`, `overview`, `storeaddressurl`, `image`, `tags`) and the optional migration field is `gallery`.
- Confirmed missing or unusable gallery values fall back to `location.image.value`, while a location with no media still renders its text content.
- Confirmed gallery controls, focusable carousel semantics, listeners, and live status exist only for multiple rendered images. Buttons are natively keyboard operable, the viewport supports Arrow Left/Right plus Home/End, and CSS/JavaScript both respect reduced-motion preference.
- Confirmed image alt text prefers managed media alt text and otherwise identifies the flagship plus gallery position when multiple images exist.
- Confirmed scalar text is escaped, rich metaobject fields use Shopify's `metafield_tag`, and external websites use `target="_blank"` with `rel="noopener noreferrer"`.
- Confirmed the implementation contains no blog dependency, Accentuate reference, jQuery, hardcoded API key, global data mutation, or changes to protected templates/settings data or `page.locations` composition.

## Concerns

- A live Shopify Theme Editor/storefront smoke test was not available locally, so the final gallery rendering should still be previewed with real `store_location.gallery` file references and the store's actual metaobject field definitions.
- Repository-wide Theme Check remains nonzero because of unrelated pre-existing offenses; the flagship section itself has zero reported offenses.
