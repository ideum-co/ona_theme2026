# Formswell migration map — what's done, what needs a decision, what needs building

**Date:** 2026-10-14 · **Theme:** `ona_theme2026` (Horizon 4.1.4) · **Shop theme:** `154676789439`

The strategy is *not* to port the legacy templates. It is to land on the Formswell
design and delete the old complexity. This document re-reads the cutover under that
strategy, because the answer changes: most of what looked like "28 templates to port"
is either already built, already dead, or a one-line wiring fix.

Every **count** here was measured today against the live shop (Admin API, all 92
active products / 26 pages / 5 blogs / 795 articles) and against both repos — product
and page counts, metafield coverage, section and template inventories, article totals,
file sizes and checksums. The few **effort** figures — "a one-hour change", "~8 distinct
layouts", the "(hours)" in §5 — are estimates, flagged as such where they appear. Do not
schedule off the estimates; the counts are what is measured.

## The headline

| | legacy `onacoffee_theme` | `ona_theme2026` |
|---|---|---|
| sections | **147** (94 of them bespoke `ona-*`) | **57** |
| snippets | 139 | 157 |
| product templates | 13 | **1** |
| page templates | 16 suffixes | 3 (`page`, `page.contact`, `page.locations`) |

The duplication is not a figure of speech. `ona-wholesale-sourcing-v2 … v6` and
`ona-traning-sourcing`, `-v2`, `-v3`, `-v4` are **nine copies of the same 151-line
section**, differing by two lines (the schema name). v2 and v6 are byte-identical.
That is ~1,360 lines that collapse into one Horizon `media-with-content` used nine times.

---

## 1. Done — built, in the Formswell design, no decision needed

| Surface | How it's built in 2026 | Replaces |
|---|---|---|
| **Home** | `hero`, `media-with-content`, `product-highlight`, `club-invite`, `club-benefits`, `product-intro`, `story-video`, `press-quotes`, `coffee-quiz`, `collection-carousel`, `floating-badge`, `marquee`, `layered-slideshow`, `inline-cta` | `ona-banner-slider`, `ona-featured-collection` ×3, `ona-slideshow`, `ona-two-images`, `ona-image-and-text`, `ona-divider` ×4 |
| **PDP** | **as wired on the shop:** `product-information` → `_product-media-gallery` + `_product-details` (`pdp-product-summary`, `variant-picker`, `purchase-options`, `buy-buttons`, description, `properties_table`) + `product-tabs` + `story-video` + `product-dna` + a content section + `product-recommendations` + `inline-cta`. The repo's `product.json` instead wires `story` / `brew_guide` / `faqs`, which are **disabled on the shop** — see §4.3, the repo copy is not what renders |
| **Collection** | `main-collection` with static `filters` block; collection description split on `<!-- split -->` into intro + below-fold; FAQs read from `collection.metafields.custom.faqs` | `ona-collection-template` + `ona-collection-faq-new` |
| **Collection list** | `main-collection-list` | `ona-collections-redirect` |
| **Search** | `search-header`, `search-results`, `predictive-search`, `predictive-search-empty` | `ona-search-results` |
| **Cart** | `main-cart` + `product-list`, plus `cart-drawer-section` | `ona-cart-template` + `ona-product-complementary` |
| **Blog / article** | `main-blog`, `main-blog-post`, `featured-blog-posts` | `ona-blog-template`, `ona-article-template` |
| **Locations** | `locations-header`, `locations-store-finder`, `locations-flagships` | `ona-store-finder`, `ona-flagship-intro`, `ona-locations-content` |
| **Contact** | `main-page` + `contact-form` block | `ona-page-title`, `ona-contact-info`, `ona-contact-form` |
| **Header / footer** | `header` (mega-menu via `_header-menu`, three variants), `header-announcements`, `footer` + `footer-brand` + `footer-utilities` | legacy header/footer |
| **404, password, generic page** | `main-404` + `product-list`, `password`, `main-page` + `page-content` | same |
| **Promo badges** | `blocks/ona-product-tags.liquid`, `snippets/ona-product-tags.liquid`, `snippets/ona-product-tags-pdp.liquid` — full metafield-driven system | ported, present |
| **Brand type** | `snippets/brand-fonts.liquid` — Karla + Silk Serif as local woff2, mapped onto Horizon's `--font-*--family` | — |
| **Analytics** | Horizon standard events via `@shopify/events` (`page-view-event.js`, `view-event-elements.js`) | **better than legacy**, which emits none |
| **WFG counter** | `sections/ona-donation-counter.liquid` — PR #149 | ported |

The locations page is the clearest proof the strategy works: three legacy bespoke
sections became three purpose-built Formswell sections, and it is *already built*.

## 2. Dead weight — delete, nothing to decide

Measured against live: **no active resource uses these.**

**Eight of thirteen legacy product templates are orphans.** Zero active products:
`product.box.liquid`, `product.custom-template.liquid`, `product.custom2.liquid`,
`product.raspberrycandydripsbags.liquid`, `product.staple-tee.liquid`,
`product.non-purchasable.liquid`, `product.Reserve Box.liquid`,
`product.Reserve box-4bags.liquid`.

**`page.melbourne.json`** — zero pages carry suffix `melbourne`; `melbourne-bookings`
uses `bookings`.

**The `article` suffix is already dead** — see §3.5.

**`page.llms` and `page.maintenance` need nothing.** Both suffixes exist on live pages,
but the template files exist in *neither repo and not on the live theme either* —
checked by filename against theme `160335790271`. Those two pages already fall back to
`page.json` today. They are not a regression; they are the status quo.

That is ten templates off the list before any work starts.

## 3. Needs a decision

### 3.1 The coffee badges print on every product — including a kettle

`blocks/pdp-product-summary.liquid` resolves its two badges and its description from
`accentuate.range`, `accentuate.roast`, `accentuate.tastes_like`, and falls back to the
literal values stored in `templates/product.json` when a metafield is blank.

Measured coverage across all 92 active products:

| suffix | n | `range` | `roast` | `tastes_like` | `content_product_info` | `video_url` |
|---|---|---|---|---|---|---|
| (none) — coffee | 36 | **0** | 25 | 29 | 0 | 0 |
| `product-2` — equipment | 26 | **0** | 0 | 0 | 20 | 6 |
| `product-3` — merch | 22 | **0** | 0 | 0 | 7 | 0 |
| `Default product` — coffee | 6 | **0** | 6 | 6 | 0 | 0 |
| `filtersub` — subscriptions | 2 | **0** | 2 | 2 | 0 | 0 |

`accentuate.range` is **empty on all 92 products**. So on cutover, every single PDP
prints the stored fallback **"Staple Range"**. And all 48 equipment and merch products
print **"Best with Milk"** and **"Caramel, biscuits, nuts and spices"**, because they
have no `roast` and no `tastes_like` either.

**Decision needed:** populate `accentuate.range` (and accept that equipment/merch will
never have it, so the badge must be allowed to be absent), or blank the literal
fallbacks in `templates/product.json` and treat the badges as optional. Either is a
one-hour change (estimate). Shipping neither puts "Best with Milk" on a Hario dripper.

### 3.2 PR #142 should be closed, not merged

PR #142 is titled "Restore PDP customizer template blocks". Reading the diff: it
**deletes `pdp_product_summary`** and re-enables `group_icgrde`, `best_for_pdp`,
`tastes_like_pdp` and a divider.

That is a straight revert of the Formswell PDP header to Horizon's default arrangement.
`pdp_product_summary` already renders the title, the price, both badges and the
description, and it reads the same `accentuate` keys that `best_for_pdp` (`roast`) and
`tastes_like_pdp` (`tastes_like`) read — which is exactly why those two were disabled.
Merging #142 would not duplicate anything — it removes the summary block from both
`blocks` and `block_order`, so the group *replaces* it. The regression is the loss of
the bespoke Formswell header and the return of Horizon's default arrangement, which is
reason enough to close it. (Codex flagged the duplication wording on PR #150; it was
wrong and is corrected here.)

**One thing in #142 is real:** `ona_promo_tags` lives inside the disabled
`group_icgrde`, so the metafield-driven promo badge renders **nowhere on the PDP**.
The fix is not the revert — it is to lift `ona_promo_tags` out of the disabled group
into `product-details`'s `block_order`. `blocks/_product-details.liquid` accepts
`@theme`, so it already allows the block, and `blocks/ona-product-tags.liquid` already
renders nothing when no badge is active and shows a placeholder in design mode only.

**But check what live actually does before calling this a regression.** Traced through
the legacy theme rather than assumed:

| surface | live | `ona_theme2026` |
|---|---|---|
| product cards (home, collections, search, recommendations) | **badge shown** — `snippets/ona-product-card.liquid:42` | **placed, PR #149 `d11e425`** → parity |
| coffee PDP | **no badge** — `sections/ona-product-information.liquid`, which live's `product.json` uses, has zero badge references | no badge → **parity** |
| equipment PDP (`product-2`) | badge shown — `sections/product-template-2.liquid:77` | no badge → missing |
| merch PDP (`product-3`) | badge shown — `sections/product-template-3.liquid:45` | no badge → missing |

(`sections/ona-product-template.liquid` does carry badge markup, but no template
references it — it is dead.)

All **14** products in the `donation-products` collection are coffee (suffix `""` or
`Default product`); none is `product-2`/`product-3`. So the live WFG badge appears on
**cards only**, never on a WFG product's own PDP. Two consequences:

- The **cards** gap was the live-visible, campaign-relevant one. It is **shipped** in the
  repo as of PR #149 (`d11e425`), on all four card surfaces live uses. What remains is not
  code: importing `collection.json` and `search.json`, and the surgical inserts for
  `index.json` and `product.json` (§4.3).
- Placing `ona_promo_tags` on the 2026 PDP would show the badge on 14 coffee PDPs where
  live shows none. That is a deliberate improvement, not a parity fix — and the legacy
  code argues for it: `product-template-2.liquid` places the badge "under the price, not
  after the form … otherwise the add-to-cart button comes before the discount is ever
  disclosed." In Formswell's block order that is immediately after `pdp_product_summary`
  and before `variant_picker`.

One edge case: In Sequence carries **two** simultaneously active badges (`Limited
Edition` to 2027-02-20 and `$5 per retail box donated to Water For Good` to 2026-10-31),
and `ona-product-tags` renders every active, in-window badge. Confirm the design takes
two before placing it.

**Done, not a decision:** the cards gap is closed in PR #149 (`d11e425`). The badge is
placed on `index.json` (`coffee_spotlight`), `collection.json`, `search.json` and
`product.json`'s recommendations, straight after the gallery as live has it, and
deliberately **not** on `cart.json` or `404.json`, because live's badge-bearing card
snippet is not used there either.

**Decision needed:** close #142, and decide whether coffee PDPs gain a badge live does
not have. Placing it would disclose the contribution before add-to-cart on all 14 WFG
products — which is what the legacy comment argues for — but it is an improvement on
live, not parity, so it is a call rather than a fix.

### 3.3 Equipment and merch: one template or three?

| | legacy section | lines | what it carries beyond title/price/variants/ATC |
|---|---|---|---|
| `product-2` (26 equipment) | `product-template-2` | 683 | `accentuate.video_url` + `video_background`, `content_product_info`, `video_of_product`, a repeatable `title` spec list |
| `product-3` (22 merch) | `product-template-3` | 165 | **nothing** |
| `filtersub` (2 subscriptions) | `product.filtersub.json` | — | **nothing — it is the *stripped* template**: `ona-product-information` + accordion + complementary + recommendations, with profile, sourcing, image-slider, origin and brew-guide all explicitly `disabled` |
| `Default product` (6 coffee) | `product.default.json` | — | one extra `ona-read-more-content` |

So:

- **`product-3` folds onto the single Formswell PDP today.** It is a plain commerce page.
  The only blocker is the badge fallback in 3.1.
- **`filtersub` needs *less*, not more.** It was never a richer template — it is
  `product.json` with the coffee storytelling switched off. In 2026 terms that is the
  same template minus the `story` and `brew_guide` sections. The subscriptions are ~24%
  of the WFG campaign by value, so this one is worth getting right, but it is a
  settings decision, not a build.
- **`product-2` is the only genuine gap.** 20 of 26 equipment products have
  `accentuate.content_product_info` and 6 have `accentuate.video_url`, and the 2026 PDP
  renders **neither**. Its `properties_table` block only reads `accentuate.components`.
  (`properties_table` is present and enabled on the shop's PDP too, so extending it is
  the real path — but note the paired-array loop worth copying lives in the `brew_guide`
  custom-liquid, which is *disabled* on the shop. Copy the code, not the wiring. §4.3.)
  The Horizon pieces all exist (`story-video`, `product-tabs`, `product-highlight`,
  `media-with-content`, `product-custom-property`, `custom-liquid`) — they just need
  assembling once.
- **`Default product`**: decide whether `ona-read-more-content` is covered by the
  `story` custom-liquid section, or whether those 6 products lose content.

**Decision needed:** does equipment get its own `product.equipment.json`, or does the
single PDP grow an optional specs/video region that stays empty for coffee? Everything
else folds.

### 3.4 Pages — which get a Formswell rebuild and which fold onto `page.json`

**Seventeen** live pages carry a bespoke suffix, across **13** distinct suffixes
(26 pages total: 6 carry no suffix, `contact` is already ported, and `maintenance` and
`llms` have no template on any theme — see §2). Those 17 split 5 / 1 / 2 / 9: five
fold cheaply, one is already built and only mis-wired, two need real design time, and
nine share five layouts. Sorted by how much is actually there:

**Fold onto `main-page` / `custom-liquid` — cheap, no design work**
| page | suffix | legacy sections | 2026 equivalent |
|---|---|---|---|
| `privacy` | `privacy` | `ona-privacy-layout` | `main-page` + `page-content` |
| `shipping-information` | `text-template` | `ona-text-editor-box` | `main-page` + `page-content` |
| `sitemap` | `html-sitemap` | `custom-liquid` | `custom-liquid` section (already exists) |
| `faq` | `faq` | `ona-faq-layout` | `accordion` + `_accordion-row` blocks |
| `subscription-faq` | `faq-subscriptions` | `ona-faq-layout` | same |

**Needs a Formswell rebuild — real landing pages**
| page | suffix | legacy sections | note |
|---|---|---|---|
| `wholesale` | `wholesale` | **19** | the big one. Five of those 19 are the duplicated `sourcing-v2…v6`; ~8 distinct layouts (estimate) |
| `barista-courses` | `training` | **10** | four are the duplicated `traning-sourcing` family |
| `about` | `about` | 7 | banner, content, philosophy, awards, sustainability ×2, careers |
| `solar`, `recycled-boxes`, `womenincoffee` | `sustainability` | 2 | three pages, one template |
| `canberra-bookings`, `sydney-bookings`, `melbourne-bookings` | `bookings` | 4 | three pages, one template. The functional part is `ona-training-iframe` — **6 lines** |
| `private-courses-and-experiences` | `private-courses-...` | 3 | `ona-expericences-content` |
| `learn` | `learn` | 2 | `ona-brewguides-and-training` |

**Already built, just mis-wired** — see §4.

**Decision needed per group, not per page:** `wholesale` and `barista-courses` are the
only two that need design time. Of the remaining fifteen, five fold onto `main-page`
or `custom-liquid`, `locations` is already built (§4), and the other **nine** are
**five** shared layouts — `about`, `sustainability` (3 pages), `bookings` (3 pages),
`private-courses-and-experiences` and `learn`.

### 3.5 Blogs and articles

Exact counts from the Admin API: **795 articles** across five blogs — `brewguides` 747,
`news` (Journal) 43, `flagship-stores` 5, `recipes` 0, `news-1` 0.

| resource | suffix | count | legacy template | decision |
|---|---|---|---|---|
| `brewguides` blog | `brewguides` | 1 blog | `ona-blog-template` + `ona-read-more-content` + `ona-faq-lists` | fold onto `main-blog`; decide whether the read-more and FAQ strips survive |
| `news` (Journal) blog | `news` | 1 blog | `ona-blog-news-template` | fold onto `main-blog` |
| Journal articles | `news` | **43** | `ona-article-news-template` | fold onto `main-blog-post` — the only article template that needs a decision |
| brewguides + flagship articles | `""` or `article` | **752** | `ona-article-template` | already covered by `article.json` |

**The `article` suffix is already dead.** Older brewguides articles carry
`templateSuffix: "article"`, but `templates/article.article.json` exists on **neither
the live theme nor the 2026 theme** — checked by filename against both. Those articles
already fall back to `article.json` today, exactly like `llms` and `maintenance`. No
work, no decision.

So of 795 articles, **43 need a decision** and 752 are already handled.

## 4. Wiring bugs — no decision, just fix

1. **`page.locations.json` never renders.** The live page carries suffix **`location`**
   (singular); both the repo and the shop theme `154676789439` ship
   `templates/page.locations.json` (plural, 706 b) and no `page.location.json` —
   verified by filename against the theme. Rename the file or re-point the page. The
   page itself is finished; this is the single highest-value fix on the list.
2. **The promo badge on equipment/merch PDPs** — live's `product-template-2`/`-3` show
   it, the 2026 PDP does not. Cards are now at parity (PR #149 `d11e425`) and coffee PDPs
   already match live, which shows none (see §3.2).
3. **Repo ↔ shop drift — and the repo is NOT the source of truth for JSON templates.**

   **There is no GitHub integration, deliberately.** Files are imported into Shopify
   one at a time, specifically so that a push cannot overwrite the custom JSON that
   lives on the Shopify side. Nothing here is a broken connection, and **connecting
   GitHub would destroy editor work** — see the table below for what would be lost.

   Compared structurally (parsed and diffed section by section, not by file size, which
   hid this) against theme `154676789439`, at **`main` as of `ed3261d`, i.e. after
   PR #149 landed**. Stating the baseline matters: all four JSON templates below also
   carry #149's `ona_promo_tags` block, which the shop does not have yet — that is the
   change being shipped, not drift.

   | file | shop vs repo `main` (`ed3261d`) | safe to import whole? |
   |---|---|---|
   | `templates/collection.json` | differs by **exactly** `ona_promo_tags`; identical at `f78e8cf`, nothing shop-side to lose | **yes** — and importing it is what ships the badge |
   | `templates/search.json` | same | **yes** — same |
   | `templates/index.json` | `ona_promo_tags` **plus 5 sections only on the shop** | **no** — surgical insert only |
   | `templates/product.json` | `ona_promo_tags` **plus 5 sections only on the shop**, 5 more differ, `order` differs | **no** — surgical insert only |
   | `sections/ona-donation-counter.liquid` | **absent from the theme** | yes — new file, nothing to lose |

   So the rule is not "is it identical" but **"does the shop hold anything this file
   would overwrite"**. For `collection.json` and `search.json` it does not, so importing
   them whole is both safe and the delivery mechanism. For `index.json` and
   `product.json` it does, so they can only be edited in place.

   Only on the shop's `index.json`: `floating_badge_r89NRP`, `slideshow_nBcaMx`,
   `club_benefits_937XiA`, `story_video_LN6zzn`, `section_LpJJ4p`.
   Only on the shop's `product.json`: `product_tabs_fW4maV`, `product_dna_trxBBN`,
   `story_video_VUwQ6f`, `inline_cta_8ann9f`, `section_EhyeAD`.

   **The consequence that matters: the repo's `templates/product.json` is not the PDP
   that renders.** All five of those sections exist in the repo as `sections/*.liquid`
   files — only the *wiring* is shop-side. And on the shop the three custom-liquid
   sections are **disabled**: `story`, `brew_guide` and `faqs`. So reading the PDP from
   the repo alone gives the wrong answer, which is how §3.1–§3.3 first got written.

   **A content gap falls straight out of this.** The shop's `product_tabs_fW4maV` has
   three tabs — `Profile` (populated), **`Brew Guide` (empty)** and **`Reviews`
   (empty)** — while the `brew_guide` and `story` sections that used to carry that
   content are disabled. Nothing else on the enabled PDP reads
   `accentuate.content_brew_guide`, `title_item`/`content_item`, `content_origin` or
   `content_sourcing`. On the real 2026 PDP today, brew-guide recipes, origin and
   sourcing copy therefore render **nowhere** — even though `accentuate.content_brew_guide`
   is populated on **32** products (of 44 coffee: 36 no-suffix, 6 `Default product`,
   2 `filtersub`), and `title_item`/`content_item` on the same 32. This is the largest
   content regression on the list and it is invisible from the repo.

   So PR #149 landing changes nothing on the storefront by itself. Deploying the counter
   means importing `sections/ona-donation-counter.liquid` (safe) and adding the section
   to the **shop's** `index.json` rather than uploading the repo's. `collection.json` and
   `search.json` can be imported whole, which is what ships the card badge on collection
   and search; the homepage and recommendations card badge needs the same surgical
   treatment as the counter.

   `templates/cart.json` and `templates/404.json` were identical when measured and are
   untouched by PR #149.

## 5. What this means for scheduling

Under the fold-don't-port strategy the long pole is **two pages** — `wholesale` and
`barista-courses` — not 28 templates. Everything else is: delete ten orphans, fix three
wiring bugs, make four product-template decisions, and rebuild five shared page layouts
from Horizon generics.

Suggested order:

1. **Deploy what is already merged — it is not on the shop yet.** PR #149 landed as
   `ed3261d` and changed nothing on the storefront (§4.3). Concretely: import
   `sections/ona-donation-counter.liquid` (new file, nothing to lose); import
   `templates/collection.json` and `templates/search.json` whole, which is what ships the
   card badge there; then insert the counter section and the `ona_promo_tags` card block
   into the **shop's** `index.json` and `product.json` by hand, because each holds five
   sections the repo does not. Do not upload either of those two files.
2. Fix the `location` / `page.locations` mismatch. (hours — estimate)
3. Settle the badge fallbacks (§3.1) — this one is live-visible on all 92 PDPs — and
   close PR #142. Settle the Palmer Lake vs Silk Serif CTA with Formswell.
4. Delete the ten orphan templates.
5. Decide `product-2`: own template, or an optional specs/video region on the one PDP.
6. Fold the five cheap pages and both blogs.
7. Rebuild `about`, `sustainability`, `bookings`, `learn`,
   `private-courses-and-experiences` from Horizon generics.
8. Rebuild `wholesale` and `barista-courses` with Formswell.
9. Then — and only then — bump Horizon 4.1.4 → 4.3.0 (26 real conflicts, 8 files with
   line-level overlap, 59 lines; measured). Not the night before.

## Appendix — legacy sections with no 2026 equivalent yet

Grouped by the page that needs them, so nothing is ported speculatively:

- **wholesale**: `ona-wholesale-partnership`, `ona-wholesale-sourcing-v2…v6` (one
  section, five uses), `ona-icon-and-content`, `ona-training`, `ona-unique-coffees`,
  `ona-expressions`, `ona-sourcing`, `ona-supported`, `ona-wholesale-testimonial`,
  `ona-cafe-testimonial`, `ona-exclusive-access`, `ona-gust-r`, `ona-wholesale-brands`,
  `ona-faq-lists`
- **training**: `ona-training-banner`, `ona-training-image-text`,
  `ona-traning-sourcing` + `-v2…v4` (one section, four uses), `ona-traning-supported`,
  `ona-training-form`, `ona-training-text-two-images`, `ona-training-text-image-bg`
- **about**: `ona-inner-banner`, `ona-content`, `ona-our-philosophy`, `ona-awards`,
  `ona-sustatnability`, `ona-sustainability-list`, `ona-careers`
- **bookings**: `ona-sr-heading`, `ona-bookings-top`, `ona-training-iframe` (6 lines),
  `ona-faq-lists`
- **misc**: `ona-page-title`, `ona-bread-crumbs`, `ona-expericences-content`,
  `ona-brewguides-and-training`, `ona-sustainability-layout`, `ona-privacy-layout`,
  `ona-faq-layout`, `ona-text-editor-box`, `ona-read-more-content`

`ona-page-title`, `ona-sr-heading` and `ona-bread-crumbs` are scaffolding that Horizon's
section/heading blocks already provide — they should not be ported at all.
