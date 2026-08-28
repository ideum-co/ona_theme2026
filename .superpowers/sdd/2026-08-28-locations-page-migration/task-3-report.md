# Task 3: Store finder migration

## Delivered

- Replaced the store-finder shell with a progressively enhanced, metaobject-backed location list.
- Reads `shop.metaobjects.store_location.values` and `shop.metaobjects.store_tag.values`; location cards with missing coordinates remain in the list and are excluded only from distance results or map markers.
- Emits one section-scoped JSON payload containing normalized location/tag fields and editor settings. It does not serialize raw metaobjects.
- Added editable copy, Google Maps key, default list/map view, default radius, filter enablement, content width, colors, and spacing.
- Added dependency-free custom-element behavior for text/address search, state/tag/radius filtering, result counts, geolocation, list/map toggles, lazy Google Maps loading, directions, and website links.
- Added native focus styles, explicit form labels, live status/count regions, `aria-pressed` view state, labelled result panels/pagination, responsive layouts, and motion only under `prefers-reduced-motion: no-preference`.
- Added a theme-native SVG map marker and accessible Shopify pagination beyond the 250-entry Liquid page-size limit.

## TDD evidence

### Initial RED

Command:

```sh
node --test tests/locations-store-finder.test.mjs
```

Result: 0 passing, 7 failing. The failures were the expected missing contracts in the original one-heading shell:

```text
tests 7
pass 0
fail 7
```

Representative failures:

```text
The input did not match /for location in shop.metaobjects.store_location.values/
heading must be a text setting
assets/locations-store-finder.js must exist
```

### First GREEN

Commands:

```sh
node --test tests/locations-store-finder.test.mjs
node --check assets/locations-store-finder.js
```

Result: 7 passing, 0 failing; JavaScript syntax check exited 0.

### Self-review RED/GREEN: disabled radius

Self-review found that geolocation would still apply the configured default radius when the radius control was disabled. A regression test was added first.

RED:

```text
tests 8
pass 7
fail 1
AssertionError: the finder must resolve whether radius filtering is active
```

After adding `radiusForFilter` and using it from the custom element:

```text
tests 8
pass 8
fail 0
```

### Data-volume RED/GREEN

Shopify Liquid currently supports at most 250 metaobject values per pagination page. A test was added to prevent records after that boundary from becoming unreachable.

RED:

```text
tests 9
pass 8
fail 1
AssertionError: stores after the first 250 records must remain reachable through labelled pagination
```

After adding the labelled `default_pagination` fallback:

```text
tests 9
pass 9
fail 0
```

## Final verification

```text
node --test tests/locations-store-finder.test.mjs
9 passing, 0 failing

node --test tests/*.test.mjs
27 passing, 0 failing

node --check assets/locations-store-finder.js
exit 0

xmllint --noout assets/map-active.svg
exit 0

git diff --check
exit 0, no output

git diff --exit-code -- templates/index.json templates/page.json config/settings_data.json templates/page.locations.json
exit 0, no output
```

Filtered Theme Check command:

```sh
shopify theme check --path . --output json --no-color
```

The JSON output was filtered to `sections/locations-store-finder.liquid`: no matching record, meaning 0 finder offenses. The repository-wide command exits 1 because of existing unrelated findings: 236 errors and 5 warnings outside this finder.

## Files

- `sections/locations-store-finder.liquid`
- `assets/locations-store-finder.js`
- `assets/map-active.svg`
- `tests/locations-store-finder.test.mjs`
- `.superpowers/sdd/2026-08-28-locations-page-migration/task-3-report.md`

## Self-review

- Confirmed the server-rendered list is the baseline UI, so a missing key or Maps/geolocation/coordinate failure cannot remove store cards.
- Confirmed map scripts are requested only after a map-view request with a nonblank editor-supplied key; load errors switch back to the list with a polite status message.
- Confirmed only valid coordinates reach Google Maps markers; missing coordinates do not affect normal text/state/tag results.
- Confirmed the filter helpers return new arrays and do not mutate metaobject-derived location records.
- Confirmed all user-controlled JSON values use Shopify's `json` filter, visible text uses escaping or Shopify metafield rendering, and external URLs use `noopener noreferrer`.
- Confirmed native inputs, selects, links, and buttons provide keyboard operation; list/map state is exposed through `aria-pressed` and `aria-controls`.
- Confirmed responsive grid changes at 990px/640px and all transitions are gated behind the no-reduced-motion media query.
- Confirmed there is no hardcoded Google key, jQuery, Accentuate, `blogs.flagship-stores`, legacy global configuration, or location-data mutation.
- Confirmed no changes to `templates/index.json`, `templates/page.json`, `config/settings_data.json`, or `templates/page.locations.json`.

## Concerns

- A live Shopify Theme Editor/browser smoke test was not available locally. The Google Maps success path still needs a valid restricted key and enabled Maps JavaScript API in a store preview.
- When there are more than 250 locations, every record remains reachable via accessible pagination, but search and filters operate on the currently rendered page rather than aggregating all pages client-side.
- Repository-wide Theme Check remains nonzero because of unrelated pre-existing offenses; the finder itself has zero reported offenses.
