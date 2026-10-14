# Post-publish review — live storefront, 15 October 2026

Theme **`154676789439` (`ona_theme2026/main`)** became `role: MAIN` at
**2026-10-14 ~15:43Z**. This document records what the published storefront
actually serves, measured by fetching live URLs and reading the live theme's
files through the Admin API on 2026-10-15. Where a finding compares against the
previous theme, the comparison is against **`160335790271`** ("ONA - media block
fix + press quotes hidden…"), which is now `UNPUBLISHED` and is the rollback.

Nothing in this document is an estimate. Every number below was measured.

> **Method.** Live pages fetched with `curl --compressed`; the previous theme
> fetched through a pinned preview cookie
> (`curl -c jar -b jar "https://onacoffee.com.au/?preview_theme_id=160335790271"`
> first — the preview cookie is sticky, so it has to be pinned and then reused).
> Theme files read with `node(id:) { ... on OnlineStoreTheme { files } }`.

---

## 1. Severity summary

| # | Finding | Blast radius | Severity |
|---|---|---|---|
| 1 | 10 bespoke pages render a heading and nothing else | about, wholesale, barista-courses, learn, 3× bookings, private-courses, llms, maintenance | **Critical** |
| 2 | 3 more pages lost their body content | contact, faq, subscription-faq | **High** |
| 3 | All 10 app embeds are off; previous theme had them on | sitewide | **High** |
| 4 | Maple-specific copy prints on all 92 PDPs | every product, incl. merch and equipment | **High** |
| 5 | Two dead CTAs render with no destination | homepage + all 92 PDPs | Medium |
| 6 | Homepage is at the hard 25-section cap, 11 of them disabled | homepage editing | Medium |
| 7 | Three publish gates were never run | — | Medium |

What is **not** broken, verified rather than assumed: blogs, collections, cart,
search, the 404 page, subscriptions, the Judge.me review widget, GA4/Google Ads
tagging, and all four Water For Good campaign surfaces. Details in §8.

---

## 2. Critical — 10 pages are blank in production

`templates/page.json` is a two-block fallback: an `<h1>` of
`{{ closest.page.title }}` and a `page-content` block that prints the page's
rich-text body. Any page whose `templateSuffix` has no matching file on the
theme falls back to it. On the old theme the content of these pages lived in
**theme sections**, not in the page body — so the fallback has nothing to print.

Measured as visible text inside `<main>`:

| URL | suffix | old template | live text | verdict |
|---|---|---|---|---|
| `/pages/about` | `about` | `page.about.json` (5,172 b) | **5 chars** | blank |
| `/pages/wholesale` | `wholesale` | `page.wholesale.json` (**28,724 b**) | **16 chars** | blank |
| `/pages/barista-courses` | `training` | `page.training.json` (9,861 b) | **15 chars** | blank |
| `/pages/learn` | `learn` | `page.learn.json` (991 b) | **5 chars** | blank |
| `/pages/canberra-bookings` | `bookings` | `page.bookings.json` (638 b) | **33 chars** | blank |
| `/pages/sydney-bookings` | `bookings` | same | **31 chars** | blank |
| `/pages/melbourne-bookings` | `bookings` | same | **34 chars** | blank |
| `/pages/private-courses-and-experiences` | (own suffix) | `page.private-courses-and-experiences.json` (1,648 b) | **31 chars** | blank |
| `/pages/llms` | `llms` | *none on either theme* | 4 chars | blank, **pre-existing** |
| `/pages/maintenance` | `maintenance` | *none on either theme* | 11 chars | blank, **pre-existing** |

`llms` and `maintenance` had no template on the old theme either, so those two
are not cutover damage. **The other eight are.** `/pages/wholesale` is the
worst of them: a 28.7 KB template, the store's B2B entry point, now serving the
two words "Wholesale Coffee".

### Pages that lost their body but are not empty

| URL | suffix | old template | live text |
|---|---|---|---|
| `/pages/contact` | `contact` | `page.contact.json` | 138 chars |
| `/pages/faq` | `faq` | `page.faq.json` (11,754 b) | 172 chars |
| `/pages/subscription-faq` | `faq-subscriptions` | `page.faq-subscriptions.json` (11,968 b) | 224 chars |

The new theme *does* ship `page.contact.json`, but it is a different, much
smaller template, and the contact page's actual form is an app embed that is now
disabled — see §4.

### Pages that are fine

`privacy`, `recycled-boxes`, `womenincoffee`, `shipping-information` and
`locations` all render, because their content lives in the Shopify page body
rather than in theme sections, and the fallback prints the body.
`/pages/solar` and `/pages/sitemap` both 301 to `/` — store-level URL
redirects, unrelated to the theme.

### What fixing this costs

Re-adding an empty template does nothing. The content — sections, copy,
images — exists only inside the old theme's templates, which are **theme-only
and not in this repo**. Each page has to be ported: read the old template from
theme `160335790271`, rebuild it against Horizon's sections, commit it as
`templates/page.<suffix>.json`. `page.wholesale.json` alone is 28.7 KB.

**Do not fix this by re-pointing the pages' `templateSuffix`.** A page's suffix
lives on the page resource, not on the theme, so changing it changes the
*published* theme immediately and would also move the page on the rollback
theme — destroying the rollback. Add the theme file instead.

---

## 3. Also lost: blog and product template variants

The old theme carried template variants this theme does not:

| old template | what used it | state now |
|---|---|---|
| `blog.brewguides.json` (4,226 b) | the 747-article brew guides blog | falls back to `blog.json` |
| `blog.news.json`, `article.news.json` | the Journal | falls back to `blog.json` / `article.json` |
| `product.filtersub.json` (6,596 b) | the 2 subscription products | falls back to `product.json` |
| `product.default.json` (7,343 b) | legacy | falls back |

These all render — the fallback exists and has content — so this is a design
regression, not an outage. It is the same decision already recorded in the
migration map: four product-suffix outcomes still need building, not just
deciding.

---

## 4. All ten app embeds are off

`config/settings_data.json` on the live theme has **no `"blocks"` key at all**
(4,796 b). The previous theme's has ten entries, all `"disabled": false`
(22,183 b):

| app | block | what its absence costs |
|---|---|---|
| Appstle Subscriptions | `appstle-subscription-helper` | **nothing on the storefront** — see §8 |
| Judge.me | `judgeme_core` | star ratings on product cards and collection pages |
| MinMaxify Order Limits | `app-embed-block` | min/max order quantity enforcement in the theme |
| EG Auto Add to Cart | `app-embed` (v3) | automatic gift/GWP additions |
| Preorder Now (`wod-preorder-now`) | `app-embed` | preorder buttons |
| Qikify Upsell | `app-embed` | upsell offers |
| Powerful Form Builder (Globo) | `app-embed` | **every Globo form** |
| Shopify Forms | `forms` | Shopify-native forms |
| Dotdigital | `chat` | live chat |
| Shopify Inbox | `chat` | live chat |

Measured sitewide, every page on the previous theme carries `globo-formbuilder`
×24, `jdgm-` ×135, `appstle` ×705, plus `minmaxify`, `preorder`, `qikify`,
`eg-auto` and `shopify-chat`. On the live theme, all of these are **zero**
except the Judge.me review widget on PDPs, which is a theme app block carrying
its own loader and does not need the embed.

Two consequences are already visible:

- **`/pages/contact` has a dead form.** The page renders
  `<div class="globo-formbuilder" data-id="NjI4MjI="></div>` directly under the
  heading "If you have any questions, please let us know, and we will get back
  to you shortly!" — and nothing ever fills it, because Globo's script is not
  loaded. There is a separate native Horizon contact form on the page, so the
  page is not useless, but the Globo form is gone.
- **No star ratings on collection pages.** `/collections/all-coffee` contains
  zero `jdgm-` markup; the previous theme had 135 occurrences.

**MinMaxify, EG Auto Add to Cart and Preorder Now are the ones to check first** —
each silently changes what a customer can buy, and none of them announces its
absence. Whether their rules are also enforced at checkout (Shopify Functions)
rather than only in the theme determines how bad this is; that has not been
tested.

---

## 5. Maple copy on all 92 PDPs

`templates/product.json` is the only product template, so every active product
renders it. Three Maple-specific sections are enabled:

| section | what prints |
|---|---|
| `product_tabs_fW4maV` → Profile tab | "The maple tree's enduring strength…", the static line "TASTES LIKE / Caramel, biscuts, nuts and spices", and **`maple.webp`** (4 srcset entries) |
| `story_video_VUwQ6f` | "Over the years, Maple has become one of ONA's most familiar coffees." |
| `section_EhyeAD` | "Who's Maple For?" plus three audience paragraphs |

Verified by fetching one product per suffix — including `/products/ona-vest`
(merch) and `/products/hario-v60-dripper-clear-plastic` (equipment). All three
sections print on all of them. `product_dna_trxBBN` ("Maple DNA") is
`disabled` and correctly does not print.

Two details worth fixing at the same time: the static line contains the typo
**"biscuts"**, and both "Shop now" buttons in these sections point at
`shopify://collections/all`.

---

## 6. Dead CTAs, live

| where | label | setting | status |
|---|---|---|---|
| homepage, `learn_with_ona` col2 | **Brewing Guides** | group `link` and image `link` both empty | **dead** |
| homepage, `coffee_quiz` | **Explore all our coffees** | `explore_link` empty | **dead** |
| all 92 PDPs, `inline_cta_8ann9f` | **Try our coffee quiz** | `button_link` empty | **dead** |

Confirmed in the rendered HTML, not just the JSON: the `learn_with_ona` section
emits **two anchors for three cards** — `/pages/barista-courses` and
`/blogs/news`. Brewing Guides has no anchor at all. The `coffee_quiz` section
emits the label "Explore all our coffees" with no anchor anywhere in the
section.

Latent, lower priority: `learn_with_ona` col1's *image* link points at
`shopify://blogs/news-1`, a blog with **0 articles**. It is inert today because
the group link wraps the card, but it should not be left pointing there.

`story_video_LN6zzn`, `press_band` and `discover_by_category` also have empty
links — all three sections are `disabled`, so they are not live defects.

---

## 7. The homepage is full

`templates/index.json` holds **25 sections — exactly Shopify's hard cap** — and
**11 of them are disabled**:

```
special_release · club_invite_QLL4T3 · club_invite_TGPaF8 · club_benefits_QGRDdd
product_intro_k9p6yn · club_benefits · raspberry_candy · story_video_LN6zzn
press_band · discover_by_category
```
(plus `product_tabs_XnTEpK` on the PDP template.)

Nothing can be added to the homepage until one comes out. Over the cap, the
GitHub integration **declines the whole file silently** — no error, no commit
status, nothing in the admin, and an unchanged checksum is the only symptom.
`tests/shop-owned-templates.test.mjs` guards the repo side of this.

Three further sections are parked in
`docs/index-json-parked-sections-2026-10-14.json` and are not on the theme at
all: `good_coffee_delivered`, `more_than_coffee`, `custom_liquid_RCcpAV`.

---

## 8. What is working — verified, not assumed

- **Subscriptions.** `/products/single-origin-subscription-filter` renders real
  `selling_plan` radio inputs with live plan IDs (e.g. `6623920319`) and **zero**
  references to Appstle. `blocks/purchase-options.liquid` reads Shopify's own
  `selling_plan_groups`, so the missing Appstle embed costs nothing on the
  storefront. This was the single biggest app-embed risk and it landed safely.
- **Judge.me review widget.** Loads `…/judgeme-785/assets/loader.js` from the
  app-extension CDN via its own app block, with the correct `data-product-id`
  and real shop figures (`4.81`, `74`). The block's
  `review_data: "sample_data"` is an **editor-preview** setting: the rendered
  markup carries `data-empty-state="empty_widget"`, so a product with no reviews
  shows an empty widget, **not fabricated reviews**. This closes an earlier
  concern raised on PR #159.
- **Tracking.** GA4 `G-QX88TBZC3G` and Google Ads `AW-11235348093` are present
  on every page, delivered through Shopify's `web-pixels-manager` (Customer
  Events), with `trekkie` and `monorail` alongside. The repo contains **no**
  theme-level GA tags, so the tag layer is theme-independent and survived the
  swap. **A real test purchase is still owed** — pixel presence is not
  purchase-event correctness, and the earlier `session_id` bug was silent.
- **Water For Good**, all four surfaces: counter renders `data-amount="11129"`
  → "$11,129" with the heading "DOLLARS CONTRIBUTED SO FAR" and a CTA to
  `/collections/donation-products`; badges render 7 on the homepage.
- **Blogs, collections, cart, search, 404** all return 200 with real content.

---

## 9. The three publish gates, now owed retroactively

All three are recorded *not started* in `docs/performance-and-compatibility.md`
and none was run before the cutover.

1. **App embeds (§1).** §4 above is the inventory. Go through the ten one by
   one: confirm the app is still in use, weigh its cost, then enable it or write
   down what replaced it. Two are already answered — Appstle is replaced by
   native selling plans, Judge.me's review widget arrives by app block.
2. **Tracking (§2).** A real test purchase confirmed in GA4 Realtime and
   DebugView with revenue and session attribution intact, plus webhook delivery
   for that order including **Admin-UI-created** webhooks.
3. **Performance (§3).** Lighthouse/PageSpeed on homepage, a collection and a
   PDP. Preserve the `?WIDTHxHEIGHT` → `width`/`height` CLS fix.

---

## 10. Repo ↔ theme divergence, as of 2026-10-15

| file | repo `main` | live theme | owner |
|---|---|---|---|
| `templates/index.json` | `260ba3fb…` (181,854 b) | `f38013eb…` (111,180 b) @ 15:42:47Z | **editor** |
| `templates/product.json` | `d0a1df63…` (70,476 b) | `8113df8d…` (46,029 b) @ 14:08:27Z | **editor** |
| `config/settings_data.json` | `bcd4ef44…` (6,124 b) | `ca645261…` (4,796 b) @ 14:12:50Z | **editor** |
| `templates/collection.json` | `fdc15d01…` | `fdc15d01…` | integration |
| `templates/search.json` | `da97203b…` | `da97203b…` | integration |
| `templates/page.location.json` | `c70c9421…` | `c70c9421…` | integration |
| `templates/page.locations.json` | `c70c9421…` | `c70c9421…` | integration |

Equal checksum means the integration wrote the repo's bytes verbatim and the
file is safe to change through a PR. Unequal means the editor owns it, and a
merge that touches it **overwrites the editor's work on the live store**. The
three editor-owned files are reconciled into the repo by PR #159; re-read the
checksum before merging it, because it is a snapshot of a moving target.

---

## 11. Recommended order

1. **Port the eight blank page templates**, wholesale first. Customer-facing,
   no decision needed, pure loss.
2. **Audit the ten app embeds.** Start with MinMaxify, EG Auto Add to Cart and
   Preorder Now — they change what a customer can buy.
3. **Merge PR #159** (re-read `index.json`'s checksum first) so the repo and the
   live theme stop diverging.
4. **Decide the Maple sections** — disable or rewrite. Fix "biscuts" and the
   two `collections/all` buttons at the same time.
5. **Fix the three dead CTAs.**
6. **Run the tracking and performance gates.**
7. Adopt the staging workflow in `docs/branching-and-release.md` so none of
   the above ships straight to the live store.

---

## 12. Addendum — PR #164, which deployed during this review

PR #164 ("Show complete PDP product images on mobile without cropping") merged
to `main` on 2026-10-15 while this review was being written, and was therefore
live on the storefront within seconds. It is the cleanest possible illustration
of why `docs/branching-and-release.md` exists: there is nothing wrong with the
change, but nobody *chose* to deploy it.

It adds 20 lines of CSS to `snippets/product-media-gallery-content.liquid`,
scoped to `@media screen and (max-width: 749px)` and excluding the zoom dialog.

**One thing I checked and it is fine.** The new rule sets
`aspect-ratio: var(--media-preview-ratio, var(--gallery-aspect-ratio, 1))`,
which inverts the precedence of the base rule in
`snippets/product-media-container-styles.liquid:13`
(`var(--gallery-aspect-ratio, var(--media-preview-ratio))`). That looks like it
could override a merchant-configured gallery ratio with each image's native
ratio on mobile. It cannot: the two variables are **mutually exclusive** —
`--media-preview-ratio` is only emitted inside
`{% if block_settings.aspect_ratio == 'adapt' %}` (line 386) and
`--gallery-aspect-ratio` only inside the matching `{% unless %}` (line 358).
Exactly one is ever set, so the ordering is immaterial and the `1` fallback is
unreachable.

**One thing that still needs a real device.** The substantive change is
`object-fit: contain` on the mobile product image. Inside a fixed-ratio
container, `contain` letterboxes rather than crops — so the product occupies
**less area** than it did under `cover`. Coffee bags are the agreed baseline for
PDP presentation, and the baseline is the bag's *area*, so this is exactly the
kind of change that needs to be looked at on a phone before it is accepted.

**This has not been verified here.** Chrome in this environment clamps window
resizing at roughly 1283 px and the storefront blocks iframes via
`frame-ancestors`, so the 749 px breakpoint cannot be reached; CSS zoom does not
move media queries. The `max-width: 749px` figure above is read from the source,
not observed. A real phone check is outstanding — as it still is for the earlier
PDP image sizing work and the Water For Good counter.
