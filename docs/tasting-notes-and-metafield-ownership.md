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
| **Product cards** — collection, home, search, cart, 404, PDP recommendations | `accentuate.roast` **and** `accentuate.tastes_like` | `blocks/product-metafield-text.liquid`, instanced in `collection.json`, `index.json`, `search.json`, `cart.json`, `404.json`, and each `product*.json`'s recommendations |
| **PDP, the line under the title** | `accentuate.tastes_like` | `blocks/pdp-product-summary.liquid` → `.product-summary__description` |
| **PDP, "Profile" tab** | `custom.tastes_like` | `templates/product.json`, tab block `text_dMNeWR` |
| PDP, badge above the title | `filters.brew_method` | same summary block, `badge_namespace` / `badge_key` |

Two consequences that are easy to miss:

- **Clearing one tasting-notes field does not clear the other.** The cards and
  the PDP title area read `accentuate.tastes_like`; the Profile tab reads
  `custom.tastes_like`. They are separate stored values and can disagree.
- **Probing the DOM for `.product-metafield-text` finds the cards and misses the
  PDP line entirely**, because the summary uses `.product-summary__description`.
  Search for the rendered string, not the class you expect.

`product-metafield-text` takes **namespace and key as free-text settings**
(schema default namespace: `accentuate`) and renders for *any* product that has
that metafield set. There is no product-type condition anywhere in it.

### `filters` is invisible to grep

`filters.brew_method` is read as `product.metafields[badge_namespace][badge_key]`
— the namespace comes from a setting, so a literal search for
`metafields.filters.` returns nothing. Only the block's schema default reveals
it. Four namespaces are live on products, not three.

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
- On a `richtext` setting the key is **dropped**, not set to `""` — the GitHub
  integration silently rejects an empty string there.

That fix was **PDP-only**. Cards were never in its scope, which is why the same
symptom came back on a different surface.

---

## 3. The outstanding theme defect

`blocks/pdp-product-summary.liquid` defaults its description to:

```
namespace:        accentuate
description_key:  tastes_like
```

and **all four** product templates leave both set:

| template | description ns | description key | badge ns | badge key |
|---|---|---|---|---|
| `product.json` | `accentuate` | `tastes_like` | `filters` | `brew_method` |
| `product.merch.json` | `accentuate` | `tastes_like` | *(blank)* | *(blank)* |
| `product.equipment.json` | `accentuate` | `tastes_like` | *(blank)* | *(blank)* |
| `product.non-coffee.json` | `accentuate` | `tastes_like` | *(blank)* | *(blank)* |
| `product.gift-card.json` | *(blank)* | *(blank)* | *(blank)* | *(blank)* |

The **badge** already has the "blank means none" guard. Its own comment in the
block says why:

> A blank namespace or key means "this template shows no badges" and stays
> blank — it is deliberately NOT coalesced back to `filters.brew_method`.
> […] merch would have started printing brew methods on t-shirts and grinders
> the moment anyone set `filters.brew_method` on them.

The **description** never got the same treatment. So the merch template protects
against brew-method badges but not against tasting notes.

---

## 4. Field ownership — who writes what

This is the part that decides whether a manual data fix survives.

### The ONA Brew Guides app

Source: `ona-brew-guide-admin/shared/models/brewGuide.ts`. The app stores the
reusable guide in the `ona_brew_guide` metaobject, links it from the product via
`custom.brew_guide`, then pushes to **two different owners**:

| Owner | Fields the app writes |
|---|---|
| **Product** | `custom.tastes_like`, `custom.brew_guide_intro`, `custom.brew_spec_labels`, `custom.brew_spec_values` |
| **Article** | `accentuate.tastes_like`, `accentuate.roast`, `accentuate.title_item`, `accentuate.content_item`, `accentuate.content_brew_guide` |

**The app never writes `accentuate.*` to a product.** `accentuate.roast` and
`accentuate.tastes_like` on a *product* are legacy Accentuate Custom Fields
data, left over from the old theme and now app-orphaned.

Two practical consequences:

- Clearing `accentuate.roast` / `accentuate.tastes_like` on a product is
  **durable** — no app rewrites them.
- But pushing a brew guide to a product **does** set `custom.tastes_like`, which
  feeds the PDP Profile tab. A rotating product linked to a guide will grow
  tasting notes on that surface instead. Subscriptions should not be linked to a
  brew guide.

### Namespace map

| Namespace | Keys | Who owns it |
|---|---|---|
| `accentuate` | 20 | Legacy Accentuate Custom Fields app. Still drives cards + the PDP title line. On articles, written by the Brew Guides app. |
| `custom` | 30 | Native Shopify. Drives the new PDP sections and the Profile tab. Partly written by the Brew Guides app. |
| `custom_product` | 10 | Promo tags only (`ona-product-tags.liquid`). |
| `filters` | badge | PDP badge. Read dynamically; invisible to grep. |

**Six concepts exist in both `accentuate` and `custom`:** `producer`, `region`,
`process`, `varietal`, `altitude`, `tastes_like`. In the Shopify admin these
appear as two definitions — *"Taste Notes"* (accentuate) and *"TASTES LIKE"*
(custom). *"Brew guide"* also appears twice.

The migration from the legacy namespace to native metafields was **half-done**:
the new PDP sections read `custom.*`, but the cards and the PDP title line still
read `accentuate.*`. The accentuate-backed PDP sections (`story`, `brew_guide`
in `product*.json`) are `disabled: true` — switched off on the product page,
still live on every card.

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

That data is **dormant, not visible**. Both subscriptions render from
`product.merch.json`, which contains no reference to `profile_intro`,
`custom.tastes_like`, `who_is_for`, the origin-story sections or the brew-guide
section — those live only in `product.json`. So the Peaberry fields are a
landmine rather than a live bug: they surface the moment anyone moves these
products onto the coffee template. Only `accentuate.tastes_like` leaks today,
through the summary line in §3.

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

**B does not fix cards.** A is the necessary fix; B is the guard. A card is only
protected by the data being right, or by §2's option 2 — making the card block
conditional, which is not proposed here.
