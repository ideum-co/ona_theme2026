# Task 1: Locations template contract

## Implementation

- Added the `page.locations` alternate page template with only the three migrated sections, ordered as header, store finder, and flagships.
- Added minimal semantic section shells for `locations-header`, `locations-store-finder`, and `locations-flagships`. They have safe visible headings, page-width presentation classes, no external dependencies, and valid empty settings schemas.
- Added a Node contract test that protects the alternate-template boundary, migrated section order/types, default `page.json` separation, section-file existence, and schema validity.

## TDD evidence

### RED

Command:

```sh
node --test tests/locations-page-template.test.mjs
```

Result: 0 passing, 2 failing. The failures were expected because `templates/page.locations.json` and `sections/locations-header.liquid` did not yet exist:

```text
AssertionError [ERR_ASSERTION]: templates/page.locations.json must exist
AssertionError [ERR_ASSERTION]: sections/locations-header.liquid must exist
```

During the first implementation pass, the schema test passed but template parsing exposed the repository-standard leading Shopify block comment as invalid to raw `JSON.parse`. The test reader was corrected to remove that header before parsing, matching the existing `templates/page.json` format.

### GREEN

Command:

```sh
node --test tests/locations-page-template.test.mjs
```

Result: 2 passing, 0 failing.

```text
✔ keeps locations in a dedicated alternate page template
✔ provides a valid schema for every locations template section
```

## Verification

Command:

```sh
node --test tests/*.test.mjs
```

Result: 16 passing, 0 failing.

Also ran `git diff --check`; it reported no whitespace errors.

## Files

- `tests/locations-page-template.test.mjs`
- `templates/page.locations.json`
- `sections/locations-header.liquid`
- `sections/locations-store-finder.liquid`
- `sections/locations-flagships.liquid`

## Self-review

- The test fails if locations is moved into the default page template, if a migrated section is omitted/added/reordered, or if a referenced section is absent or lacks a parseable schema.
- The new template is isolated from `templates/page.json`; no protected template or settings-data file was changed.
- The shells add no API keys, jQuery, Accentuate, or flagship-stores blog dependency.
- The implementation is intentionally limited to stable semantic placeholders so later tasks can fill each section without changing the template contract.

## Concerns

None. The section shells intentionally do not implement store lookup or flagship content; those are deferred to the later migration tasks.

## Fix round 1: Resolve section types through template order

### Change

- Replaced the insertion-order-dependent `Object.values(template.sections).map((section) => section.type)` assertion with `template.order.map((id) => template.sections[id].type)`.
- The expected types remain the literal migration contract: `locations-header`, `locations-store-finder`, and `locations-flagships`.

### Regression proof (RED)

After adding the assertion, I temporarily changed `page.locations.json` so its object values remained in the old expected type sequence while the `header` and `flagships` IDs resolved to each other's types. The template `order` remained unchanged.

Command:

```sh
node --test tests/locations-page-template.test.mjs
```

Result: 1 passing, 1 failing, as expected.

```text
AssertionError [ERR_ASSERTION]: locations template must reference exactly its three migrated section types
actual: [ 'locations-flagships', 'locations-store-finder', 'locations-header' ]
expected: [ 'locations-header', 'locations-store-finder', 'locations-flagships' ]
```

I restored the correct section-ID/type mapping immediately after the controlled mutation.

### Verification (GREEN)

Commands:

```sh
node --test tests/locations-page-template.test.mjs
node --test tests/*.test.mjs
```

Results:

- Focused locations contract: 2 passing, 0 failing.
- Full Node suite: 16 passing, 0 failing.
