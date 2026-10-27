# Subscription UX — live walkthrough, Appstle review, and open decisions

Measured on the live theme (`ona_theme2026/main`, theme `154676789439`) on **2026-10-26 UTC**
(2026-10-27 Sydney — the clock gap is why some notes elsewhere carry the later date), immediately
after #413 merged as `1c9f468`.

Everything below is measured, not inferred. Where something is unverified it says so.

## 1. What a shopper actually sees

### The collection card panel

Opened on a live Maple card, the complete visible content of the subscribe panel is:

```
SELECT SIZE   200g
[ Subscribe ]
```

That is all of it. No frequency, no price, no saving, no terms. Measured alongside:

- `.purchase-options` computes to `display: none`
- the frequency `<select>` has a rendered height of `0`
- **zero** Appstle elements exist anywhere on the collection page, so there is no widget to fall
  back on

### Pressing Subscribe

The add succeeds and the UI gives **no feedback at all** — no drawer, no toast, no button state
change. The only thing that moves is the cart bubble incrementing. A recurring Weekly subscription
is now in the cart. That silence invites a second click; a double-add was not tested.

### The cart, which is the saving grace

The cart drawer discloses properly. It shows `Maple · 200g · Weekly subscription · $16.63 $17.50`
and, above the checkout buttons, a recurring-purchase consent paragraph covering the cancellation
policy and authorisation to charge at the stated frequency.

**So this is not a hidden-charge trap.** It is a *choice* problem: the shopper cannot pick a
frequency without going to the PDP, and gets the most aggressive cadence by default.

### The PDP, which is the model to aim at

Appstle's widget renders `One time purchase $17.50` (preselected), `Subscribe and save` with a
`SAVE 5%` badge at `$16.63`, and a Subscription details expander. This is good practice and it was
already in place — #413 did not change it.

## 2. Why the frequency is invisible

`config/settings_data.json` → `platform_customizations.custom_css[2]`:

```css
.purchase-options__list,.purchase-options {display: none;}
```

Global, not PDP-scoped. It arrived with #323 and is **version-controlled in this repo** — it is not
an Appstle setting and not checkout branding. On the PDP it is harmless because Appstle covers that
surface. On the card it is the entire problem.

Consequence for process: an edit made in the theme editor to this file lives only on live and is
overwritten by the next merge that touches it. **Change it by PR.**

The preselected plan is the first allocation in the group:

```liquid
assign allocation = variant.selling_plan_allocations | where: 'selling_plan_group_id', group.id | first
```

So "silent Weekly" is a function of Appstle's plan ordering, not theme logic. Reordering the group
to put Monthly first moves it — and also changes the Appstle PDP widget's default, which should be
intended rather than incidental.

## 3. Contrast failures still live

Computed WCAG ratios against each element's resolved background:

| element | ratio | needs | where |
|---|---|---|---|
| `Size` label | **1.00** | 4.5 | PDP — identical to its background, i.e. invisible |
| `$6 per 200g and $24 per kilo donated to Water For Good` | 1.79 | 4.5 | PDP **and** all 24 collection cards |
| `Sold Out - Online` | 2.56 | 4.5 | collection cards |

Only those fail inside `.product-information`, which means the Appstle contrast work from #408/#410
is holding.

Correction to an earlier internal note: the PDP's tan scheme **is** painted now. The older claim
that nothing in that subtree painted the background no longer holds.

## 4. Appstle's standalone price display — review before adopting

Appstle offers a snippet that renders subscription pricing on product cards. Three findings, all of
which fail **silently**:

1. **Their theme scan names the wrong file.** It recommends `blocks/_featured-product-price.liquid`.
   That block is rendered only by `sections/featured-product.liquid` and `blocks/_featured-product.liquid`
   — the Featured Product section. It never renders a collection-grid card.
2. **The right file has a different variable.** Card prices come from `blocks/price.liquid` (block
   type `price`, placed at `/sections/main/blocks/product-card/blocks/price_*` in
   `templates/collection.json`). That file has no bare `product`; it uses
   `assign product_resource = closest.product`. Appstle's snippet pasted there serialises an
   undefined variable and renders nothing. Their detection was right only for the file they chose,
   which does `assign product = closest.product`.
3. **An empty label renders nothing.** The "Subscription price label" (Widget → More Labels → Price
   Labels → Collection Page Subscription Price Format) must be non-empty or the snippet is inert
   even when pasted correctly.

Corrected snippet for the right file:

```liquid
<span class="appstle_stand_alone_price_display_selector"
      data-product-data="{{ product_resource | json | escape }}"
      style="display:none;"></span>
```

Further caveats:

- `{{subscriptionPrice}}` is the **lowest** subscription price for the *product* — product-level,
  not variant-aware. Every subscribable ONA product is multi-variant (200g/1kg) with disjoint plan
  ids, and the cards carry a size selector, so the rendered price will not follow the shopper's size
  selection. Use a `From {{subscriptionPrice}}` label; never let it replace the variant-aware price.
  A bare price here would reintroduce the stale-price defect class that #405→#413 removed.
- Appstle's published collection-page widget doc states it displays **only for single-variant
  subscription products**. ONA has zero single-variant subscribable products. Whether the standalone
  price display shares that limitation is **unverified** — the identifier appears nowhere in public
  documentation, it is generated per shop in the Appstle dashboard. Test before committing.
- `blocks/price.liquid` is shared by **9 templates** (404, cart, collection, index, search once each;
  the four product templates twice each). Adding the span unguarded puts the label on the PDP too,
  duplicating Appstle's own widget. It needs a card-context gate, ideally also gated on
  `product_resource.selling_plan_groups.size > 0`.
- Option A serialises the whole product object per card — real page weight on a 24-card grid, worth
  measuring. Option C costs one network request per product, which is worse.
- Appstle offers to integrate it for you. Decline: a third party editing the live theme is
  unversioned, bypasses review, and is overwritten by the next sync.
- The "up to 40%" conversion claim is vendor marketing with no cited study.
- Requires a Business-tier plan or higher. ONA's tier is **unconfirmed**.

## 5. How others solve this

No major retailer asks a shopper to choose a delivery frequency from a grid tile.

- **Amazon Subscribe & Save** — the listing advertises the discount; the shopper adds to cart and
  chooses frequency **in the cart**.
- **Chewy Autoship** — frequency is chosen on the **product page**; the grid's role is filtering to
  Autoship-eligible items.

Both split the work the same way: **the grid signals, a dedicated surface decides.** Baymard has no
public subscribe-specific guideline, so this rests on observed patterns rather than published
research.

## 6. Open decisions

**Direction for the card** — three coherent options:

- **A. Grid advertises, PDP decides.** Add the Appstle price display with a `From …` label and route
  the card's Subscribe button to the PDP, where the widget already does the job well. Closest to
  Amazon/Chewy, drops the cramped panel, needs no CSS scoping.
- **B. Keep the panel, make it honest.** Scope the custom CSS so the panel shows frequency and price,
  default to Monthly, add the price display to cards.
- **C. Amazon's model.** Keep one-click subscribe from the grid and add frequency editing to the cart
  drawer, which already discloses the plan.

Set the group default to Monthly regardless of which is chosen.

**Also open:** ONA's Appstle plan tier; whether the standalone price display supports multi-variant
products; which customer-facing breakage prompted the admin-lever theory.

## 7. Priorities

| # | item | owner |
|---|---|---|
| P1 | Card subscription choice — direction above, plus Monthly default | decision pending |
| P2 | Silent add-to-cart on the card; open the cart drawer on success as the theme does elsewhere | theme |
| P3 | `Size` label at contrast 1.00 on the PDP — invisible text, pure token fix | theme |
| P4 | Donation label at 1.79 on every card and the PDP — the Water For Good message is the least readable text on the page | theme |
| P5 | `templates/product.json` and `templates/index.json` are deliberately divergent between git and live; any PR touching them in git overwrites the editor-side quiz fix and donation-counter settings | process |

See also [subscription-account-surfaces.md](subscription-account-surfaces.md) for the account-page
vs subscription-portal distinction, which is a different question from the two above.
