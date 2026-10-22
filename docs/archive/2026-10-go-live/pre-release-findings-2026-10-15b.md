# Pre-release findings — Felipe's five checks, 2026-10-15

Investigated ahead of this afternoon's `ona_theme2026` review. Each item says
**which theme it is on**, because they do not all sit on the same one: two are
2026-only regressions, one is a product-data problem affecting both, and one
needs a fix ported from `onacoffee_theme` that is itself incomplete.

Throughout, "live" = theme `160815546559` (published, Horizon 3.5.1 + ONA's
custom sections) and "2026" = theme `154676789439` (`ona_theme2026/main`,
Horizon 4.1.4), inspected pinned in preview with `Shopify.theme.id` asserted.

---

## 0. In Sequence banner — confirmed still running

Felipe confirmed the campaign is live, so this moves from a question to a
required port. Full audit in `docs/archive/2026-10-go-live/manual-theme-work-2026-10-15.md`; the short
version is that the lead slide of the live homepage's `ona-banner-slider` was
switched on and re-pointed by hand on 2026-10-15T01:01:41Z, it exists in no
repository, and **2026 has no banner-slider section at all**.

Because the live theme is also the named rollback, it has to stay current:
anything the editor changes there is the newest copy that exists, and the only
record is the dated snapshot in `docs/archive/2026-10-go-live/live-theme-160815546559/`. **Re-pull that
snapshot before the release**, not just before a rollback.

---

## 1. Price does not react to variant change on collections and search — **2026**

**Confirmed, fixed, and the cause is not the one this document first gave.**
Fixed in **PR #167** (`assets/product-card.js`).

> **Correction.** The first version of this section said the cause was the bare
> `<product-price>` with no `data-block-id` in
> `sections/section-rendering-product-card.liquid`, and that the fix was to port
> `onacoffee_theme`'s `assets/product-card-price-sync.js`. **Both were wrong for
> this theme.** That diagnosis is accurate for `onacoffee_theme` (Horizon 3.5.1);
> Horizon 4.1.4 reworked this path completely. What follows was measured on the
> pinned theme, not read off the source.

### What actually happens

`assets/product-price.js` in 4.1.4 opens its handler with:

```js
if (!(event.target instanceof Element) || event.target.closest('product-card')) return;
```

so cards are **deliberately excluded** and handed to `ProductCard.updatePrice()`
in `assets/product-card.js`, which reads:

```js
const priceContainer = this.querySelectorAll(`product-price [ref='priceContainer']`)[1];
```

Index **`[1]`** only exists once quick-add has injected the modal's own
`<product-price>` earlier in the card's DOM. **ONA runs quick-add off**
(`--quick-add-display: none` on every card), so each card renders exactly
**one** price container, `priceContainer` is `undefined`, the
`if (newPriceElement && priceContainer)` guard fails, and the morph never runs.
Counted on the pinned collection page: 24 cards, **1** `product-price
[ref='priceContainer']` each. Same on `/search?q=maple`: 7 cards, 1 each.

**Reproduced and then fixed in the browser**, on `/collections/all-coffee`
pinned to `154676789439`, clicking **1kg** on the Raspberry Candy card:

| | before | after the one-line fix |
|---|---|---|
| card link | → `?variant=40126205657279` ✓ | ✓ |
| card price | **stays `$24.00`** ✗ | **`$95.00`** ✓ |
| back to 200g | — | `$24.00` ✓ |

The link moving while the price does not is the proof: `event.promise` resolves,
`#updateProductUrl(html)` runs from the same `.then()`, and `updatePrice(html)`
is the only step that fails.

**Why the PDP works** is the explicit `closest('product-card')` guard above —
the product page's own `<product-price>` is handled by `product-price.js` and
never reaches this method. That is exactly the asymmetry Felipe reported.

### Why the port would not have worked

Three independent reasons, each fatal:

1. `onacoffee_theme`'s script listens for `ThemeEvents.variantUpdate`.
   **Horizon 4.1.4 has removed `variantUpdate`, `variantSelected` and
   `cartUpdate` from `ThemeEvents` altogether** — this theme's `assets/events.js`
   declares only `mediaStartedPlaying`, `quantitySelectorUpdate`, `megaMenuHover`
   and `zoomMediaSelected`. The listener would never fire.
2. It is included only from `sections/main-collection.liquid:18`, so **search
   would have stayed broken** — which is why both surfaces were reported.
3. It would have sat alongside a native card-price updater that 3.5.1 did not
   have, duplicating the morph.

The fix in PR #167 keeps `[1]` first and falls back to `[0]`, so a card with
quick-add enabled still behaves exactly like stock Horizon. One change, both
grids, nothing ported.

---

## 2. New Harvest campaign assets — **already off on the theme; the repo would switch them back on**

The live storefront has **zero** occurrences of "new harvest" (homepage,
`/collections/all-coffee`, `/products/raspberry-candy`). It is entirely a 2026
item — and re-checking the theme itself rather than the repo changed the answer.

### The theme is already correct

`templates/index.json` pulled from theme `154676789439` on 2026-10-15
(`updatedAt` **2026-10-14T21:59:21Z**) has `floating_badge_r89NRP`
**`disabled: true`**. The badge does not render: the pinned homepage has no
`floating-badge` element and no `badge_sale` anywhere in the DOM, and shows 14
section wrappers against the 15 enabled sections the repo lists.

`hero_ona`'s `icon_9aLnRm` block also points at `badge_sale.svg`, and it too is
already `disabled: true` — so **no further action is needed for the campaign
itself.**

### The hazard is the other direction

`main` and `staging` still carry **`floating_badge_r89NRP` enabled**, and two
more sections the editor switched off:

| section | on the theme | on `main` / `staging` |
|---|---|---|
| `floating_badge_r89NRP` (`floating-badge`) | **disabled** | enabled |
| `find_your_coffee` (`media-with-content`) | **disabled** | enabled |
| `product_highlight_KkUAVM` (`product-highlight`) | **disabled** | enabled |

> **So merging `main` to the theme without PR #159 first would re-enable the
> New Harvest badge and two sections someone deliberately turned off.** The
> request to turn the campaign off is already satisfied; the risk is undoing it.

**PR #159 closes this and is already exact.** Its `templates/index.json` was
compared section by section against the theme's live copy on 2026-10-15:
**identical, all 25 sections, settings included, same order.** Merge it before
anything else reaches the theme.

### Two details still worth keeping

- **The visible asset is the SVG, not the text.** `fallback_text` only renders
  when `image` is blank (`sections/floating-badge.liquid:19-22`), so editing the
  words "New Harvest Sale" would have changed nothing on screen. Disabling the
  section — which is what was done — is the only thing that works.
- **The empty `link` is not a dead link.** The section guards it and renders
  `<div class="floating-badge__link" role="img">` rather than `<a href="">`. Do
  not file it with the real dead CTAs.

`badge_sale.svg` is **318 KB** with its text converted to outlines — heavy for a
decorative badge that is `position: fixed` on every page, and worth a second
look whenever the next campaign badge is made.

---

## 3. Raspberry Candy image is low-res — **product data, affects both themes**

Not a theme bug and not limited to Raspberry Candy. **The core coffee range has
been running at half resolution since 2024**, and the 2026 theme made it
visible by asking for much larger renditions.

On 2026 the card requests `width=3840` and advertises a `3840w` srcset
candidate. The file it points at is **1000 × 1633**, and Shopify's CDN does not
upscale — proven by fetching the same URL at three widths:

| requested | actually returned |
|---|---|
| `width=1000` | 1000 × 1633 |
| `width=1920` | 1000 × 1633 |
| `width=3840` | 1000 × 1633 |

So the browser picks a candidate it believes is 3840px, receives 1000px, and
stretches it. That is the softness.

**The full-resolution originals are already in Files and unused.** On
2024-10-29 at ~22:03–22:06Z four bag images were uploaded at **2058 × 3361**;
roughly fifteen minutes later, at ~22:18–22:23Z, downscaled **1000 × 1633**
duplicates were uploaded — and the duplicates are what the products point at:

| product | featured media | dimensions | unused original |
|---|---|---|---|
| Raspberry Candy | `Raspberry-Candy_fe2a7355…png` | 1000 × 1633 | `Raspberry-Candy.png` 2058 × 3361 |
| Aspen | `Aspen_5026993b…png` | 1000 × 1633 | `Aspen.png` 2058 × 3361 |
| Gateway | `Gateway_42d7a4ca…png` | 1000 × 1633 | `Gateway.png` 2058 × 3361 |
| Maple | (same pattern) | 1000 × 1633 | `Maple.png` 2058 × 3361 |

`Raspberry-Candy.png` returns a genuine **1920 × 3136** at `width=1920`, so the
resolution exists today and needs no new artwork.

**The fix is at the product-media level, not in the theme** — repoint each
product's featured media to the full-size file. Doing so improves the live
theme, the 2026 theme, the mega-menu cards (which show exactly Raspberry Candy,
Maple and Aspen) and the PDP at once. It is also the one item here that is worth
doing regardless of which theme is published.

Housekeeping found alongside: Aspen and Gateway each have **three** copies in
Files, and the In Sequence banner has four near-duplicate uploads
(`Insequence_top` / `Inseq3nce_top`, `Inseqmobile` / `Inseqmobtop` / `Insekmob`)
for two slots.

---

## 4. Blocked and dead links — **2026**

Scanned every `<a>` on five pages of the pinned 2026 theme, with `<script>`
blocks stripped so app templates do not pollute the count:

| page | anchors | genuinely dead |
|---|---|---|
| `/` | 147 | **2** |
| `/collections/all-coffee` | 186 | 0 |
| `/products/maple` | 118 | 0 (see below) |
| `/pages/about` | 104 | 0 |
| `/cart` | 118 | 0 |

> **Correction: it is one, not two, and it is not where the scan suggests.**
> Both flagged anchors are `<a class="coffee-quiz__action">` with no `href`,
> and both live **inside `<template ref="resultTemplate">`** in
> `sections/coffee-quiz.liquid` (lines 201-237). A template's contents are in
> the HTML source but **not in the rendered DOM** — a shopper only meets them
> after finishing the quiz. So neither is clickable on page load, and the raw
> count overstates the homepage.
>
> Of the two, only one is a defect:
>
> | anchor | verdict |
> |---|---|
> | `[data-subscribe]` | **not a defect.** `assets/coffee-quiz.js:264-275` either sets `href = match.url` or removes the element outright. |
> | "Explore all our coffees" | **real.** Gated on `settings.explore_label` only, while `settings.explore_link` is `""`, and the string `explore` appears nowhere in `coffee-quiz.js` — so nothing can ever fill it in. |
>
> **Fixed in PR #167**: the anchor is now gated on the link as well as the
> label, so a blank setting renders nothing instead of a dead CTA. Setting the
> link itself is a one-line follow-up that belongs **after PR #159**, which
> rewrites `templates/index.json` wholesale.

The eight flagged on `/products/maple` are **all Judge.me** (`jdgm-paginate__page`,
`jdgm-medal`, `jdgm-write-rev-link`) and carry `role="button"` with `tabindex`.
They are script-driven controls, not broken links — **not defects**, and they
should not be added to the count.

Still outstanding from the earlier review and not re-found by this scan because
they render *no anchor at all* rather than an empty one: the homepage
`learn_with_ona` "Brewing Guides" card and the PDP `inline_cta_8ann9f`.

---

## 5. Menu overlap — **2026 only, and it is a regression the cutover introduces**

Felipe's instinct was right, and the cause is measurable rather than cosmetic.
The header's three icon buttons are each 44 × 44, but **their click boxes
overlap**, so the Search button is mostly not clickable.

Measured by hit-testing `document.elementFromPoint` across the button at 1px
intervals — not inferred from rectangles. Re-measured 2026-10-15 at a second
viewport width (1920 CSS px, DPR 1.33), with the element boxes read alongside
the hit test:

| element | box | what actually receives the click |
|---|---|---|
| account button | 1486.5 – 1530.5 | account, all 44px ✓ |
| **search button** | **1516.1 – 1560.1** | only **1531 – 1552** searches |
| ↳ its left 14.4px | 1516.1 – 1530.5 | **account** ✗ |
| ↳ its right 8px | 1552.1 – 1560.1 | **cart** ✗ |
| cart button | 1552.1 – 1596.1 | cart, all 44px ✓ |

The search button is 44px wide and **21px of it actually searches**; 23px
belong to its neighbours. The first measurement at 1745px gave the same three
widths (14.4 / ~20 / 8), so this does not depend on viewport width.

> **Correction.** The first version of this section said "the left half of the
> visible magnifier opens the account page." That overstated it. The icon is
> **24.8px** wide (1525.7 – 1550.5) and the dead strip over it is
> **1526 – 1530 — about 5px**, the leftmost fifth. The tap *target* loses more
> than half; the visible *icon* loses a sliver. The defect is real either way,
> but the sliver is the honest number.

Nothing looks wrong in a screenshot — the icons are evenly spaced — which is
why this reads as a vague "quirk" rather than an obvious break.

**Root cause** — `snippets/search.liquid:63-66`:

```css
.header__column--right .search-action {
  @media screen and (min-width: 750px) {
    margin-inline: calc(var(--gap-md) * -1) calc(var(--gap-xs) * -1);
  }
}
```

`--gap-md` is `0.9rem` = **14.4px** and `--gap-xs` is `0.5rem` = **8px**, which
match the two measured overlaps exactly. The negative margins pull the search
action into both neighbours.

**Scope:** the rule is `min-width: 750px`, so it applies at **every desktop and
tablet width**, not just the one measured. That is read from the media query and
the computed custom properties via CSSOM — this environment cannot genuinely
resize below about 1283px, so narrower widths were not rendered and verified.

**This is stock Horizon, not an ONA edit** — `onacoffee_theme` carries the
identical rule. But the **live storefront renders zero `.search-action` and zero
`.header__column--right`**, because it uses ONA's custom `ona-header` section
instead of Horizon's. So the bug is dormant today and **arrives with the
cutover**. It is not something that regressed recently; it is something the
2026 header exposes for the first time.

**Fixed in PR #167.** The three buttons already sit flush — the right column's
`gap` never separates them — so the negative margin is purely a squeeze, and
removing it gives all three a full 44px target. The only visible change is the
icon group widening by 22.4px. The sibling rule for
`[data-menu-style='menu'] .header__column--left .search-action` is the same
pattern and was left alone: ONA's header puts search in the right column, so it
does not render today.

The rest of the open mega menu is clean: six `header-megamenu__primary-link`
items and three `header-megamenu__card` items, zero overlapping pairs among all
21 visible interactive elements at the width tested.

---

## Where each item stands

Updated 2026-10-15 after building the fixes.

| # | item | state |
|---|---|---|
| 0 | In Sequence banner | **open — decision needed.** Confirmed running on live, exists in no repository, and the 2026 theme has no `ona-banner-slider` section to put it in. |
| 1 | Card price not reactive | **fixed — PR #167.** One line in `assets/product-card.js`; covers collections and search together. Verified in the browser both ways. |
| 2 | New Harvest campaign | **already off on the theme.** No action on the campaign; the action is to **merge PR #159 first** so a later merge does not switch it back on. |
| 3 | Raspberry Candy low-res | **open — needs approval.** It is product media, not theme code, and repointing a product changes the live storefront immediately. |
| 4 | Dead links | **fixed — PR #167.** One real CTA, not two, and it only appears after the quiz is completed. |
| 5 | Menu overlap | **fixed — PR #167.** Measured before and after. |

## Suggested order for the afternoon

1. **Merge PR #159 first.** Its `templates/index.json` is identical to the
   theme's; merging anything else before it re-enables the New Harvest badge
   and two sections the editor turned off. Re-read the checksum afterwards.
2. **Review and merge PR #167** — the three fixes above, with their regression
   tests. They are independent of `index.json` and so cannot conflict with #159.
3. **In Sequence banner** — the one that still needs a decision, because
   nothing else can be signed off while the homepage is wrong and there is
   nowhere in the 2026 theme to put it yet.
4. **Product images** — repoint the four products to the full-res originals.
   Benefits live *and* 2026, the mega-menu cards and the PDP at once, and is
   safe before the release — but it writes to live products, so it needs an
   explicit go-ahead.
5. **Set the quiz's explore link** — one line in `templates/index.json`, after
   #159 has landed so it does not conflict.
