# Tasting notes, roast, and who owns which metafield

Written 9 November 2026, after the ONA team reported that *"the single origin
subscriptions have tasting notes, and S/O espresso also has 'Filter' written
underneath the name"*.

Both reports are correct. They have **three different causes**, and the obvious
fix — give subscriptions their own product template — does not work. This doc
records why, and maps every field so the next person does not have to re-derive
it.

---

## 1. Tasting notes render from three places, off two metafields

| Surface | Reads | Rendered by |
|---|---|---|
| **Product cards** — collection, home, search, 404, PDP recommendations | `accentuate.roast` **and** `accentuate.tastes_like` | `blocks/product-metafield-text.liquid`, instanced in `collection.json`, `index.json`, `search.json`, `404.json`, and each `product*.json`'s recommendations |
| **PDP, the line under the title** | `accentuate.tastes_like` | `blocks/pdp-product-summary.liquid` → `.product-summary__description` |
| **PDP, "Profile" tab** | `custom.tastes_like` | `templates/product.json` (`text_dMNeWR`) and `templates/product.non-coffee.json` (`text` block in `product_tab_ePcCkQ`) |
| PDP, badge above the title | `filters.brew_method` | same summary block, `badge_namespace` / `badge_key` |

Two consequences that are easy to miss:

- **Clearing one tasting-notes field does not clear the other.** The cards and
  the PDP title area read `accentuate.tastes_like`; the Profile tab reads
  `custom.tastes_like`. They are separate stored values and can disagree.
- **Probing the DOM for `.product-metafield-text` finds the cards and misses the
  PDP line entirely**, because the summary uses `.product-summary__description`.
  Search for the rendered string, not the class you expect.
- **The cart and drawer are not a surface.** `templates/cart.json` carries no
  `product-metafield-text` instance, and cart/drawer recommendations come from
  `snippets/cart-aware-recommendations.liquid`, which renders title, price and
  image only and reads no `accentuate` field at all.

`product-metafield-text` takes **namespace and key as free-text settings**
(schema default namespace: `accentuate`) and renders for *any* product that has
that metafield set. There is no product-type condition anywhere in it.

### `filters` is invisible to grep

`filters.brew_method` is read as `product.metafields[badge_namespace][badge_key]`
— the namespace comes from a setting, so a literal search for
`metafields.filters.` returns nothing anywhere in the theme. What a grep *does*
find is the setting value (`"badge_namespace": "filters"` in `product.json`) and
the block's schema default. `custom.pdp_background_color` is read the same
dynamic way, through `background_color_key` in `product-information.liquid`,
`product-dna.liquid` and `product-tabs.liquid`.

**Grep the setting values, not just `metafields.<ns>.`** — any field reached
through a settings-named namespace or key is invisible to the obvious search.

---

## 2. Why a subscription template would not fix the cards

**A product template only controls that product's own page.** A card is rendered
by the *collection / home / search* template's card block, against whatever
product lands in the grid. The grid has no idea what template the product would
use if you clicked it.

So a `product.subscription.json` would change nothing on
`/collections/coffee-subscriptions`. Only two things fix a card:

1. clearing the metafield on the product, or
2. making the card block itself conditional.

The subscriptions are also **already on `Theme template: merch`**, and merch
still prints tasting notes — see the next section for why.

### The gift-card precedent, and where it stopped

PR #453 (`855d6f0`) solved the same leak for gift cards: a dedicated
`product.gift-card.json` that switches the tasting-note override and the
brew-method badge off **by blanking their namespace/key settings explicitly**,
plus removing the `description` literal from the block schema.

Two things carried forward from it:

- Settings are set **explicitly**, never omitted. Shopify serialises schema
  defaults back into editor-owned templates, so an omitted key does not stay
  omitted.
- In the **block's `{% schema %}`**, a `richtext` default is **dropped** rather
  than set to `""`. This applies to the schema default only. In a template JSON
  the value is still written explicitly as `""` — `855d6f0` did exactly that in
  `product.json` and `product.non-coffee.json`, and both are still `""` today.
  Do not read this as licence to omit the key in a template; see the bullet
  above.

That fix was **PDP-only**. Cards were never in its scope, which is why the same
symptom came back on a different surface.

---

## 3. The outstanding theme defect

`blocks/pdp-product-summary.liquid` defaults its description to:

```
namespace:        accentuate
description_key:  tastes_like
```

and every product template except the gift card leaves both set:

| template | description ns | description key | badge ns | badge key |
|---|---|---|---|---|
| `product.json` | `accentuate` | `tastes_like` | `filters` | `brew_method` |
| `product.merch.json` | `accentuate` | `tastes_like` | *(blank)* | *(blank)* |
| `product.equipment.json` | `accentuate` | `tastes_like` | *(blank)* | *(blank)* |
| `product.non-coffee.json` | `accentuate` | `tastes_like` | *(blank)* | *(blank)* |
| `product.gift-card.json` | *(blank)* | *(blank)* | *(blank)* | *(blank)* |

The block itself is **not** the defect. Both the badge and the description
already carry the "blank means none" guard — the description bails on a blank
`namespace` or a blank `description_key` and falls back to the literal
`description` setting, which is `""` in merch, equipment and non-coffee, so a
blanked template renders nothing. `product.gift-card.json` proves the mechanism
works. The badge's comment in the block says why the guard exists:

> A blank namespace or key means "this template shows no badges" and stays
> blank — it is deliberately NOT coalesced back to `filters.brew_method`.
> […] merch would have started printing brew methods on t-shirts and grinders
> the moment anyone set `filters.brew_method` on them.

What never got the same treatment is the **template values**: #453 blanked the
badge settings on merch, equipment and non-coffee but left the description
pointing at `accentuate.tastes_like`. So the merch template protects against
brew-method badges but not against tasting notes — and the fix is six JSON
values (`namespace` and `description_key` on three templates), not a line of
Liquid. There is nothing to patch in the block.

---

## 4. Field ownership — who writes what

This is the part that decides whether a manual data fix survives.

### The ONA Brew Guides app

Source: `ona-brew-guide-admin/shared/models/brewGuide.ts`. The app stores the
reusable guide in the `ona_brew_guide` metaobject, links it from the product via
`custom.brew_guide`, then pushes to **two different owners**:

| Owner | Fields the app writes |
|---|---|
| **Product** | `custom.tastes_like`, `custom.brew_guide_intro`, `custom.brew_spec_labels`, `custom.brew_spec_values`, `custom.brew_guide` (the metaobject link), and `accentuate.select_artlice` |
| **Article** | `accentuate.tastes_like`, `accentuate.roast`, `accentuate.title_item`, `accentuate.content_item`, `accentuate.content_brew_guide` |

**The app writes exactly one `accentuate.*` key to a product:
`accentuate.select_artlice`**, set by `assignArticleLink()` when it creates a
Brew Guides article, holding `<blog-handle>/<article-handle>`. It never writes
`accentuate.roast` or `accentuate.tastes_like` to a product — those two on a
*product* are legacy Accentuate Custom Fields data, left over from the old theme
and now app-orphaned.

Two practical consequences:

- Clearing `accentuate.roast` / `accentuate.tastes_like` on a product is
  **durable** — no app rewrites those two keys on a product. The durability
  claim is specific to them; it does not extend to `accentuate.select_artlice`,
  which the app does own.
- But pushing a brew guide to a product **does** set `custom.tastes_like`, which
  feeds the PDP Profile tab. A rotating product linked to a guide will grow
  tasting notes on that surface instead. Subscriptions should not be linked to a
  brew guide.

### Namespace map

Scoped to the namespaces that carry **coffee content**. Key counts are distinct
keys referenced by the theme, not admin definition counts.

| Namespace | Keys | Who owns it |
|---|---|---|
| `accentuate` | 20 | Legacy Accentuate Custom Fields app. Still drives cards + the PDP title line. On articles, written by the Brew Guides app; on products, only `select_artlice`. |
| `custom` | 31 | Native Shopify. Drives the new PDP sections and the Profile tab. Partly written by the Brew Guides app. 30 referenced statically plus `pdp_background_color`, read through a settings-named key. |
| `custom_product` | 10 | Promo tags only (`snippets/ona-product-tags.liquid` and `snippets/ona-product-tags-pdp.liquid`; `blocks/ona-product-tags.liquid` carries the CSS). |
| `filters` | badge + facets | PDP badge. Read dynamically; invisible to grep. |

Three more namespaces are read off a product but carry no coffee content:
`reviews` (`rating`, `rating_count`, Judge.me), `shopify` (`disclosure`), and
`global` (`description_tag`, the SEO meta description — see §6).

**Six concepts exist in both `accentuate` and `custom`:** `producer`, `region`,
`process`, `varietal`, `altitude`, `tastes_like`. In the Shopify admin these
appear as two definitions — *"Taste Notes"* (accentuate) and *"TASTES LIKE"*
(custom). *"Brew guide"* also appears twice.

The migration from the legacy namespace to native metafields was **half-done**:
the new PDP sections read `custom.*`, but the cards and the PDP title line still
read `accentuate.*`. The accentuate-backed PDP sections (`story`, `brew_guide`
in `product*.json`) are `disabled: true` — switched off on the product page. The
cards are a separate surface and were never switched off: they still read
`accentuate.roast` and `accentuate.tastes_like` on every product.

---

## 5. The data state that triggered the report

Measured 9 November 2026 from the live `/collections/coffee-subscriptions`
cards.

| Card | `accentuate.roast` | `accentuate.tastes_like` |
|---|---|---|
| Single Origin Subscription (**Filter** Coffee) | `Filter` | Floral, yellow peach and citrus |
| Single Origin Subscription (**Espresso** Coffee) | **`Filter`** | **identical to the above** |
| Raspberry Candy | `Milk-based` | Sweet berries and creamy white chocolate |
| Maple | `Milk-based` | Caramel, biscuits, nuts and spices |
| Aspen | `Milk-based` | Chocolate, hazelnut and malt |
| Gateway | `Milk-based` | Chocolate truffle and mixed berries |
| Unwind | `Milk-based` | Chocolate, caramel and citrus peel |

The Espresso subscription was evidently duplicated from the Filter one: same
roast, same tasting notes. That is the literal "Filter written underneath the
name".

Beyond those two fields, both subscriptions carry a whole single origin's worth
of data — at time of writing a Guji Peaberry: sourcing intro, origin intro,
profile intro, producer, region, process, varietal, altitude. **A rotating
product cannot hold fixed per-lot fields**; they are stale the moment the
featured coffee changes.

That data is **dormant, not visible** — but check how thin the guard is.
`product.merch.json` has no reference to `profile_intro`, `custom.tastes_like`
or `who_is_for`. It **does** carry the origin-story and brew-guide sections:
`story` (a `custom-liquid` block reading `accentuate.content_origin`,
`content_sourcing`, `content_coffee_profile`, `producer`, `region`, `process`,
`varietal`, `altitude`), `brew_guide` (reading `accentuate.select_artlice`,
`content_brew_guide`, `title_item`, `content_item`) and a "Brew Guide" tab. All
three are `"disabled": true`, and both sections are still listed in `order`.

So the Peaberry fields are held back by a `disabled` flag in an **editor-owned**
JSON file, not by the absence of a reference. They surface the moment anyone
toggles the `story` section back on in the theme editor on the merch template —
no template move required, and no deploy, no PR, no diff. Only
`accentuate.tastes_like` leaks today, through the summary line in §3.

All five blends reading `Milk-based` is also worth a check by the coffee owner;
Raspberry Candy does not obviously belong in that group.

### What is already correct — do not "fix" it

Both subscription PDPs' **Profile tab** and **FAQs** carry proper bespoke
subscription copy ("Discover a new espresso coffee each month … rotating
espresso range"; "Will the coffee change each month? Absolutely."), and
`custom.tastes_like` is empty on both. That half was done properly.

---

## 6. Fix

**A — data, applied 9 November 2026.** Verified at source by Admin API
read-back after each write.

| Product | Field | From | To |
|---|---|---|---|
| S/O Subscription (Espresso) | `accentuate.roast` | `Filter` | `Espresso` |
| S/O Subscription (Filter) | `accentuate.tastes_like` | Floral, yellow peach and citrus | **deleted** |
| S/O Subscription (Espresso) | `accentuate.tastes_like` | Floral, yellow peach and citrus | **deleted** |
| S/O Subscription (Espresso) | `filters.coffee_type` | `["Filter"]` | `["Espresso"]` |
| S/O Subscription (Espresso) | `filters.brew_method` | `["Aeropress","French press","Pour over"]` | `["Espresso","French press","Moka Pot"]` |
| S/O Subscription (Espresso) | `filters.taste_notes` | `["Citrus","Floral","Peach","Sweet"]` | **deleted** |

> **Deleted, not emptied.** The intent was to replace values in place and leave
> the records alone. Shopify refuses: `metafieldsSet` with `value: ""` returns
> **`Value can't be blank. (INVALID_VALUE)`**. There is no in-place way to clear
> a metafield, so removing the record is the only option short of inventing
> replacement copy. Both original values are recorded above, so it is
> reversible.
>
> **If you ever recreate them, mind the type.** Article-side
> `accentuate.tastes_like` and `accentuate.roast` are legacy `string` metafields
> and must be read *without* `.value` — `blocks/brewguide-article-tasting-info.liquid`
> documents the trap, and `sections/ona-page-media-gallery.liquid` documents the
> same thing for `accentuate.image`. Both the card and the PDP summary read the
> **product-side** fields *with* `.value`, which is why they rendered before the
> delete. Recreating a deleted record through the Admin API with a legacy type
> would give a silently blank card rather than an error.

The `filters.*` values were **derived, not guessed**: ONA's espresso single
origins (Kagumo AB, La Merced, Regional Aurea, Gelcha Kindu, Gargari Gutity)
carry `coffee_type: ["Espresso"]` with
`brew_method: ["Espresso","French press","Moka Pot"]`, and the Filter
subscription already matches the filter convention
(`["Aeropress","French press","Pour over"]`) exactly.

This fixes the cards **and** the PDP line in one move, because both read the
same field, and it is durable per §4.

**Storefront lag is expected.** Shopify's backend `page_cache` is not purged by
Admin API writes — the roast change appeared on the collection page within
minutes while the deletes had not yet, because the cache entry was rebuilt
between the two writes. Verify at source first, then re-check the storefront
after the TTL rather than concluding the write failed.

The dormant per-lot fields in §5 are deliberately left alone: they render
nowhere on the merch template, and replacing them is a content decision for the
coffee owner, not a bug fix. Both products are clear of `custom.brew_guide`, so
the Brew Guides app is not pushing to them — but both still point
`accentuate.select_artlice` at `brewguides/guji-pb-ethiopia-washed-1`, so their
"Full brewing guide" link resolves to one rotating lot's article.

Still open: `global.description_tag` on the Espresso subscription reads "Single
Origin **Filter** Subscription … roasted specifically for **filter** brewing".
That is the SEO meta description, so it is customer-facing copy and is awaiting
sign-off rather than being corrected here.

**B — theme, afterwards.** Blank `namespace` / `description_key` on
`pdp_product_summary` in `product.merch.json` (and equipment / non-coffee),
explicitly, following the #453 convention in §2. This stops the PDP line
recurring for the next merch-ish product.

`templates/product*.json` carry the "may be updated by the Shopify admin theme
editor" header, so **re-read the live template first** and blank on top of
whatever is there now — do not blank a stale copy and push it back over an
editor change.

**B does not fix cards.** A is the necessary fix; B is the guard. A card is only
protected by the data being right, or by §2's option 2 — making the card block
conditional, which is not proposed here.
