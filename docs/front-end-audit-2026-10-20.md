# Front-end preview audit — 2026-10-20

Audit of **theme 154676789439** (`ona_theme2026/main`, unpublished preview),
against the live theme 160815546559 where a comparison was useful.

Written for Victor. It is split by **who decides**: what is already fixed, what
is yours to call, and what only an admin can do. Nothing in the "yours" section
has been changed.

---

## 0. Read this first — we are both editing the same theme

The theme editor writes some files, and a merge from this repo overwrites them.
There is no warning and no conflict; the editor's version is simply gone.

**As of 2026-10-20, two files have editor changes that the repo does not have:**

| file | theme last written | status |
|---|---|---|
| `templates/index.json` | 2026-10-19 17:00 UTC | **diverged — unreconciled** |
| `config/settings_data.json` | 2026-10-19 16:48 UTC | **diverged — unreconciled** |
| `templates/page.location.json` | 2026-10-19 09:48 UTC | diverged, deliberately (holds the Maps key) |
| `templates/product.json` | 2026-10-19 07:26 UTC | matches the repo |
| `templates/page.faq.json` | 2026-10-19 12:08 UTC | matches the repo |
| `templates/page.faq-subscriptions.json` | 2026-10-19 12:08 UTC | matches the repo |

If that 17:00 homepage edit is yours, **it exists only on the theme**. Before any
PR touching `templates/index.json` or `config/settings_data.json` is merged,
reconcile the theme's copy into the repo first, in its own commit. The procedure
is `docs/branching-and-release.md` §5. This is how ten sections were destroyed on
2026-10-14.

PRs #192 and #193 touch neither file, so neither is at risk from them.

---

## 1. What was audited, and how

16 page types, roughly 120 rendered section instances, on the deployed preview.

Checked per section, measured rather than eyeballed:

- **font family** of every element with its own text, against the theme's two
  faces (Silk Serif, Karla)
- **type scale**: h1 `clamp(3rem, 5.6vw, 3.5rem)` · h2 `clamp(2.25rem, 4.8vw, 3rem)` ·
  h3 `2rem` · h4 `1.5rem` · h5 `0.875rem` · h6 `0.75rem` · body `0.875rem`
- **heading hierarchy inversions** — an h3 rendering larger than an h2 beside it
- **text under 11.5px**
- **line measure** over ~100 characters
- **image distortion** — rendered aspect vs natural, where `object-fit: fill`
- **horizontal overflow** past the viewport
- **section presence** — every section the template declares actually renders

Heading *sizes* that differ from the scale are not flagged on their own: heading
level and size are editor settings in this theme, so a 40px h3 is a choice.

---

## 2. Green light

| page | sections | verdict |
|---|---|---|
| `/` home | 17 | fixed in #193 |
| `/products/…` | 10 | clear |
| `/collections/all-coffee` | 9 | fixed in #193, one open question below |
| `/pages/locations` | 8 | fixed in #193 |
| `/pages/faq` | 7 | clear |
| `/pages/subscription-faq` | 7 | clear |
| `/pages/wholesale` | 23 | clear |
| `/pages/about` | 12 | clear |
| `/pages/barista-courses` | 15 | clear |
| `/pages/private-courses-and-experiences` | 7 | clear |
| `/pages/canberra-bookings` | 8 | clear |
| `/pages/learn` | 7 | clear |
| blog article | 6 | clear |
| `/cart` | 7 | fixed in #193 |
| `/search` | 7 | fixed in #193 |
| 404 | 7 | fixed in #193 |

Across every page: **no** heading-hierarchy inversions, **no** horizontal
overflow, **no** distorted images, **no** over-long measure, **no** missing
sections.

---

## 3. Fixed — no action needed

### PR #192 (merged, `c1f8dc6`)

- **`<img src="">` on product cards.** In Liquid only `nil` and `false` are
  falsy, so a badge with a name but no icon passed its guard and wrote an empty
  `src`. Browsers resolve that against the document URL: 7 extra full-page
  requests on the home page, 9 on `/collections/all`, 9 on `/search`. Now 0/0/0.
- **`/pages/faq` and `/pages/subscription-faq` were nearly empty** — 27 and 33
  words against the live theme's 1209 and 1206. The templates and section had
  never been ported. Content restored exactly; verified against both the live
  page and `docs/legacy-page-templates/`.
- **The locations page measured 100,203px.** Nothing capped the result list, so
  300 cards ran down the page and the flagship section sat 96,985px from the
  top. Now 4,679px.
- **Maps key moved to a shop metafield** (`custom.google_maps_api_key`). It used
  to be a section setting, which the editor writes into
  `templates/page.location.json` — so every merge wiped it. A shop metafield is
  store data; no merge, theme push or publish touches it.
- Locations cards gained real buttons and icons; venue and state filter as pills
  and tabs rather than selects; FAQ questions are headings and print correctly.

### PR #193 (open)

- **Two form controls rendered in Arial.** A `<button>` does not inherit
  `font-family` — browsers impose their own. `.variant-select__trigger` (every
  variant dropdown on a product card, so "200g"/"1kg" showed as Arial 20px) and
  `.locations-store-finder__view-toggle button` (the List/Map toggle). The PDP
  uses a different control and was never affected, which is why this survived so
  long. Now Karla.

---

## 4. Open — Victor's call

Nothing here has been changed.

### 4.1 "Add to cart" wraps to two lines on product cards

The button is 139px wide because it shares its row with **Subscribe**. The live
theme gives Add-to-cart the full card width (247px) and it does not wrap.

Options: stack the two buttons, drop the cart icon, shorten the label, or accept
it. This is a layout decision, not a defect, so it was left alone.

### 4.2 Flagship cafes content

`locations-flagships` renders 16 images and leads with ONA Dubai. The live theme
shows the five Australian flagships across 43 images. The section works; the
difference is which stores and photos are configured.

### 4.3 Fallback page templates

Seven pages fall through to the bare `page.json`. Measured by rendered word
count, only the two FAQ pages lost anything, and those are now ported. Shipping,
Privacy, Women In Coffee and Recycled Boxes keep 100% of their words and lose
only their bespoke layout. Worth a look if the layout matters to you; not a
blocker.

---

## 5. Open — admin only

These cannot be done from the repo.

1. **Paste the Maps API key** into Settings → Custom data → Shop → *Google Maps
   API key*. The map currently runs off the old section-setting fallback, so the
   metafield path is **untested until this is done**. Once set, no release can
   take the map down again.
2. **Ten app embeds** (Judge.me, Appstle Subscriptions and the rest) — see
   `docs/go-live-parity-and-post-publish-2026-10-19.md` §1.
3. **Favicon.**
4. **Empty state collection.** A search with no results currently renders
   `collections.all` — 54 products and 1.63 MB, heavier than the page *with* 93
   results, under the words "0 results found". `settings.empty_state_collection`
   is unset, and `sections/search-results.liquid:42` falls back to the whole
   catalogue. Suggest Special Release (9 products). Note this writes to
   `config/settings_data.json`, which is on the shop-owned list in §0.

---

## 6. Known limits of this audit

Stated so nobody treats it as broader than it is.

- **Mobile was not verified.** The browser used here cannot emulate mobile
  viewports. Rules are mobile-first and breakpoints are Horizon's 749/750 and
  989/990, but nothing was seen on a phone.
- **Print was not verified.** The print stylesheet for FAQ answers is asserted
  structurally; print media could not be emulated.
- **The Maps metafield path is unexercised** until the key is pasted (§5.1).
- **Checkout, customer accounts and policy pages** are Shopify-hosted, not theme
  surfaces, and were only checked for reachability.
- The audit is **static and desktop**: it measures the rendered DOM. It does not
  click through flows, and it is not a substitute for using the site.

---

## 7. Re-running it

Tests: `node --test tests/*.test.mjs` from the repo root (135 at the time of
writing).

A caution worth inheriting: on 2026-10-19 a Liquid structural break shipped with
**every test passing**, because the suite matches source text and never renders
Liquid. `tests/legacy-forms-liquid-syntax.test.mjs` now walks `{% liquid %}`
bodies, whole-file tag balance, and block statements inside `{% liquid %}` — but
the general lesson stands: for anything structural, load the page.

Quick render check for any page:

```
curl -sL --compressed -c /tmp/cj -b /tmp/cj \
  "https://onacoffee.com.au/?preview_theme_id=154676789439" -o /dev/null
curl -sL --compressed -c /tmp/cj -b /tmp/cj "https://onacoffee.com.au/pages/locations" \
  | grep -c 'endcomment\|{%- liquid'
```

`preview_theme_id` sets a cookie on redirect, so a plain `curl -sL` without a
cookie jar silently reads the **live** theme instead.
