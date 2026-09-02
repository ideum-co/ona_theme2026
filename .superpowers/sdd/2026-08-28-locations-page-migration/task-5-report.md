# Task 5: Shopify admin migration documentation and verification

## Delivered

- Added `docs/locations-metaobject-migration.md`, an admin guide for assigning
  the `page.locations` template; verifying the `store_location` and
  `store_tag` field contract; creating or reusing the exact `flagship` slug
  and relating it to flagship locations; optionally adding a `gallery` list of
  file/image references; configuring the Google Maps key in the section
  setting; and checking the Theme Editor/storefront behavior.
- The guide documents the delivered image fallback and map/geolocation failure
  behavior without claiming that the theme creates or mutates metaobjects.
- No production code, protected templates/settings, or tests were changed by
  this task.

## Verification

Commands and fresh results:

```sh
node --test tests/*.test.mjs
```

```text
tests 49
pass 49
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 312.602875
```

```sh
node --check assets/locations-store-finder.js
node --check assets/locations-flagships.js
xmllint --noout assets/map-active.svg
```

```text
All three commands exited 0 with no output.
```

```sh
shopify theme check --path . --output json --no-color | node -e "...filter results to sections/locations-header.liquid, sections/locations-store-finder.liquid, and sections/locations-flagships.liquid..."
```

```text
scannedFilesWithOffenses: 41
repository totals: 236 errors, 5 warnings, 0 info
changedSectionOffenses: []
changedSectionTotals: 0 errors, 0 warnings, 0 info
```

Shopify CLI `--path` accepts a directory rather than an individual Liquid
file: an attempted `--path sections/locations-header.liquid` returned
`ENOTDIR`. The full JSON run above is therefore the filtered changed-file
assessment. Repository-wide findings are pre-existing and occur outside the
three Locations sections.

```sh
git diff --check
git diff --exit-code origin/main -- templates/index.json templates/page.json config/settings_data.json
```

```text
Both commands exited 0 with no output.
```

```sh
rg -n -i 'accentuate|blogs\.flagship-stores|jquery|AIza[0-9A-Za-z_-]{20,}' templates/page.locations.json sections/locations-header.liquid sections/locations-store-finder.liquid sections/locations-flagships.liquid assets/locations-store-finder.js assets/locations-flagships.js assets/map-active.svg
```

```text
No matches; the scan wrapper exited 0 only for rg's expected no-match status.
```

An additional branch-wide `git diff --check origin/main` reports only three
pre-existing blank-line-at-EOF notices in earlier SDD plan/spec files. This
task did not alter those files.

## Files

- `docs/locations-metaobject-migration.md`
- `.superpowers/sdd/2026-08-28-locations-page-migration/task-5-report.md`

## Commit

- `6a8e40f docs: add locations migration guide`

## Self-review

- Checked that the guide names every delivered `store_location` and
  `store_tag` field key, identifies `tags` as the cross-reference, and keeps
  the optional `gallery` field distinct from the established contract.
- Checked that the flagship procedure requires the exact `flagship` slug and
  assigning that tag to each flagship record.
- Checked that Google Maps configuration is confined to the store-finder
  section setting and that no credential value is documented or committed.
- Checked that the documented fallback matches the implementation: missing
  key, map-load failure, no marker coordinates, or unavailable geolocation
  retain a usable location list; an absent, empty, or unusable gallery falls
  back to `image`.
- Confirmed the documentation does not claim the theme creates, updates, or
  mutates metaobjects, definitions, records, or relationships.
- Confirmed protected `templates/index.json`, `templates/page.json`, and
  `config/settings_data.json` have no diff against `origin/main`.

## Concerns

- A live Shopify Theme Editor review at desktop and mobile widths remains
  pending. The workspace has no configured store URL and the in-app browser
  has no authenticated Shopify tab, so no authorized storefront/editor preview
  was available to inspect. Perform the guide's final desktop/mobile smoke
  test against the target store before opening a PR.
- `docs/superpowers/.DS_Store` is unrelated and remains untracked and
  uncommitted.
