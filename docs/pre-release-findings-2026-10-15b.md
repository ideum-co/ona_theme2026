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
required port. Full audit in `docs/manual-theme-work-2026-10-15.md`; the short
version is that the lead slide of the live homepage's `ona-banner-slider` was
switched on and re-pointed by hand on 2026-10-15T01:01:41Z, it exists in no
repository, and **2026 has no banner-slider section at all**.

Because the live theme is also the named rollback, it has to stay current:
anything the editor changes there is the newest copy that exists, and the only
record is the dated snapshot in `docs/live-theme-160815546559/`. **Re-pull that
snapshot before the release**, not just before a rollback.

---

## 1. Price does not react to variant change on collections and search — **2026**

**Confirmed, root cause already known, and the existing fix is incomplete.**

The diagnosis is written out in full in `onacoffee_theme`'s
`assets/product-card-price-sync.js` header comment. In Horizon, a card's price
is updated by `product-price.js`, which matches
`product-price[data-block-id=…]` inside HTML fetched from the Section Rendering
API. The reference section it fetches — `sections/section-rendering-product-card.liquid`
— renders a **bare `<product-price>` with no `data-block-id`**, so the selector
never matches, `updatePrice()` returns early, and the card keeps whichever
variant's price it first rendered with. **The PDP is unaffected** because the
product page's own `<product-price>` always carries a real block id. That is
exactly the asymmetry Felipe reported.

`sections/section-rendering-product-card.liquid:55` in **this** repo renders the
same bare `<product-price>`, so the mechanism is present here too.

Measured on the 2026 collection page (`/collections/all-coffee`, pinned):

| | count |
|---|---|
| `<product-price>` elements | 24 |
| `<variant-picker>` | 21 |
| `<variant-select-component>` | 23 |
| `product-card-price-sync.js` loaded | **0** |

So the trigger is present and the fix is absent. `assets/product-card-price-sync.js`
**does not exist in this repository**.

### The port is not a one-file copy

In `onacoffee_theme` the script is included in exactly one place —
`sections/main-collection.liquid:18`. But `search-results.liquid` and
`product-list.liquid` also render product cards. **So search results are not
covered even in `onacoffee_theme`**, which is why Felipe sees the bug on both
surfaces. Copying the asset and its single include would fix collections and
leave search exactly as broken as it is now.

`sections/product-list.liquid` is the shared grid used by both and is the
better insertion point; whichever is chosen, **the test has to cover search as
well as a collection**, or the half-fix will read as a pass.

---

## 2. New Harvest campaign assets — **2026 only**

The live storefront has **zero** occurrences of "new harvest" (checked on the
homepage, `/collections/all-coffee` and `/products/raspberry-candy`). This is
entirely a 2026 leftover, in two places:

| where | setting |
|---|---|
| `floating_badge_r89NRP` (type `floating-badge`, **enabled**, position 2 on the homepage) | `image: badge_sale.svg`, `fallback_text: "New Harvest Sale"` |
| `hero_ona` (type `hero`, position 0) | also references `badge_sale.svg` |

Turning the campaign off means both, not just the badge.

Two details worth knowing before someone "fixes" it:

- **The visible asset is the SVG, not the text.** `fallback_text` only renders
  when `image` is blank (`sections/floating-badge.liquid:19-22`), so editing
  the words "New Harvest Sale" changes nothing on screen. Disable the section.
- **The empty `link` is not a dead link.** `settings.link` is blank, but the
  section guards it: blank renders `<div class="floating-badge__link" role="img">`
  rather than an `<a href="">`. It is correctly non-interactive. Do not file
  this with the real dead CTAs.

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

The two real ones are both on the homepage and both are
`<a class="coffee-quiz__action">` **with no `href` attribute at all** — the
`coffee_quiz` section's empty link settings, already item 6 in the release
register.

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

Measured by hit-testing `document.elementFromPoint` across the button at 2px
intervals — not inferred from rectangles:

| x range | width | what receives the click |
|---|---|---|
| 1429.3 – 1443.7 | **14.4px** | **Account** |
| 1445 – 1463 | ~20px | Search ✓ |
| 1465.3 – 1473.3 | **8px** | **Cart** |

The Search button is 44px wide and **about 20px of it actually searches**. The
magnifier icon is centred in the 44px box, so **the left half of the visible
icon opens the account page** and the right edge opens the cart. Nothing looks
wrong in a screenshot — the icons are evenly spaced — which is why this reads as
a vague "quirk" rather than an obvious break.

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

The rest of the open mega menu is clean: six `header-megamenu__primary-link`
items and three `header-megamenu__card` items, zero overlapping pairs among all
21 visible interactive elements at the width tested.

---

## Suggested order for the afternoon

1. **In Sequence banner** — confirmed running, and nothing else can be signed
   off while the homepage is wrong.
2. **Menu hit boxes** — a one-rule CSS fix with a measured before/after, and it
   affects every page.
3. **Price sync** — port the asset *and* decide the include so search is covered.
4. **New Harvest badge + hero reference** — disable, do not edit the text.
5. **Product images** — repoint the four products to the full-res originals;
   benefits both themes and is safe to do before the release.
6. **The two coffee-quiz CTAs** — give them destinations or hide them.
