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

## Commits

- `6bf6db1 feat: migrate flagship locations`
- `8363878 docs: report flagship migration`
- `0c3f7f6 fix: synchronize flagship gallery scrolling`
- `49a5ad6 fix: reconcile flagship gallery controls`

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

## Review fix round 1/5: direct-scroll synchronization

### Findings addressed

1. **Native scroll state:** the gallery now observes viewport `scroll` events with a short debounce, derives the slide whose offset is closest to `scrollLeft`, and synchronizes `currentIndex` plus the polite image-position status. Previous/Next and keyboard navigation therefore continue from the slide reached by swipe or trackpad scrolling.
2. **Lifecycle cleanup:** button, keyboard, and scroll callbacks are stored as instance handlers. `disconnectedCallback` removes all registered handlers, clears a pending scroll timer, and permits a clean later reconnect without duplicate listeners.
3. **Behavioral coverage:** a lightweight custom-element/DOM harness now runs the real `LocationsFlagshipGallery`. It directly scrolls to slide three, verifies the live status, verifies Previous targets slide two and Next returns to slide three, then verifies teardown removes handlers and cancels pending synchronization.

### RED evidence

Command:

```sh
node --test tests/locations-flagships.test.mjs
```

Result before the scroll observer existed:

```text
tests 10
pass 9
fail 1
AssertionError: the live viewport must be observed
actual: undefined
expected: function
```

### GREEN and verification

```text
node --test tests/locations-flagships.test.mjs
10 passing, 0 failing

node --test tests/*.test.mjs
49 passing, 0 failing

node --check assets/locations-flagships.js
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

The fresh JSON output contains zero matches for `sections/locations-flagships.liquid` or `assets/locations-flagships.js`. The repository-wide command still exits 1 only because of unrelated pre-existing findings.

### Fix-round self-review

- The synchronization uses the same full-width slide offsets as the section's scroll-snap layout, so the nearest offset corresponds to the visible slide.
- Programmatic smooth scrolling may emit many `scroll` events; the debounce settles on the final nearest slide while `show` still updates controls immediately.
- Teardown cancels pending state writes and removes handlers with the same function identities used during registration.
- The initialization guard prevents duplicate listeners if `connectedCallback` runs more than once without a disconnect; disconnect resets the guard for valid reconnection.

Fix commit subject: `fix: synchronize flagship gallery scrolling`.

## Review fix round 2/5: immediate control reconciliation

### Finding addressed

The round-1 scroll observer deliberately debounced synchronization for 50 ms. If a visitor swiped or scrolled to another image and activated Previous or Next before that delay elapsed, the control still derived its target from the stale pre-scroll `currentIndex`.

Button and keyboard navigation now call `flushPendingScrollSync` before deriving a target. When a scroll debounce is pending, the method cancels its timer, immediately reconciles `currentIndex` and live status from the viewport's nearest slide, and only then navigates. It does not reconcile when no direct-scroll update is pending, preserving immediate consecutive programmatic control behavior.

### RED evidence

The real-component test was changed before production code so it direct-scrolls to slide three and activates Previous in the same tick, then direct-scrolls to slide one and activates Next in the same tick. The existing awaited debounce and disconnect cancellation paths remain in the test.

Command:

```sh
node --test tests/locations-flagships.test.mjs
```

Result before the synchronous control-boundary flush:

```text
tests 10
pass 9
fail 1
expected: { left: 100, behavior: 'auto' }
actual:   { left: 200, behavior: 'auto' }
```

The failure proves immediate Previous wrapped from stale index zero to slide three instead of starting from the directly visible third slide and targeting slide two.

### GREEN and verification

```text
node --test tests/locations-flagships.test.mjs
10 passing, 0 failing

node --test tests/*.test.mjs
49 passing, 0 failing

node --check assets/locations-flagships.js
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

The fresh JSON output contains zero matches for `sections/locations-flagships.liquid` or `assets/locations-flagships.js`. The repository-wide command remains nonzero only for unrelated pre-existing findings.

### Fix-round self-review

- Both native buttons and Arrow/Home/End keyboard paths pass through the same pending-scroll reconciliation boundary.
- The pending timer is cleared before synchronous reconciliation, preventing a second delayed status write after the control has moved to its target.
- Delayed direct scrolling without a control click still updates `currentIndex` and status after the debounce.
- Disconnect still removes all listeners and cancels a pending debounce, as retained in the behavioral test.

Fix commit subject: `fix: reconcile flagship gallery controls`.

## Review fix round 3/5: programmatic scroll ownership

### Finding addressed

Programmatic smooth scrolling also emits viewport `scroll` events. Round 2 treated those events like native direct scrolling, so they armed the same debounce. A rapid second control or keyboard command flushed against an intermediate pixel position and overwrote the logical target selected by the first command.

The gallery now marks programmatic ownership before calling `scrollTo`. Scroll events emitted during that ownership refresh a programmatic settle timer but never arm direct-scroll synchronization. Rapid button and keyboard commands therefore continue from the logical target. `wheel`, `touchstart`, and `pointerdown` explicitly cancel programmatic ownership so user-driven scrolling can schedule and synchronously flush normal reconciliation. `scrollend` closes either lifecycle immediately where supported, while timers provide the fallback.

All new interaction and `scrollend` listeners plus the programmatic settle timer are removed or cancelled in `disconnectedCallback`.

### RED evidence

The real-component test's `scrollTo` boundary was changed first to emit a realistic intermediate scroll event at one quarter of the distance toward a smooth-scroll target. It also added rapid consecutive buttons, wheel takeover, same-tick keyboard navigation, delayed native synchronization, and teardown assertions.

Command:

```sh
node --test tests/locations-flagships.test.mjs
```

Result before programmatic/direct ownership was distinguished:

```text
tests 10
pass 9
fail 1
expected: { left: 200, behavior: 'smooth' }
actual:   { left: 0, behavior: 'smooth' }
```

The failure proves the first smooth-scroll event rebased the rapid second command onto an intermediate physical position instead of preserving the first command's logical target.

### GREEN and verification

```text
node --test tests/locations-flagships.test.mjs
10 passing, 0 failing

node --test tests/*.test.mjs
49 passing, 0 failing

node --check assets/locations-flagships.js
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

The fresh JSON output contains zero matches for `sections/locations-flagships.liquid` or `assets/locations-flagships.js`. The repository-wide command remains nonzero only for unrelated pre-existing findings.

### Fix-round self-review

- Programmatic ownership is set before `scrollTo`, so even synchronous scroll events cannot arm the direct-scroll debounce.
- Each programmatic scroll event extends the settle timer; long smooth animations do not lose ownership between frames.
- Wheel, touch, or pointer intent cancels the active programmatic timer before subsequent native scroll events arrive.
- The immediate direct-scroll reconciliation from round 2 remains intact once direct interaction owns the viewport.
- Buttons and Arrow/Home/End keyboard commands retain their logical target through rapid consecutive calls.
- Disconnect removes every added listener and clears both direct and programmatic timers.

Fix commit subject: `fix: distinguish flagship gallery scroll sources`.
