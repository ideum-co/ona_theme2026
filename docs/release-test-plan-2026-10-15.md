# ona_theme2026 — release readiness: issue register and test plan

**For the release planned the afternoon of 2026-10-15.**
Owner of this document: whoever runs the release. Tick the boxes as you go; an
untested box is a reason not to publish, not a formality.

---

## 0. Where things stand

The 2026 theme was published on 2026-10-14 at ~15:43Z and **reverted** the same
evening: at 22:00:42Z theme `160815546559` ("PREVIEW - product media fills
column (PR #46)") was published and is live now. The revert was the right call —
UI quirks and image problems had surfaced, and §1 below lists what was found.

| | |
|---|---|
| **Live now** | `160815546559` — the old theme + the PR #46 PDP media fix. **Do not delete it.** |
| **Being released** | `154676789439` `ona_theme2026/main` — GitHub-connected to this repo's `main` |
| **Rollback** | publish `160815546559` again (not `160335790271`, which lacks the PR #46 fix and the `filtersub` cross-sell) |
| **Campaign running** | Water For Good, 1–31 October **inclusive**, counter at $11,792 |

Because the GitHub integration is live, **merging to `main` writes to
`154676789439` within about five seconds**. That is safe while it is
unpublished. The moment it is published again, a merge is a deploy — see
`docs/branching-and-release.md`.

---

## 1. Issue register

Severity is about customer impact if the theme is published as-is.
Status is as at 2026-10-15; **nothing here has been fixed yet.**

### P0 — must be fixed before publishing

| # | Issue | Evidence | Fix |
|---|---|---|---|
| 1 | **Homepage hero is a flat grey block.** The hero `<video>` reports `readyState 0`, `buffered 0`, `duration null`, `error null` after 6+ seconds — it never buffers a single byte. It has **no `poster` attribute**, so there is no fallback, and the first thing every visitor sees is empty grey. The asset itself is fine: the MP4 answers `HTTP 206`, `video/mp4`, 9,826,149 b. | Checked in preview on `154676789439`, 2026-10-15 | Add a `poster` image so the hero is never blank, **and** find why autoplay never starts. A 9.4 MB 1080p hero video also wants a hard look on its own merits. |
| 2 | **Eight pages render a heading and nothing else.** Their content lived in bespoke templates on the old theme; this theme has none, so they fall back to `templates/page.json`, which prints only the title and the page body — and these pages have empty bodies. | Measured live while published: `/pages/wholesale` **16 chars** of visible text, `/pages/barista-courses` 15, `/pages/about` 5, `/pages/learn` 5, 3× `*-bookings` 31–34, `/pages/private-courses-and-experiences` 31 | Port each template. Originals archived in `docs/legacy-page-templates/`. **Never fix this by re-pointing `templateSuffix`** — it is shop-wide and would move the page on the live theme too. |
| 3 | **All ten app embeds are off.** `config/settings_data.json` has no `"blocks"` key; the old theme's has ten, all enabled. MinMaxify Order Limits, EG Auto Add to Cart and Preorder Now each silently change what a customer can buy. Powerful Form Builder being off kills every Globo form. | `settings_data.json` 4,796 b vs 22,183 b; `/pages/contact` rendered a `globo-formbuilder` div that never hydrates; `/collections/all-coffee` had 0 `jdgm-` star ratings vs 135 | Every one of those apps is **still installed**, so it is a toggle each in Online Store → Customize → App embeds. Decide per app — Appstle's is genuinely redundant here. |
| 4 | **The Water For Good promise is missing from PDPs.** The live theme prints "$3 PER 200G AND $12 PER KILO DONATED TO WATER FOR GOOD" on participating products. On `154676789439` the string does not appear at all — zero occurrences of "water for good" anywhere on `/products/maple`. The counter still claims the money. | Checked in preview, 2026-10-15 | Port the PDP contribution line before publishing, or the campaign promises on the homepage what the product page no longer says. |
| 5 | **Maple-specific copy prints on all 92 products**, including an ONA merch vest and a V60 dripper: the maple-tree prose and `maple.webp`, "Maple has become one of ONA's most familiar coffees", and "Who's Maple For?". | `product_tabs_fW4maV`, `story_video_VUwQ6f`, `section_EhyeAD` all enabled on the single shared `templates/product.json` | Disable or rewrite all three. Fix the typo **"biscuts"** and the two "Shop now" buttons pointing at `shopify://collections/all` at the same time. |

### P1 — should be fixed before publishing

| # | Issue | Evidence | Fix |
|---|---|---|---|
| 6 | **Three dead CTAs.** The homepage "Brewing Guides" card has no link on either the group or its image, while its two siblings do; `coffee_quiz`'s "Explore all our coffees" and the PDP's "Try our coffee quiz" both have empty link settings. | Rendered HTML: `learn_with_ona` emits **two anchors for three cards**; `coffee_quiz` emits the label with no anchor in the section | col2 group link → `shopify://pages/brewing-guides`; give the other two destinations. |
| 7 | **Three pages lost their body**: `/pages/faq` (172 chars), `/pages/subscription-faq` (224), `/pages/contact` (138). The old `page.faq.json` is 11,754 b. | Measured live while published | Same as #2 — port the templates. |
| 8 | **Blog and product template variants lost.** `blog.brewguides.json`, `blog.news.json`, `article.news.json`, `product.filtersub.json`, `product.default.json` have no equivalent here. They fall back to templates that do render, so this is a design regression, not an outage. | Old theme file list vs this theme's | Decide per template. `filtersub` carries the cross-sell row — see #9. |
| 9 | **`filtersub` cross-sell would be lost.** The live theme's `product.filtersub.json` (12,780 b, 9 sections) includes `ona-product-complementary`. This theme has one shared `product.json` with `recommendation_type: "related"` and no complementary section anywhere. `filtersub` is the store's **highest-attach page — 8.05%, 5.7× baseline**. | The same file is in **`onacoffee_theme` `origin/main`, byte-identical** (`dc8be58f…`, 12,780 b); also archived at `docs/live-theme-160815546559/product.filtersub.json` | Port it from `onacoffee_theme`. Whatever the subscription PDP becomes, the complementary row has to come with it. |
| 10 | **`learn_with_ona` col1's image links to `shopify://blogs/news-1`**, a blog with **0 articles**. Inert today because the group link wraps the card, but it should not point there. | Live theme JSON | Repoint or clear. |

### P2 — fix when convenient

| # | Issue | Notes |
|---|---|---|
| 11 | **The homepage is at the hard 25-section cap**, 14 of them disabled. Nothing can be added until one is removed, and over the cap Shopify declines the whole file silently. | `tests/shop-owned-templates.test.mjs` guards the repo side. Three more sections are parked in `docs/index-json-parked-sections-2026-10-14.json`. |
| 12 | **PR #164's mobile `object-fit: contain`** letterboxes rather than crops, so the product occupies less area on a phone. Bags are the agreed baseline and the baseline is the bag's *area*. | Needs a real phone. Not verifiable here — Chrome clamps at ~1283 px and the storefront blocks iframes. |
| 13 | **The cart page never mentions the Water For Good contribution** — true on the live theme too, so not a regression. The PDP says it, the cart does not. There is an unpublished theme `160396837055` named "ONA - WFG cart contribution 2026-10-01" suggesting this was built and never shipped. | Campaign ends 31 Oct; worth deciding quickly or not at all. |
| 14 | **A variant carries a donation rate but sits outside the campaign collection**: `COFOSOF1 200g OpZ` — Thageini, Kenya ($9.00 counted so far). The counter reports the drift and counts it. | Either add Thageini to "Water For Good Contribution products" or clear the variant's `custom.donation_amount`. |
| 15 | **The counter's own log contradicts itself.** The header prints "Subscriptions — INCLUDED in the total above" while the sources table prints `subscription_contract_checkout_one <- skipped (subscription renewal)`. The arithmetic is right — renewals are counted — but the label will mislead whoever reads a log under pressure. | `scripts/ops/wfg-donation-counter.ts` in `ona-data-platform`. Cosmetic, but it is the kind of cosmetic that costs an hour at the wrong moment. |

### Verified working — do not re-litigate these

Each was checked, not assumed, on `154676789439` while it was published:

- **Subscriptions.** Native `selling_plan` radios with real plan IDs, zero Appstle references. The missing Appstle embed costs nothing on the storefront.
- **Judge.me.** Loads its own `loader.js` via the app block with the correct `data-product-id`; markup carries `data-empty-state="empty_widget"`, so a product with no reviews shows an empty widget, **not** fabricated reviews. `review_data: "sample_data"` is an editor-preview setting only.
- **Tracking.** GA4 `G-QX88TBZC3G` and Google Ads `AW-11235348093` arrive through Shopify's `web-pixels-manager`, not theme Liquid, so they are theme-independent. (A real test purchase is still owed — see T4.)
- **Water For Good counter, homepage.** Rendered correctly while the theme was live.
- **Blogs, collections, cart, search, 404.** All 200 with real content.

---

## 2. Test plan

Run against the **preview URL of `154676789439`**, not the live store. Pin the
preview first, because the cookie is sticky and will silently follow you:

```bash
curl -c jar -b jar "https://onacoffee.com.au/?preview_theme_id=154676789439"
```

In a browser, confirm you are on the right theme before trusting anything —
`Shopify.theme.id` should read `154676789439`. A stale preview cookie from an
earlier session is the single easiest way to test the wrong theme and sign off
on it.

### T1 — P0: money path (blocks the release)

Nothing else matters if this fails.

- [ ] **Add to cart, simple product.** 200 g and 1 kg variants, from the PDP.
- [ ] **Add to cart, from a collection card** (quick add), if the grid offers it.
- [ ] **Add to cart, subscription.** Selling plan attaches — the cart line must show the plan name, not just the product.
- [ ] **Mixed cart.** One subscription line plus one one-off line, correct total.
- [ ] **Quantity change** up and down from the cart; line and subtotal both update.
- [ ] **Remove a line**; cart empties cleanly and shows the empty state.
- [ ] **Cart drawer and `/cart` page agree** after each of the above.
- [ ] **Checkout button is present and reaches Shopify checkout** with the right line items and total. Stop at the first checkout screen — do not place an order here.
- [ ] **Accelerated checkout buttons** render (Shop Pay et al.).
- [ ] **Sold-out product** shows as sold out and cannot be added.
- [ ] **MinMaxify limits enforced**, if that embed is re-enabled (#3). Try to exceed a known limit.
- [ ] **Free gift / auto-add** fires, if EG Auto Add to Cart is re-enabled (#3).
- [ ] **Preorder product** shows its preorder button, if Preorder Now is re-enabled (#3).

> The API-level versions of the first four passed against the **current live**
> theme on 2026-10-15: `/cart/add.js` with and without a `selling_plan`,
> `/cart/change.js`, `/cart.js`, `/cart/clear.js` all behaved, and the checkout
> input is present. That is the live theme, **not** the release candidate —
> these have to be re-run against the preview.

### T2 — P0: the release-blocking defects

- [ ] **#1 Hero renders.** Something visible within one second on a cold load, on desktop and on a phone. A poster counts; grey does not.
- [ ] **#2 All eight blank pages have real content.** `/pages/wholesale`, `/pages/barista-courses`, `/pages/about`, `/pages/learn`, the three `*-bookings`, `/pages/private-courses-and-experiences`.
- [ ] **#3 App embeds** — each of the ten either enabled or written down as deliberately dropped, with who decided.
- [ ] **#4 WFG line is back on participating PDPs**, with the right amounts per size.
- [ ] **#5 No Maple copy on a non-Maple product.** Check a merch item and an equipment item, not just a coffee.

### T3 — P1: navigation and content

- [ ] **Every main-nav item** reaches a page with content: Shop, Subscriptions, Learn, Locations, Wholesale, Journal.
- [ ] **Footer links** all resolve; no 404s.
- [ ] **The three dead CTAs (#6)** now have destinations.
- [ ] **Collection filters** narrow results — `coffee_type`, `brew_method`, `origin`, `taste_notes`, availability, price.
- [ ] **Collection paging reaches every product.** `all-coffee` has **114**; the grid uses a load-more control, so confirm in a browser that you can get to the end rather than with `?page=`.
- [ ] **Search** returns results; **predictive search** suggests as you type.
- [ ] **Blog**: `brewguides` listing, an article, the Journal.
- [ ] **A 404** shows the themed 404 page.
- [ ] **Locations page** renders the store finder.
- [ ] **Contact form submits** and the submission arrives.

### T4 — P1: tracking (a publish gate, and it is silent when wrong)

Recorded *not started* in `docs/performance-and-compatibility.md`.

- [ ] **A real test purchase** lands in GA4 Realtime and DebugView with **revenue and session attribution intact**. The earlier `session_id` bug lost data without any visible symptom.
- [ ] **Webhooks fire** for that order, including **Admin-UI-created** ones — the exact prior gap.
- [ ] **Google Ads conversion** records against the same order.

### T5 — P2: UI and visual

This is where the first attempt came unstuck, so give it real time.

- [ ] **Images load on every template** — home, collection, PDP, blog, article, pages. No grey blocks, no broken icons.
- [ ] **Bag presentation matches the agreed baseline** — match the bag's **area**, not one dimension, and do not change the bags.
- [ ] **Real phone, not a resized desktop window.** Chrome here clamps around 1283 px, CSS zoom does not move media queries, and the storefront blocks iframes — the 749 px breakpoint cannot be reached from this environment at all. Hero, PDP gallery, cart drawer, nav drawer.
- [ ] **PDP gallery**: thumbnails, zoom, and #12's `object-fit: contain` on a phone.
- [ ] **Header**: logo, mega menu, cart count, search, account.
- [ ] **Fonts load** — no flash of fallback, no missing weights.
- [ ] **Colour and contrast** match the Formswell design.
- [ ] **No console errors** on home, collection, PDP, cart.
- [ ] **Lighthouse** on home, a collection and a PDP. Keep the `?WIDTHxHEIGHT` → `width`/`height` CLS fix.

### T6 — P2: campaign

- [ ] **Counter reads the live figure** and the odometer renders (it was **$11,792** at 2026-10-15 22:52Z).
- [ ] **CTA** resolves to `/collections/donation-products` (14 products).
- [ ] **Badges** render on homepage, collection, search and PDP recommendation cards.
- [ ] **The per-PDP contribution line (#4)** is present and correct per size.

---

## 3. Before you publish

- [ ] T1 and T2 fully green. Not "mostly".
- [ ] `node --test tests/*.test.mjs` passes.
- [ ] Checksums re-read after the final merge — **an unchanged checksum means the file was refused, not that nothing changed.**
- [ ] Rollback named out loud: **publish `160815546559`**.
- [ ] Someone other than the person publishing has seen the storefront.
- [ ] Publishing announced before it happens, not after. Two of the last three publishes were not, and one of them put a theme named "PREVIEW" in front of customers.
- [ ] Not inside a promo window, and not at the end of someone's day.

## 4. After you publish

- [ ] T1 re-run **on the live store**, immediately. The cart is the one thing worth proving twice.
- [ ] Hero, a PDP and the cart on a real phone.
- [ ] GA4 Realtime shows traffic and at least one purchase.
- [ ] The Water For Good counter still renders.
- [ ] Check again an hour later, with fresh eyes.
