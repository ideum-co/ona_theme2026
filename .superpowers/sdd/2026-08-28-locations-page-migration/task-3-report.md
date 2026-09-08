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

## Review fix round 1/5

### Findings addressed

1. **Zero-marker map fallback:** map selection now resolves marker availability before committing the selected view. An empty mapped result keeps list view active, updates `aria-pressed`, keeps the mobile list visible, and announces the configured no-coordinate status.
2. **Maps retry lifecycle:** every Maps script rejection now removes its listeners, marks and removes the failed node, and clears the shared promise. A second attempt creates a fresh script and can resolve normally.
3. **Finder-wide pagination:** the section exposes `paginate.next.url`; the custom element follows each page through Shopify's Section Rendering API, parses the inert response document, extracts only normalized JSON and location-card nodes, validates card/data alignment, deduplicates locations together with their corresponding cards, and applies filters/counts after the complete aggregate is committed.
4. **Stale map status:** when filtering restores one or more mapped results, only the stale no-coordinate message is cleared; unrelated geolocation or failure status remains intact.
5. **Behavioral test coverage:** pure state transition, loader lifecycle, section-URL construction, page traversal, deduplication, alignment, later-page search, and repeated-cursor guards now supplement the Liquid contract assertions.

The accessible server-rendered pagination remains visible while aggregation is pending and whenever any fetch/parse/validation step fails. It is hidden only after every page has loaded successfully. Since aggregation is atomic, a failure leaves the current server-rendered cards, data, and pagination unchanged and writes a nonblocking message to the existing polite status region. Parsed section scripts are never appended or evaluated; only selected `data-location-card` elements move into the live list.

### RED evidence

#### Map availability transitions

Command:

```sh
node --test tests/locations-store-finder.test.mjs
```

Result before implementation:

```text
tests 11
pass 9
fail 2
AssertionError: the finder must expose its map availability transition
```

The two failures covered zero-coordinate map fallback and stale-status clearing when mapped results return.

#### Maps loader retry

Command:

```sh
node --test tests/locations-store-finder.test.mjs
```

Result before loader cleanup:

```text
tests 12
pass 11
fail 1
AssertionError: the terminally failed script must be removed
```

The same test continues through a second attempt after cleanup, verifies that a new script node is created, and resolves it with the Maps object.

#### Cross-page aggregation

Command:

```sh
node --test tests/locations-store-finder.test.mjs
```

Initial result before the Section Rendering implementation:

```text
tests 14
pass 11
fail 3
failure: the enhanced finder must expose its next server-rendered result page
failure: the finder must build its scoped page request
failure: the finder must aggregate its server-rendered pages
```

The aggregation fixture places the only `perth` match on a later page and repeats the Sydney record there. Its literal expectations prove the later match is searchable, the duplicate is removed, and each retained location remains paired with its own card. A separate repeated-cursor test prevents cyclic page traversal.

### GREEN and final verification

```text
node --test tests/locations-store-finder.test.mjs
15 passing, 0 failing

node --test tests/*.test.mjs
33 passing, 0 failing

node --check assets/locations-store-finder.js
exit 0

git diff --check
exit 0, no output

git diff --exit-code -- templates/index.json templates/page.json config/settings_data.json templates/page.locations.json
exit 0, no output
```

Filtered Theme Check:

```sh
shopify theme check --path . --output json --no-color
```

Fresh JSON filtering found no record for `sections/locations-store-finder.liquid` (0 finder offenses). The repository-level command still exits 1 with 236 errors and 5 warnings in unrelated existing files.

### Files changed in this fix round

- `assets/locations-store-finder.js`
- `sections/locations-store-finder.liquid`
- `tests/locations-store-finder.test.mjs`
- `.superpowers/sdd/2026-08-28-locations-page-migration/task-3-report.md`

### Self-review

- The mobile list can no longer be hidden by an empty map selection because the resolved view becomes `list` before or during marker synchronization.
- Map status clearing compares against the exact no-coordinate copy, so geolocation and fetch error announcements are not erased accidentally.
- Both script `error` and a `load` event without `google.maps` flow through the same rejecting cleanup path; successful loads detach listeners and mark the retained script ready.
- Section page traversal is bounded by a visited-URL set. Duplicate normalized records are skipped together with their paired card, and every page is rejected if its card count differs from its location count.
- The DOM stays unchanged until all pages pass fetch, parse, cursor, and alignment checks. This preserves the server list and pagination on any intermediate failure.
- Section responses are parsed through `DOMParser`; only location card nodes from the inert document are appended. The response's module and JSON script elements are never inserted into the live document.
- Existing search, state, tag, radius, count, geolocation, external links, keyboard semantics, responsive layout, and reduced-motion behavior remain covered.
- No hardcoded API key, jQuery, Accentuate, `blogs.flagship-stores`, protected-file edit, or metaobject-record mutation was introduced.

### Remaining concerns

- The earlier page-local filtering concern is resolved for normal finder entry: later paginated pages are aggregated before final filter/count state and accessible pagination remains the failure fallback.
- A live Shopify Theme Editor test with a valid restricted Google Maps key was not available locally, so the real Section Rendering and Maps network success paths still require preview smoke testing.
- Repository-wide Theme Check remains nonzero only because of unrelated existing offenses; the finder remains clean in the filtered scan.

## Review fix round 2/5

### Findings and root causes

1. `applyFilters()` calculated a list fallback while Google Maps was pending, but it only called `syncMapMarkers()` when `this.map` already existed. The resolved view and no-coordinate announcement were therefore discarded during the async gap.
2. Pagination aggregation treated the currently rendered Liquid page as page one. A direct request to `?page=2` began at that page's `paginate.next.url`, so page one disappeared after enhancement hid the fallback pagination.
3. `locationSignature()` derived identity from visible fields. Different metaobjects with identical display content—and separate identity-less records—therefore collapsed into one result.

### RED evidence

#### Pending-Maps custom-element transition

The new behavioral test constructs the exported `LocationsStoreFinder`, begins a pending map transition, changes the active filter to an unmapped result, and asserts the host view state, map panel, both `aria-pressed` values, and polite status text.

Initial focused run after adding the test:

```text
node --test tests/locations-store-finder.test.mjs
tests 16
pass 15
fail 1
failure: the finder custom element must be testable
```

After exposing the production element, a mutation check removed only the new state-application branch and exercised the behavioral test directly:

```text
node --test --test-name-pattern="returns the actual custom element" tests/locations-store-finder.test.mjs
tests 1
pass 0
fail 1
AssertionError: the narrow-layout list visibility state must be restored
actual: map
expected: list
```

Restoring the branch produced 1 passing / 0 failing for the same targeted command.

#### Deterministic page-one aggregation

```text
node --test tests/locations-store-finder.test.mjs
tests 18
pass 15
fail 3
failure: enhancement must distinguish a direct entry on a later result page
failure: the finder must derive its first result page
failure: direct entry requested only page 3 rather than page 1, page 2, and page 3
```

The fixture starts on server-rendered page two and verifies the exact traversal order, all three paired records/cards, reindexed cards, and fallback-pagination state. A failure fixture also verifies that a failed page-one request leaves the original page-two records, cards, list, and pagination untouched.

#### Stable metaobject identity

```text
node --test tests/locations-store-finder.test.mjs
tests 20
pass 17
fail 3
failure: the card did not expose its normalized stable identity
failure: distinct-ID and identity-less visible duplicates were collapsed
failure: mismatched record/card identity was accepted
```

The aggregation fixture now repeats one stable ID, supplies a distinct ID with identical visible fields, and supplies two identical identity-less records. Literal assertions require only the repeated stable ID to be removed while card order remains aligned.

### GREEN implementation

- `applyFilters()` immediately applies a resolved view change and status, regardless of whether Maps has finished loading. The custom-element test verifies the CSS-driving `data-active-view`, hidden map panel, selected toggle state, and live status together.
- Liquid exposes `paginate.current_page`. Later-page entry derives a deterministic first-page URL by removing only `page` and Section Rendering's `section_id`, preserving other query parameters.
- Later-page enhancement fetches page one first, follows every returned next-page URL, builds the complete replacement fragment, and mutates the visible list only after successful traversal. The server-rendered page and pagination remain intact on rejection.
- Normalized location records and cards both carry `location.system.id`. Fetched pages validate record/card identity before aggregation.
- Deduplication uses only a nonblank stable ID. Records without an ID are retained rather than inferred equal from visible content.

### Round 2 files

- `assets/locations-store-finder.js`
- `sections/locations-store-finder.liquid`
- `tests/locations-store-finder.test.mjs`
- `.superpowers/sdd/2026-08-28-locations-page-migration/task-3-report.md`

### Round 2 self-review

- Direct entry on the final Liquid page also triggers page-one aggregation because `currentPage > 1` does not depend on a next link.
- The first-page URL preserves storefront query state other than pagination and stale `section_id`; Section Rendering adds the active finder section ID at request time.
- Aggregation remains non-mutating until every request, payload/card count, stable identity pairing, and pagination cursor validates.
- Reindexing is applied to every final card after aggregation, keeping filter records, focus targets, and DOM cards aligned.
- Stable identity values are not used as visible content, URLs, selectors, or mutable record fields.
- No protected composition/config files, hardcoded Google key, jQuery, legacy data source, or global location-data mutation were introduced.

### Round 2 verification

```text
node --test tests/locations-store-finder.test.mjs
21 passing, 0 failing

node --test tests/*.test.mjs
39 passing, 0 failing

node --check assets/locations-store-finder.js
exit 0

git diff --check
exit 0

git diff --exit-code -- templates/index.json templates/page.json templates/page.locations.json config/settings_data.json
exit 0
```

`shopify theme check --path . --output json --no-color` continues to exit 1 for unrelated repository findings (236 errors and 5 warnings). Filtering the JSON result for `sections/locations-store-finder.liquid` returns no entry: zero finder offenses.

### Round 2 concerns

- Live Shopify Section Rendering and Google Maps requests could not be smoke-tested without a connected storefront and valid editor-supplied Maps key.
- The unrelated repository-wide Theme Check findings remain outside this task.

## Final review fix wave

### Root causes

1. The Maps loader treated a `loading=async` script's `load` event as API readiness. It had no callback contract, authentication-failure hook, or readiness deadline, and finder instances could create duplicate maps while concurrent initialization awaited the shared loader.
2. Map mode was applied before initialization resolved, so no-JS/default markup and slow-load interactions could expose an empty map. A late resolve or reject could also override a newer List selection.
3. Finder loops referenced the ordinary metaobject collection rather than the active 250-entry paginate collection. Flagships had no paginate/Section Rendering path. The venue filter depended only on the first direct `store_tag.values` results.
4. `storeaddressurl` was rendered directly without an explicit type contract or scheme allowlist.

### TDD RED evidence

#### Maps lifecycle and view state

```text
node --test tests/locations-store-finder.test.mjs
tests 25
pass 18
fail 7
```

The failures proved that server markup did not always select List, pending initialization activated Map immediately, concurrent initialization ignored the injected loader and cache contract, script URLs lacked readiness callbacks, and auth/timeout failure paths did not exist.

A separate late-rejection regression was observed failing before its fix:

```text
node --test --test-name-pattern="ignores a stale Maps rejection" tests/locations-store-finder.test.mjs
tests 1
pass 0
fail 1
actual status: Map failed.
expected status: empty
```

#### Metaobject pagination and tag completeness

```text
node --test tests/locations-store-finder.test.mjs
tests 27
pass 25
fail 2
failure: finder cards/payload did not loop over the paginated all_locations collection
failure: locationTagOptions was unavailable for tag 51

node --test tests/locations-flagships.test.mjs
tests 12
pass 9
fail 3
failure: no paginated all_locations loop
failure: no accessible flagship pagination/loader contract
failure: loadAllFlagshipPages was unavailable
```

#### External URL schemes

```text
node --test tests/locations-store-finder.test.mjs
tests 28
pass 27
fail 1
TypeError: approvedExternalUrl is not a function

node --test tests/locations-flagships.test.mjs
tests 13
pass 12
fail 1
TypeError: approvedExternalUrl is not a function
```

The URL fixtures use literal HTTPS, uppercase HTTP, `javascript:`, and `data:` values. Both unsafe schemes must resolve to `null`, and both Liquid sections must route `storeaddressurl` through the shared server-rendering gate.

### GREEN implementation

- Google Maps now loads with a unique documented callback, a 15-second readiness timeout, `gm_authFailure`, script-error handling, and complete timer/script/callback/auth/partial-Google cleanup on rejection. Loader state resets so a later attempt starts cleanly.
- Each finder caches one connection-versioned initialization promise. Concurrent callers share one Map construction; rejection and disconnect clear the cache; stale disconnected completions cannot construct a map.
- Server markup always renders List selected. `setView('map')` keeps List visible until initialization succeeds, confirms Map is still requested, then activates it. Superseded resolve/reject results do not override the current view or status.
- Finder card and JSON loops use the active `all_locations` paginate collection. Existing atomic Section Rendering traversal still loads page 251 and beyond.
- Normalized records now carry related `{ label, slug }` tag options. The enhanced control merges these across every aggregated location with the initial direct tag values, so a related tag after entry 50 is selectable.
- Flagships now use 250-location server pages with labelled no-JS pagination. A dependency-free loader traverses every Section Rendering page, deduplicates only stable location IDs, appends only inertly parsed flagship cards after complete success, and preserves the current server page/pagination with a polite status on failure.
- `safe-external-url.liquid` emits only absolute `http://` and `https://` values. Finder and flagship links use this gate, while JavaScript repeats the allowlist before enhanced content remains active.
- Migration, plan, and shared-spec documentation now require `storeaddressurl` to be a Shopify `url` field and describe pagination/readiness behavior.
- Extra EOF blank lines were removed from the locations plan, shared specification, and Dotdigital plan.

### Files changed

- `assets/locations-store-finder.js`
- `assets/locations-flagships.js`
- `sections/locations-store-finder.liquid`
- `sections/locations-flagships.liquid`
- `snippets/safe-external-url.liquid`
- `tests/locations-store-finder.test.mjs`
- `tests/locations-flagships.test.mjs`
- `docs/locations-metaobject-migration.md`
- `docs/superpowers/plans/2026-08-28-locations-page-migration.md`
- `docs/superpowers/specs/2026-08-28-locations-page-and-subscriber-modal-design.md`
- `docs/superpowers/plans/2026-08-28-dotdigital-subscriber-modal.md`
- `.superpowers/sdd/2026-08-28-locations-page-migration/task-3-report.md`

### Self-review

- Callback cleanup restores a pre-existing `gm_authFailure` handler and the pre-attempt Google global rather than leaving loader-owned state behind.
- Script `load` alone cannot resolve the Maps promise; only the named readiness callback can do so.
- Map activation occurs after both global loader readiness and per-finder Map construction, and only while the same finder remains connected and Map remains the requested view.
- Finder and flagship aggregation remain atomic: fetched scripts are never appended, and server-rendered content/pagination stays usable through any request, parsing, or cursor failure.
- Identity-less locations are never collapsed; stable-ID repeats are removed with their paired cards.
- The finder obtains tag 51 from normalized location relationships and repopulates the actual select after cross-page aggregation.
- Liquid is the primary external-link gate, preserving safety without JavaScript. Client-side checks provide defense in depth.
- No hardcoded Maps key, jQuery, Accentuate, legacy flagship blog source, protected JSON edit, or source metaobject mutation was introduced.

### Final verification

```text
node --test tests/locations-store-finder.test.mjs
31 passing, 0 failing

node --test tests/locations-flagships.test.mjs
13 passing, 0 failing

node --test tests/locations-*.test.mjs
48 passing, 0 failing

node --test tests/*.test.mjs
62 passing, 0 failing

node --check assets/locations-store-finder.js
exit 0

node --check assets/locations-flagships.js
exit 0

xmllint --noout assets/map-active.svg
exit 0

git diff origin/main --check
exit 0

git diff --exit-code HEAD -- templates/index.json templates/page.json templates/page.locations.json config/settings_data.json
exit 0
```

Filtered Theme Check reports zero offenses for the two changed locations sections and `snippets/safe-external-url.liquid`. The repository command remains nonzero only for the existing unrelated 236 errors and 5 warnings.

The forbidden-source scan over the two locations assets, two sections, and safe URL snippet returns no hardcoded Google key, jQuery, Accentuate, or `blogs.flagship-stores` reference.

### Remaining concerns

- A connected Shopify storefront with more than 250 published locations, a tag outside the first 50 direct tag values, and a restricted Maps browser key was unavailable for a live network smoke test.
- Repository-wide Theme Check remains nonzero for unrelated existing files; all changed locations Liquid is clean in the filtered result.

## Final branch review fixes — 2026-09-07

### RED evidence

`node --test tests/collection-carousel-layout-controls.test.mjs tests/locations-store-finder.test.mjs` produced 33 passes, 2 failures, and 1 intentional skip before production changes:

- the mobile carousel rule did not consume `--collection-carousel-padding-mobile` or `--collection-carousel-card-gap-mobile`; it only reassigned inline desktop custom properties, which cannot override the element's inline declarations;
- after map activation, `gm_authFailure` was still the prior global handler, so the finder did not return to List or clean up its failed map.

### GREEN implementation

- The mobile breakpoint now applies its mobile padding directly to `.collection-carousel` and its mobile half-gap directly to `.collection-carousel__slide`. Desktop declarations, slide-width geometry, label alignment, and the 40/16 and 32/32 schema defaults are unchanged.
- Active map finders subscribe to one persistent module dispatcher after successful map initialization. A post-readiness authentication failure chains the pre-existing global handler, invalidates pending map work, detaches markers, clears map state, announces `mapErrorStatus`, and restores the accessible List/ARIA state.
- Finder disconnect removes its subscription. When the final subscriber disconnects, the dispatcher restores the exact prior `gm_authFailure` value without overwriting a handler installed by another owner.
- Collection and product protected-file assertions now run only when `ONA_PROTECTED_BASE_REF` is explicitly supplied. They validate the ref syntax and commit before comparing that base range, so local runs do not misleadingly compare only the working tree or depend on an unavailable remote.

### Verification evidence

```text
node --test tests/collection-carousel-layout-controls.test.mjs tests/product-highlight-media-controls.test.mjs tests/locations-store-finder.test.mjs
37 tests: 36 passing, 0 failing, 1 skipped (optional base-range assertion)

ONA_PROTECTED_BASE_REF=8173838 node --test tests/collection-carousel-layout-controls.test.mjs tests/product-highlight-media-controls.test.mjs
5 passing, 0 failing, 0 skipped

node --test tests/*.test.mjs
75 tests: 74 passing, 0 failing, 1 skipped (optional base-range assertion)

node --check assets/locations-store-finder.js
exit 0

node --check assets/locations-flagships.js
exit 0

shopify theme check --path . --output json --no-color | jq '<changed-file filter>'
[] (zero offenses in changed files)

git diff --name-only origin/main...HEAD -- templates/index.json templates/page.json templates/page.locations.json config/settings_data.json
templates/page.locations.json (the already-committed locations template addition; no final-wave protected-file edit)

git diff --name-only HEAD -- templates/index.json templates/page.json templates/page.locations.json config/settings_data.json
empty

git diff --check
exit 0
```

The unfiltered Theme Check remains nonzero for pre-existing translation parity, duplicate static block ID, and remote-asset findings outside this wave.

### Self-review and concerns

- Auth subscribers are copied before dispatch, so disconnecting during a callback cannot corrupt iteration.
- Subscription happens only once map initialization succeeds and Map is still requested; the loader's existing rejection path continues to protect requests that fail before readiness.
- Explicit List selection during a slow load remains authoritative and does not install the persistent dispatcher.
- No protected JSON file was changed in this wave.
- A live browser-key auth/referrer failure could not be induced against a deployed storefront; the custom-element behavioral test covers the documented global callback after successful map activation.
