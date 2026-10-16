# Handoff to Victor — what to know before `ona_theme2026` goes live

Written 2026-10-15. Everything here was measured, not assumed; where a number
appears it came from the Admin API or the rendered storefront on that date.

This is the short list. The long versions are
`docs/release-test-plan-2026-10-15.md` (test plan with priorities) and
`docs/pre-release-findings-2026-10-15b.md` (findings with evidence).

---

## 1. The one ordering rule that will bite

**Merge PR #159 into `main` before any other branch reaches the theme.**

Theme `154676789439` (`ona_theme2026/main`) has three homepage sections that the
theme editor switched **off** on 2026-10-14 and that `main` and `staging` still
have **on**:

| section | on the theme | in the repo |
|---|---|---|
| `floating_badge_r89NRP` — the finished **New Harvest** campaign badge | disabled | **enabled** (3rd in homepage order) |
| `find_your_coffee` | disabled | **enabled** |
| `product_highlight_KkUAVM` | disabled | **enabled** |

Merging the repo into the theme without #159 first **puts a finished campaign
back on the homepage**. #159 is exactly the reconciliation of that editor state
into the repo; its `templates/index.json` was compared against the theme's live
copy section by section — identical, all 25, same order and settings.

#159 targets `main`. `staging` keeps the enabled badge until someone forwards
`main` → `staging` afterwards. That forward is a required step, not tidiness.

## 2. Both sides write theme files. Check direction per file.

The GitHub integration is live and **cannot be disconnected**. A merge to `main`
reaches the theme in about 5 seconds. It has already destroyed ten editor-made
sections once.

So the repo is not automatically the newer side. Use the checksum test per file:

- theme `checksumMd5` **equals** `md5sum` of the repo file → repository-written
- **not equal** → editor-written, the theme is newer

Exception: JSON templates are stored minified and returned pretty-printed, so
they never match. For those, compare **content**, not checksums.

Live example today: on `ona_theme2026/main`, `404.json`, `cart.json`,
`search.json` and `collection.json` are stored at exactly the repo's byte counts
(repository-written), while `index.json` and `product.json` are minified
(editor-written).

## 3. Three hard platform limits

- **25 sections per JSON template, 50 blocks per section.** `templates/index.json`
  is at **25 of 25**. Add a 26th homepage section and Shopify **silently refuses
  the whole file** — no error anywhere; an unchanged checksum is the only symptom.
  To add one, remove one.
- **`templateSuffix` is shop-wide.** It lives on the product/page/article, not on
  the theme, so re-pointing a suffix changes the **published** theme immediately.
  During the migration add or rename the theme **file** instead, or re-point
  atomically at cutover.
- **`themeFilesUpsert` lies.** It returns `upsertedThemeFiles: []` with empty
  `userErrors` even on success. The checksum is the only reliable signal.

## 4. Do not delete theme `160815546559`

It is **MAIN (published)** and it is also the named **rollback**. Its name still
says "PREVIEW - product media fills column (PR #46)", which is why it has twice
landed on a clean-up list. Renaming it is worth doing.

It holds one thing that exists in **no repository**: the homepage **In Sequence**
banner (`ona-banner-slider`, slide `image_picker_WzjDbw`, first section on the
page, `Inseq3nce_top.png` / `Insekmob.png`, links to `/products/in-sequence`).
`onacoffee_theme` still has the old disabled Afterpay slide there; the 2026 theme
has **no `ona-banner-slider` section at all**.

A dated snapshot is committed at `docs/live-theme-160815546559/`. **Re-pull
`templates/index.json` before the release**, not only before a rollback — and
re-run `md5sum` on that directory whenever you do.

**In Sequence is still running.** If the cutover happens while it is live, it has
nowhere to land in the 2026 theme. The closest host is `special_release`, a
disabled `media-with-content` at position 5, which sits below the fold. That is
an open decision, not a solved problem.

## 5. Publish gates — not met as of 2026-10-15

These are the ones that cannot be seen by looking at the storefront, which is
exactly why they need to be gates:

1. **All ten app embeds are off in the 2026 theme.** Live's
   `config/settings_data.json` carries ten, every one `disabled: false`:
   Judge.me, Qikify Upsell, EG Auto Add to Cart (v3), Dotdigital chat,
   MinMaxify Order Limits, Shopify Inbox, Powerful Form Builder, **Appstle
   Subscriptions**, WOD Preorder Now, Shopify Forms. The 2026 theme's file is
   6,124 bytes with **no `"blocks"` key at all**. Publishing as-is removes all
   ten silently — and **Appstle is what runs the subscription products**.
   Go through them one at a time: still in use? still paid for? replaced? One is
   genuinely replaced (`blocks/purchase-options.liquid` reads Shopify's real
   `selling_plan_groups` instead of Appstle's widget), so this is per-app, not
   all-or-nothing.
2. **Tracking has never been validated end to end on this theme.** A real test
   purchase confirmed in GA4 (Realtime + DebugView) with revenue and session
   attribution intact, plus webhook delivery for that order **including
   Admin-UI-created webhooks**. Both previous failures here were silent
   data-loss bugs, and Horizon's cart/checkout JS is not the old theme's, so
   parity cannot be assumed.
3. **Homepage hero renders as a flat grey block** — the video sits at
   `readyState 0` with no `poster`. The MP4 itself is well-formed and faststart,
   so this is theme-side.
4. **Eight bespoke pages are blank.**
5. **The PDP Water For Good line is absent** while the campaign is running
   (1–31 October 2026, dates inclusive).

## 6. Already fixed — please don't re-diagnose these

PR **#167** (Codex-clean, 101 tests passing), with regression tests in
`tests/pre-release-checks-2026-10-15.test.mjs`:

| symptom | real cause |
|---|---|
| Card price doesn't react to variant on collections/search, but works on the PDP | `ProductCard.updatePrice()` in `assets/product-card.js` reads index **`[1]`** of `product-price [ref='priceContainer']`. `[1]` only exists once quick-add has injected its own price. ONA runs quick-add off, so there is only `[0]`, the guard fails and the morph never runs. Fixed with `priceContainers[1] ?? priceContainers[0]`. |
| Header icons overlap; search is hard to hit | `snippets/search.liquid` applies a negative `margin-inline` at ≥750px, so account steals 14.4px and cart 8px of the search button's 44px target. Fixed with `margin-inline: 0`; the only visible change is the icon group widening 22.4px. |
| "Explore all our coffees" quiz CTA is a dead link | Gated on `settings.explore_label` only, while `settings.explore_link` is empty. Now gated on the link too. Still needs the link **set** in `templates/index.json`, after #159. |

**Do not port fixes from `onacoffee_theme` (Horizon 3.5.1) without testing them.**
Horizon **4.1.4 removed `ThemeEvents.variantUpdate`, `variantSelected` and
`cartUpdate` entirely** — only `mediaStartedPlaying`, `quantitySelectorUpdate`,
`megaMenuHover` and `zoomMediaSelected` remain; 4.1.4 uses
`StandardEvents.productSelect` + `event.promise`. The 3.5.1 card-price fix would
have failed silently on all three counts.

## 7. Open PRs

| PR | → | state | note |
|---|---|---|---|
| **#159** | `main` | clean, Codex clean | **merge first** (§1). Re-read the theme checksum after. |
| **#165** | `staging` | clean, CI green | docs + staging workflow. Carries the `.github` workflow, so merging it first gives `staging` CI. |
| **#167** | `staging` | clean, Codex clean | the three fixes in §6. No CI until #165 lands. |
| **#150** | `staging` | clean | go-live readiness doc. |
| **#142** | `main` | — | **close it** — it is a revert, not a fix. The blocks it restores were disabled deliberately; `blocks/pdp-product-summary.liquid` supersedes them. |

`origin/main` = `origin/staging` = `2ac69a1`.

## 8. The staging theme is connected but incomplete

`ona_theme2026/staging`, theme **160919748799**, created 2026-10-15T11:16:01Z,
unpublished. **Six templates never arrived**: `index.json`, `product.json`,
`collection.json`, `cart.json`, `search.json`, `404.json`.

Consequence, measured by pinning the theme:

| page | staging theme | control (`154676789439`) |
|---|---|---|
| `/` | **404** | 200 |
| `/products/maple` | **404** | 200 |
| `/collections/all-coffee` | **404** | 200 |
| `/cart` | **404** | 200 |
| `/search?q=maple` | 200 | 200 |

The 404s are Shopify's own bare page (~3.2 KB) — the theme cannot render even
its own 404, because `404.json` is one of the six.

It is a **failed initial sync, not a size limit**: the same integration has
delivered those same files, at those same byte counts, to
`ona_theme2026/main`. `processing` is `false` and nothing has moved since
11:17:45Z, so it is not still working. **Disconnect and reconnect the branch to
force a full sync**, then re-check those six files before trusting any staging
preview.

## 9. Still needs a human decision

- **Product images.** Raspberry Candy, Aspen, Gateway and Maple all point at
  1000×1633 files while unused **2058×3361** originals sit in Files (uploaded
  2024-10-29, the downscaled duplicates ~15 minutes later). The CDN **does not
  upscale** — the same URL at `width=1000`, `1920` and `3840` all return
  1000×1633, while the unused original returns a real 1920×3136. The 2026 cards
  request `width=3840`. Fixing it at product-media level improves live, 2026,
  the mega-menu cards and the PDP at once. It writes to **live products**, so it
  needs an explicit go-ahead.
- **In Sequence banner** — where it lands in 2026 (§4).
- **The quiz `explore_link`** value — one setting, after #159.
- **Thageini** (`COFOSOF1 200g OpZ`, Kenya) carries `custom.donation_amount`
  $9.00 but is not in the donation collection. Add it or clear the metafield.

## 10. Admin-UI only — nobody can do these from the repo

- Reconnect the `staging` branch (§8).
- Make `unit` a **required status check** on `main` and `staging`.
- Enable the app embeds you decide to keep (§5.1).
- Rename theme `160815546559` so it stops reading as a stray preview (§4).

## 11. Cannot be verified from this environment

Chrome here clamps resize at about 1283px, iframes are blocked by
`frame-ancestors`, and CSS zoom does not move media queries. So anything below
~1283px was checked **via CSSOM only**, never rendered. Real-phone passes still
owed: homepage hero, PDP gallery (PR #164's mobile `object-fit: contain`), cart
drawer, and the WFG counter.

## 12. Leave for last

The Horizon **4.1.4 → 4.3.0** bump: 26 real conflicts across 8 files, 59 lines
of overlap. Deliberately after go-live.
