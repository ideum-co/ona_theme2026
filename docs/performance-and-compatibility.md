# Performance, tracking & compatibility — recommendations

Living doc. Started 2026-08-17, early in the Horizon redesign, to avoid repeating
issues the live site has had historically. Append to this rather than replacing —
mark items done/superseded instead of deleting them.

## Why this doc exists

The live site (`onacoffee.com.au`) has had real, previously-diagnosed problems:

- **Shopify `page_cache` performance issue** (flagged in the prior conversion/SEO/ads
  audit, PR #18 in that thread).
- **GA4 Measurement Protocol bug**: purchase events carrying a `session_id` were
  silently dropped, undercounting revenue in GA4.
- **Shopify webhook subscription scoping gap**: webhooks created through the
  Admin UI weren't covered by the app's webhook subscription query, so some
  events were missed.

None of these were caused by the redesign — they're existing production issues.
The point of this doc is to make sure the *rebuild* doesn't reintroduce the same
classes of problem, since we're still early enough (few templates, not yet
launched) that fixing process is cheap now and expensive later.

## Recommendations

### 1. Audit app-embeds before porting them, don't copy the list wholesale

The dev theme currently has **zero app-embed blocks enabled** (no `"blocks"` key
in `config/settings_data.json`), while the live theme has several (Appstle
Subscriptions confirmed; likely also Judge.me reviews, Rebuy cross-sell, live
chat — not yet individually confirmed). Before enabling any of them on the dev
theme:

- Confirm the app is still actually in use / paid for.
- Check its known performance cost (render-blocking script? how many KB? does
  it fire on every page or just PDP/cart?).
- Prefer a native-styled replacement over an app widget where feasible — the
  `blocks/purchase-options.liquid` block built this session (reads Shopify's
  real `selling_plan_groups` data directly instead of depending on Appstle's
  injected JS widget) is the pattern: same backend data, no third-party
  render-blocking script, full control over styling.

**Status:** not started. Next step would be pulling the live theme's
`config/settings_data.json` blocks list and going through it one by one.

### 2. Re-validate tracking on the new theme before launch — don't assume parity

The GA4 session_id bug and the webhook scoping gap were both *data-loss* bugs,
not cosmetic ones, and both are the kind of thing that can reappear silently on
a new theme (Horizon's cart/checkout JS is not the old theme's). Before
launch:

- Run a real test purchase through the new theme and confirm it shows up
  correctly in GA4 (Realtime + DebugView), with revenue and session
  attribution intact.
- Confirm webhook delivery for that test order (Admin UI-created webhooks
  included, not just app-created ones — that was the exact prior gap).
- Do this as an explicit QA checklist item before go-live, not something
  assumed to "just work" because the old theme's tracking worked.

**Status:** not started — theme isn't at launch-readiness yet, but flagging
early so it's not forgotten under launch-week time pressure.

### 3. Treat performance as a gate, not a retrofit

Cheap to enforce now (few templates); expensive to retrofit later (once
100+ sections exist and slowness is diffuse and hard to attribute). Concretely:

- Run Lighthouse/PageSpeed on a template before merging changes to it,
  especially anything touching the homepage, collection, or product templates
  (highest-traffic pages).
- Watch for the `page_cache`-class of issue specifically — confirm caching
  headers / Shopify's own caching behavior aren't defeated by anything we add
  (e.g., per-visitor personalization, uncached third-party scripts).
- Keep an eye on total script weight per page as more sections/blocks get
  added — it's additive and easy to lose track of.

**Status:** informal only so far — no CI gate or checklist exists yet. Worth
deciding whether this needs to be a hard gate (blocks merge) or a soft
checklist (reminder before shipping a template).

### 4. Prefer self-hosted assets over third-party CDNs for anything shipped to production

Found during this session's build: the Raspberry Candy 3D viewer
(`templates/index.json`, `raspberry_candy` section) loads Google's
`model-viewer` from `cdn.jsdelivr.net` rather than as a theme asset. This is
common practice for this kind of library, but it means the 3D viewer's
availability depends on jsdelivr's uptime — one more moving part outside our
control, which is exactly the flavor of "known compatibility issue" this doc
is trying to get ahead of.

- Where a third-party script is small and stable, prefer downloading it into
  `assets/` and serving it via `asset_url` (Shopify's own CDN, same reliability
  as the rest of the theme) instead of an external CDN.
- Where a CDN dependency is kept (e.g., because the library updates often),
  document it explicitly in a code comment, as already done for the 3D viewer.

**Status:** flagged, not fixed. `model-viewer` is currently ~150KB min+gzip
from jsdelivr; self-hosting is a small, low-risk follow-up whenever convenient.

## Also worth tracking here going forward

- Which agency owns performance/tracking QA responsibility for this rebuild
  (OMG = SEO, Formswell = design, iDeum = ecomm/ads/dev per current scope) —
  worth an explicit owner for the launch QA checklist in #2 so it doesn't fall
  through the cracks between agencies like some of the historical issues did.
- Any new third-party script added to the theme should get a one-line entry
  here (what it does, why it's there, self-hosted or CDN) so this doc stays
  the single place to check "what's running on this site and why."
