# Task 2 Report: Guarded Dotdigital loader

## Scope delivered

- Created `snippets/dotdigital-subscriber-modal.liquid`.
- Rendered the snippet exactly once immediately before `</body>` in `layout/theme.liquid`.
- Extended `tests/dotdigital-subscriber-modal.test.mjs` with loader, guard, placement, duplicate-reference, and no-local-interception coverage.
- Preserved `config/settings_data.json`, all template JSON, and the independent Dotdigital chat embed.

## Loader behavior

The snippet only outputs the external script when all three conditions hold:

1. `settings.dotdigital_subscriber_modal_enabled` is enabled.
2. The trimmed campaign setting is nonblank.
3. `request.design_mode == false`.

It URL-encodes the campaign, delay, and cookie-day settings, and emits the approved legacy loader endpoint:

`//news.onacoffee.com.au/resources/sharing/popoverv3.js?sharing=lp-popover&domain=news.onacoffee.com.au&id=...&default-cookies-expiry-length-in-days=...&hide-after-submission=true&delay=...`

The URL is constructed in the snippet once, escaped for the script attribute, and loaded asynchronously. The theme does not create a subscriber form or use local JavaScript to collect or intercept data.

## TDD evidence

### RED

After correcting the test contract to the authoritative legacy integration parameters, this command produced the expected failures:

```text
node --test tests/dotdigital-subscriber-modal.test.mjs
tests: 7; pass: 4; fail: 3
- snippets/dotdigital-subscriber-modal.liquid must exist
- theme.liquid must render the global loader exactly once (0 !== 1)
- the theme must have one external Dotdigital popover loader (0 !== 1)
```

### GREEN

After the minimal snippet and one layout render were added, the focused test passed:

```text
node --test tests/dotdigital-subscriber-modal.test.mjs
tests: 7; pass: 7; fail: 0
```

## Verification commands and results

| Command | Result |
| --- | --- |
| `node --test tests/dotdigital-subscriber-modal.test.mjs` | 7 passed, 0 failed |
| `node --test tests/*.test.mjs` | 69 passed, 0 failed |
| `shopify theme check --path . --output json --no-color \| jq -c '[.[] \| select(.path \| endswith("snippets/dotdigital-subscriber-modal.liquid") or endswith("layout/theme.liquid"))]'` | No errors on either changed Liquid file; one `RemoteAsset` warning on the new approved external script and one pre-existing `RemoteAsset` warning in `layout/theme.liquid` at line 31 |
| `rg -n --glob '!tests/**' --glob '!docs/**' 'popoverv3\\.js\|dotdigital-subscriber-modal' assets blocks layout sections snippets` | Exactly one loader reference in the new snippet and one layout render |
| `git diff --check` | Exit 0 |
| `git diff --exit-code -- config/settings_data.json ':(glob)templates/*.json'` | Exit 0; protected settings/template JSON unchanged |

## Self-review

- Correctness: the exact legacy endpoint and parameter names are preserved, including `sharing=lp-popover`, campaign `id`, `default-cookies-expiry-length-in-days`, `hide-after-submission=true`, and configurable `delay`.
- Security: all editor-controlled URL inputs are URL-encoded; the completed URL is HTML-escaped for the script attribute; no subscriber data is handled by theme JavaScript.
- Performance: the lone external loader is asynchronous and is skipped entirely when disabled, unconfigured, or in Theme Editor.
- Maintainability: campaign URL construction has one owner, and tests prevent duplicate loaders or an accidental local form/interceptor.

## Concerns

- Theme Check appropriately reports `RemoteAsset` for the approved external Dotdigital loader; its normal local-asset recommendation cannot apply to this vendor-hosted campaign script.
- Theme Check also reports an existing `RemoteAsset` warning in `layout/theme.liquid` at line 31, outside this task's change. The full theme contains pre-existing unrelated errors, so verification was filtered to the two changed Liquid files.
