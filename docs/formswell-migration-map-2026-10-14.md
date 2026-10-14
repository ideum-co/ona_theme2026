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
| **PDP** | **as wired on the shop:** `product-information` → `_product-media-gallery` + `_product-details` (`pdp-product-summary`, `variant-picker`, `purchase-options`, `buy-buttons`, description, `properties_table`) + `product-tabs` + `story-video` + `product-dna` + a content section + `product-recommendations` + `inline-cta`. **Reconciled 2026-10-14: the repo's `templates/product.json` now carries exactly this wiring and is what renders** (PR #151, verified on the theme — §4.3). It also still defines `story` / `brew_guide` / `faqs`, kept `disabled` because bespoke sections supersede them; `faqs` is the one to re-enable, since it is the only product-FAQ renderer (step 5). **Do PDP work in the repo, never on the shop copy** |
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

That is **nine template files to delete** — the eight product templates plus
`page.melbourne.json` — and **three suffixes that need no work and have no file to
delete**: `article`, `llms` and `maintenance`. Twelve items off the list before any work
starts, but only nine of them are deletions.

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
prints the stored fallback **"Staple Range"**. And **55 of the 92** also print **"Best
with Milk"** and **"Caramel, biscuits, nuts and spices"**, having neither `roast` nor
`tastes_like`: the 26 equipment, 22 merch, 6 gift cards and the Milk Blend Bundle. The
other 37 take the correct values from the metafields — but still print "Staple Range" as
badge 1, which is wrong for anything in Reserve (21), Rare (8) or Special Release (9).

One more, cheap: `roast` values are inconsistent — `Milk-based`, `Milk-Based`, `Espresso`,
`Espresso ` with a trailing space, `Filter` — and `pdp-product-summary.liquid` renders
`{{ badge_1 | escape }}` with no `| strip`. Add the filter whichever option wins.

**Decision needed:** populate `accentuate.range` (and accept that equipment/merch will
never have it, so the badge must be allowed to be absent), or blank the literal
fallbacks and treat the badges as optional. Shipping neither puts "Best with Milk" on a
Hario dripper.

**However this is decided, it ships through the repo (§4.3).** The settings live in
`templates/product.json`. Once PR #151 restores the editor's wiring into the repo, that
file is the PDP that renders and the integration deploys it on merge — so the change is
an edit to `pdp_product_summary`'s settings in the repo, merged to `main`. Doing it as a
shop-side edit instead would work until the next merge touching `product.json`
overwrote it, which is the trap that cost ten sections on 2026-10-14.

**This is not only about badge labels, and it is the largest pre-publish blocker in this
document.** `templates/product.json` is the **only** product template in this theme —
there is no `product.product-2.json`, no `product.product-3.json`, no
`product.filtersub.json` — so **all 92 active products render it**, coffee, equipment and
merch alike. Four of its enabled sections carry hard-coded **Maple** copy, none of them
metafield-driven, none disabled:

| section | what every PDP prints |
|---|---|
| `product_tabs_fW4maV` | *"The maple tree's enduring strength speaks to our commitment to nature and sustainability… Maple was created to be a traditional style milk…"*, a static `<p>Caramel, biscuts, nuts and spices</p>`, **and a `maple.webp` image** |
| `story_video_VUwQ6f` | *"Over the years, Maple has become one of ONA's most familiar coffees."* / *"Creating a coffee that feels unmistakably like Maple."* |
| `product_dna_trxBBN` | the heading **"Maple DNA"**, and *"the flavour stays true to Maple."* |
| `section_EhyeAD` | the panel **"Who's Maple For?"** |

Verified on the theme 2026-10-15 by fetching one product of every suffix — a Kenyan
single origin (no suffix), `aspen` (`Default product`), `ona-plastic-keep-cup`
(`product-2`, equipment), `ona-vest` (`product-3`, merch) and
`single-origin-subscription-filter` (`filtersub`). **All five print all four.** An ONA
vest's product page currently says "Maple DNA" and "Who's Maple For?".

Note the tab's `Caramel, biscuts, nuts and spices` string: it is the **same literal, typo
included**, as `pdp-product-summary`'s description fallback. So the issue is one issue —
**static single-product copy sitting on the one shared template**, overridden per product
only where a metafield happens to be populated: `range` (0 of 92), `roast` (33),
`tastes_like` (37). Decide it once, as one question, rather than seven times.

How this was found is worth keeping: the static copy is invisible to any check that reads
the template, because nothing in the JSON marks it as single-product. It shows up only by
rendering a PDP that is *not* Maple. **Before publishing, fetch one product of every
suffix and read the page.** Codex raised `story_video_VUwQ6f` and `section_EhyeAD` on
PR #150; I had documented only the tab; `product_dna_trxBBN` and the `maple.webp` image
were missed by both of us and turned up only in that per-suffix render.

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
  repo as of PR #149 (`d11e425`), on all four card surfaces live uses, and two of those
  four — `collection.json` and `search.json` — reached the theme when #149 merged. The
  remaining two, on `index.json` and `product.json`, ride along with PR #151 (§4.3).
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
3. **Repo ↔ shop drift — the integration is live, and a merge to `main` is a deploy.**

   **Theme `154676789439` IS GitHub-connected.** Its name, `ona_theme2026/main`, is the
   integration's own `repo/branch` convention. A commit to `main` that touches a file
   makes Shopify pull that file within seconds, overwriting whatever the theme editor
   holds. The connection **cannot be removed**, so the repo has to *carry* the editor's
   work rather than be kept away from it.

   This was established the hard way, and an earlier version of this section had it
   backwards: it said the integration was inert and that merging #149 "changed nothing
   on the storefront". The merge at 06:51:26Z pulled at 06:51:31–34Z and destroyed ten
   editor-made sections across the two templates, replaced editor-set values on eighteen
   more, and re-enabled three that were deliberately off. The theme is unpublished and
   MAIN (`160335790271`) was untouched, so no customer saw it; PR #151 restores it. The
   reason the wrong inference looked sound is the part worth keeping: `index.json` and
   `product.json` had not been committed since 2026-09-07, so no pull had ever touched
   them, while the editor diverged them on 09-29 and 10-05. **Absence of a push is not
   absence of a connection.**

   There is a reliable per-file test:

   > The integration stores the repo's bytes **verbatim**, so a file it wrote has a theme
   > `checksumMd5` equal to the md5 of the repo file. The theme editor stores a minified
   > form, so a file it wrote does not. **Equal → the integration owns it, merging is
   > safe. Unequal → the editor has diverged it, and the shop copy must be merged into
   > the repo before anything lands.**

   Measured that way on 2026-10-14, after PR #151 was prepared:

   | file | state | before merging a change to it |
   |---|---|---|
   | `templates/collection.json` | checksum **matches** repo `ed3261d` — integration-owned | safe; `ona_promo_tags` already shipped |
   | `templates/search.json` | checksum **matches** repo `ed3261d` — integration-owned | safe; same |
   | `templates/index.json` | #151 merged at 12:29:57Z and this file **did not pull** — 28 sections, over the limit below. PR #152 brings it to 25 | re-check the checksum, and stay out of the editor until it lands |
   | `templates/product.json` | restored: pulled 12:30:04Z, checksum now `d0a1df63…` = md5 of the repo file. Carries the `product_tabs_XnTEpK` placeholder the editor added at 09:32Z | as above |
   | `sections/ona-donation-counter.liquid` | pushed by the integration at 06:51:31Z | already on the theme |
   | `blocks/_product-card.liquid` | pushed at 06:51:31Z, carries the `ona-product-tags` schema type | already on the theme |

   **A merge is not a deploy until the pull is verified.** Merging #151 proved the
   integration can accept one file and silently drop another in the same commit.
   `product.json` (11 sections) pulled seven seconds later; `index.json` never pulled at
   all, because at 28 sections it was over Shopify's documented limit of **25 sections
   per JSON template, and 50 blocks per section**
   ([docs](https://shopify.dev/docs/storefronts/themes/architecture/section-groups)).
   Over the limit, the integration declines **the whole file** — no error, no commit
   status, no check run, nothing surfaced in the admin. And because the repo was by then
   correct, the only observable symptom was a checksum that had not changed: still equal
   to md5 of the file at `ed3261d`, which is the copy #149 destroyed it with. Had the
   checksum not been re-read after the merge, the homepage would have looked repaired in
   the repo and stayed broken on the theme until go-live.

   Two consequences worth carrying:

   - PR #152 drops the three sections in `index.json` that had never been on the theme
     (`good_coffee_delivered`, `more_than_coffee`, `custom_liquid_RCcpAV` — repo-authored,
     disabled, rendering nothing; definitions parked in
     `docs/index-json-parked-sections-2026-10-14.json`). That leaves **the homepage at
     exactly 25 of 25**. Adding a section there now means removing one in the same change,
     and that is a hard platform limit, not a preference.
   - `tests/shop-owned-templates.test.mjs` now asserts both limits across every
     `templates/*.json`, so the refusal fails the suite instead of reaching the theme.

   So the rule is no longer "import this file whole, edit that one in place" — there is
   no importing step at all, because every merge deploys. The rule is **reconcile the
   shop's copy into the repo first, then merge once, then re-read the checksums to
   confirm every file you touched actually pulled**, and the test above is how you know
   whether reconciling is needed.

   The ten sections that were shop-only, destroyed by the #149 merge and restored into
   the repo by PR #151 — on `index.json`: `floating_badge_r89NRP`, `slideshow_nBcaMx`,
   `club_benefits_937XiA`, `story_video_LN6zzn`, `section_LpJJ4p`; on `product.json`:
   `product_tabs_fW4maV`, `product_dna_trxBBN`, `story_video_VUwQ6f`,
   `inline_cta_8ann9f`, `section_EhyeAD`.

   **The consequence that mattered: the repo's `templates/product.json` was not the PDP
   that renders.** All five of those sections exist in the repo as `sections/*.liquid`
   files — only the *wiring* was shop-side. And on the shop the three custom-liquid
   sections are **disabled**: `story`, `brew_guide` and `faqs`. Reading the PDP from the
   repo alone therefore gave the wrong answer, which is how §3.1–§3.3 first got written.
   **Once PR #151 merges this stops being true** — the repo's copy becomes the PDP that
   renders, because it now carries the editor's wiring. That is the point of the restore:
   one source of truth, held in the place the integration deploys from.

   **A content gap falls straight out of this.** The shop's `product_tabs_fW4maV` has
   three tabs — `Profile` (populated), **`Brew Guide` (empty)** and **`Reviews`
   (empty)** — while the `brew_guide` and `story` sections that used to carry that
   content are disabled. Nothing else on the enabled PDP reads
   `accentuate.content_brew_guide`, `title_item`/`content_item`,
   `content_coffee_profile`, `image_coffee_profile_1`/`_2`, `content_origin`,
   `content_sourcing`, `image_origin`, or the flat sourcing specs
   (`producer`, `region`, `varietal`, `process`, `altitude`). On the real 2026 PDP today,
   brew-guide recipes, the Coffee Profile prose and imagery, and origin and
   sourcing therefore render **nowhere** — even though `accentuate.content_brew_guide`
   is populated on **32** products (of 44 coffee: 36 no-suffix, 6 `Default product`,
   2 `filtersub`), and `title_item`/`content_item` on the same 32. This is the largest
   content regression on the list and it is invisible from the repo.

   **And a fifth surface, measured 2026-10-14: `accentuate.image`, the lifestyle
   gallery, is populated on 37 products and read nowhere in this theme** — more
   widely than the brew guide. It is a `json_string` array of raw
   `cdn.accentuate.io` URLs, not native Shopify media, so there is no srcset or
   CDN transform. Each URL carries a `?WIDTHxHEIGHT` suffix from Accentuate's
   resize service, and the legacy theme parses that suffix back into explicit
   `width`/`height` attributes so the browser can reserve the space; its own code
   comment cites a measured CLS improvement from doing so. **Any port must
   replicate that or CLS regresses** — see `product-page-enrichment-sections.md`
   §5. Raised by Codex on PR #150; I had called brew guide, origin and sourcing
   the complete gap, and they are not.

   Where this data actually lives, measured on 2026-10-14 across all 92 active
   products, because the repo's own §2 of `product-page-enrichment-sections.md`
   said otherwise and Codex reasonably believed it:

   | metafield | populated on | lives on |
   |---|---|---|
   | `accentuate.title_item` / `content_item` (the spec table) | **32** products | **the product** |
   | `accentuate.image` (lifestyle gallery) | **37** products | the product |
   | `accentuate.select_artlice` (brew-guide article pointer) | **24** products | the product, pointing at a `brewguides` article |

   The spec table is **product** data and zips the two parallel arrays by index:
   `maple` carries 7 labels and 7 values, `aspen` 6 and 6, and the values differ
   per product (`14-30 days after roast` vs `13-30`). So rendering the table needs
   nothing but the product. The `select_artlice` pointer is a *separate, narrower*
   surface — 24 products, not 32, and absent on every drip bag that has a spec
   table — which the legacy section follows into the `brewguides` blog (747
   articles) for the surrounding prose. Port the table from the product; if the
   prose is wanted too, follow the pointer — but **do not strip the prefix by
   default.** Liquid's global `articles[...]` is keyed by the *compound* handle
   `blog-handle/article-handle`
   ([docs](https://shopify.dev/docs/api/liquid/objects/articles)), so the stored
   `brewguides/maple` is already exactly the right key: `articles[pointer]` resolves
   it directly. Only strip with `| split: '/' | last` if you instead loop the blog and
   compare against `article.handle`, which is bare. Codex, PR #150.

   PR #149 therefore did not "change nothing" — it deployed. `ona-donation-counter.liquid`,
   `_product-card.liquid`, `collection.json` and `search.json` all landed on the theme at
   06:51:31–34Z, which means the card badge on collection and search is already shipped.
   What #149 also did was overwrite the two shop-owned templates, which is what PR #151
   repairs; the counter and the two remaining card-badge placements ride along with that
   same restore rather than being hand-inserted.

   **Four defects come back with the restore, by design.** PR #151's contract is to
   return exactly what the merge destroyed, so it restores these unchanged rather than
   quietly editing content that is Formswell's and ONA's to decide. All four were
   verified byte-identical to the pre-merge shop copy; all four are **pre-publish items**,
   not regressions from #151. The theme is unpublished, so none is customer-visible today.

   | item | what renders | severity |
   |---|---|---|
   | `product_tabs_fW4maV` tab 1 | hard-coded Maple copy on **all 92 PDPs** (§3.1) | **blocker** |
   | `product_tabs_fW4maV` tabs 2 and 3 | `Brew Guide` and `Reviews` have **zero** child blocks — selecting either blanks the panel | blocker-adjacent; same fix as §5 step 5 |
   | `inline_cta_8ann9f` | `button_link: ""` under the label "Try our coffee quiz" — renders an unclickable `<span>` | needs a destination |
   | `club_benefits_937XiA` | `button_link: ""` under "Find your subscription" — renders an `<a>` with no `href` | needs a destination |

   The last two are the editor-settings form of the same bug Codex caught in #149's
   counter CTA, which that PR fixed in code by requiring both label and url to be
   non-blank. These two need destinations set, not a code change.

   `templates/cart.json` and `templates/404.json` were identical when measured and are
   untouched by PR #149.

## 5. What this means for scheduling

Under the fold-don't-port strategy the long pole is **two pages** — `wholesale` and
`barista-courses` — not 28 templates. Everything else is: delete nine orphan files, fix three
wiring bugs, make four product-template decisions, and rebuild five shared page layouts
from Horizon generics.

Suggested order:

1. ~~Repair the #149 damage and finish the campaign deploy.~~ **Done 2026-10-14, and
   verified on the theme.** Kept here as the record, because the verification is the
   part worth copying.

   #149 deployed `ona-donation-counter.liquid`, `_product-card.liquid`,
   `collection.json` and `search.json` (§4.3) — and overwrote the two shop-owned
   templates. #151 (12:29:57Z) restored `product.json` but was silently declined for
   `index.json` at 28 sections; #152 (`c410869`, 12:45:49Z) brought it to 25 and it
   pulled at 12:45:56Z. Final state, read back from theme `154676789439`:

   | file | checksum | == md5 of repo file |
   |---|---|---|
   | `templates/product.json` | `d0a1df63…` @ 12:30:04Z | yes |
   | `templates/index.json` | `260ba3fb…` @ 12:45:56Z | yes |

   All four campaign surfaces then confirmed rendering on the theme: the counter at
   `$11,129` with a working `/collections/donation-products` CTA, and the promo badge on
   the homepage (7), the `donation-products` collection (14, matching live), search (9)
   and the PDP recommendation cards (3, immediately after the gallery). All five
   destroyed PDP sections render again.

   The procedure, for the next change to a shop-owned template: run the §4.3 checksum
   test immediately before merging, keep everyone out of the theme editor until the pull
   lands, and **afterwards re-read the checksums and confirm each file you touched
   actually changed** — an unchanged checksum is the only symptom a silent refusal
   produces.
2. Fix the `location` / `page.locations` mismatch. (hours — estimate)
3. **Settle the static copy on shared templates (§3.1) — the biggest pre-publish item,
   live-visible on all 92 PDPs.** `templates/product.json` is the only product template,
   so every product renders the Maple tab (text *and* its `maple.webp` image), the Maple
   story-video, the "Maple DNA" panel and "Who's Maple For?" — on equipment and merch
   too. Settle those four together with the badge fallbacks; they are one question. Give
   **every enabled CTA with no destination** a destination. Scanned both live templates
   2026-10-15 for a non-empty label paired with an empty link — all of these render an
   `<a>` or `<span>` with no `href`:

   | section | template | label | state |
   |---|---|---|---|
   | `club_benefits_937XiA` | `index.json` | "Find your subscription" | **enabled** |
   | `story_video_URBFL6` | `index.json` | "Learn more about ONA" | **enabled** |
   | `coffee_quiz` | `index.json` | "Explore all our coffees" | **enabled** (shows after the quiz) |
   | `inline_cta_8ann9f` | `product.json` | "Try our coffee quiz" | **enabled** — on all 92 PDPs |
   | `club_invite_QLL4T3`, `club_invite_TGPaF8` | `index.json` | "Explore subscriptions" | disabled |
   | `club_benefits_QGRDdd` | `index.json` | "Join the ONA Coffee Club" | disabled |
   | `product_intro_k9p6yn` | `index.json` | "Shop now", "Subscribe & Save" | disabled |
   | `story_video_LN6zzn` | `index.json` | "Learn more" | disabled |

   The four enabled ones are pre-publish. The six disabled ones are not live, but they
   are **the same sections whose enabling is an open decision** (§4.3) — so give them
   destinations at the moment they are enabled, not after. Close PR #142. Settle the
   Palmer Lake vs Silk Serif CTA with Formswell. **Verify by fetching one product of
   every suffix and reading the page** — the no-suffix, `Default product`, `product-2`,
   `product-3` and `filtersub` cases — because static copy is invisible from the
   template.
4. Delete the nine orphan template files (§2). `article`, `llms` and `maintenance` need
   nothing — they have no file to delete and already fall back.
5. **Restore the PDP content that renders nowhere (§4.3).** This is the largest
   content regression on the list and nothing above fixes it. The shop's `brew_guide`,
   `story` and `faqs` sections are disabled and the `Brew Guide` and `Reviews` tabs have
   no child blocks, so every one of these renders nowhere today. Measured 2026-10-14
   across all 92 active products:

   | content | metafield | populated on | destination needed |
   |---|---|---|---|
   | brew-guide spec table | `accentuate.title_item` / `content_item` | **32** | the empty `Brew Guide` tab |
   | brew-guide prose | `accentuate.content_brew_guide` + `select_artlice` | 32 / **24** | same tab |
   | lifestyle gallery | `accentuate.image` | **37** | no renderer exists yet |
   | product FAQs | `custom.accordion` | **23** | re-enable `faqs`, or a tab |
   | Coffee Profile prose | `accentuate.content_coffee_profile` | **37** | read only by the disabled `story` section |
   | Coffee Profile images | `accentuate.image_coffee_profile_1` / `_2` | **37** each | no renderer exists yet |
   | origin / sourcing prose | `accentuate.content_origin` / `content_sourcing` | **25** | read only by the disabled `story` section |
   | origin image | `accentuate.image_origin` | **25** | no renderer exists yet |
   | sourcing specs | `accentuate.producer`, `region`, `varietal`, `process`, `altitude` | **25** each | read only by the disabled `story` section |

   **Two of these are removals, not ports, and both are live-visible defects:**

   - The **`Reviews` tab** is enabled with **zero child blocks**, so it is a clickable
     blank panel on every PDP. Nothing in this step populates it, and there is no reviews
     integration in the theme to populate it with. **Decide: wire a reviews app block, or
     delete the tab.** Shipping it as-is is a visible defect on all 92 PDPs, so this is
     pre-publish, not later. (Codex, PR #150 — the earlier rounds recorded it as a defect
     in §4.3 but left it out of the plan that was supposed to close it.)
   - The **`faqs` section** is the theme's *only* product-FAQ renderer and it is
     disabled, so the `custom.accordion` content on 23 products — coffee, equipment and
     merch alike — is dropped at go-live. Re-enable it in the right position, or move the
     accordion into a tab.

   **Origin and sourcing are one populated set, not two prose fields.** All eight fields
   above co-occur exactly: on the same **25** products, every one of
   `content_origin`, `content_sourcing`, `image_origin`, `producer`, `region`,
   `varietal`, `process` and `altitude` is present, and on the other 67 none is. So this
   is a single destination decision for a structured spec block plus an image, not a
   copy-paste of two rich-text fields — and the flat specs are the half most likely to be
   dropped, because the prose is the part anyone notices missing. Codex, PR #150.

   **Coffee Profile is half-ported, which is easy to miss.** §1 of
   `product-page-enrichment-sections.md` records the section as *already ported* — and
   the flat fields (`tastes_like`, `roast`, `components`) are. But live also renders
   `accentuate.content_coffee_profile` plus `image_coffee_profile_1`/`_2`, each populated
   on **37** products, and in this theme the prose is read only by the **disabled**
   `story` section while the two images have **no renderer at all**. So "ported" covers
   the fields and not the prose or the imagery. Codex, PR #150.

   Decide where each goes, then wire it **in the repo's** `templates/product.json`
   and deploy it by merging to `main` — the same route as every other change here, for the
   reason in §4.3: an edit made only on the shop's copy survives exactly until the next
   merge touches that file, and this is content on 32 products. Reconcile first if the
   checksum test says the editor has moved the file since #151 landed. Verify on one
   blend, one single origin and one drip bag before go-live — and, for the FAQs, one
   equipment and one merch product too, since `custom.accordion` spans all three. The
   spec table reads from the **product's** own `title_item`/`content_item`, so it needs
   no article lookup; the image slider is a renderer that does not exist yet and must
   preserve the `?WIDTHxHEIGHT` → `width`/`height` parsing, or CLS regresses. Finish by
   clicking every tab on a real PDP: none may open an empty panel.
6. Settle the three remaining product-template decisions (§3.3), all of which change
   what renders: `product-2` — own template, or an optional specs/video region on the one
   PDP; `filtersub` — whether the subscription PDP keeps omitting the coffee storytelling
   sections, which is the stripped template's whole premise and so is a deliberate yes/no,
   not an oversight; and the six `Default product` coffees — whether `ona-read-more-content`
   is covered by `story` or those six lose content when the suffix folds. Verify each on a
   real product of that suffix before go-live.
7. Fold the five cheap pages and both blogs — and with them the **43 `news`-suffix
   Journal articles** (§3.5), the only article group that needs a decision. They are a
   single call: point them at `main-blog-post` and delete
   `ona-article-news-template`, or keep a bespoke article template and port it. Nothing
   else in this order covers them, and they are live content.
8. Rebuild `about`, `sustainability`, `bookings`, `learn`,
   `private-courses-and-experiences` from Horizon generics.
9. Rebuild `wholesale` and `barista-courses` with Formswell.
10. Then — and only then — bump Horizon 4.1.4 → 4.3.0 (26 real conflicts, 8 files with
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
