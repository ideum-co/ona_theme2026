# Merch cross-sell in this theme, and staying upgradable

**Date:** 2026-09-22
**Audience:** whoever builds the product-page cross-sell here next.

Two things this note exists to prevent:

1. Rebuilding something Horizon already does.
2. Repeating the pattern that made the live theme un-upgradable.

## The curation is already done, and it is not in the theme

Complementary products are **product metafields**, not theme config:

```
namespace: shopify--discovery--product_recommendation
key:       complementary_products
type:      list.product_reference
```

They belong to the catalogue, so they are shared by every theme on the store. As of
2026-09-22, 13 coffee products are curated (subscriptions, all four instant coffees, both
drip-bag SKUs, and the hero coffees), pointing mostly at the ONA Coffee Mug. That work
does **not** need repeating here -- the moment this theme renders a complementary row, it
is populated.

Curation was driven by 180 days of basket data (15,886 orders): the Mug was the #1 merch
companion for every coffee tested, and subscription products showed the highest attach
rate on the site at 8.05% versus a 1.41% baseline. See
`onacoffee_theme/docs/` and `~/ona-backups/complementary-products-before-2026-09-22.json`
for the ranking and the rollback state.

## Horizon already renders it. Use that.

Do not write a custom section. Stock Horizon -- in 3.5.1 *and* 4.x -- supports this:

- `sections/product-recommendations.liquid` and `blocks/product-recommendations.liquid`
  both expose a `recommendation_type` setting with a `complementary` option, and pass it
  through as `data-intent` to `assets/product-recommendations.js`.
- `blocks/_product-details.liquid` in 4.x already ships a **`complementary_products`
  preset** wired to `recommendation_type: "complementary"`.

So surfacing merch against coffee here is a theme-editor action plus, at most, a template
JSON entry. No new Liquid.

### The one real gap, and when a custom fallback is justified

The native section deliberately renders **nothing** when a product has no complementary
products curated:

```liquid
elsif section.settings.recommendation_type == 'complementary'
  # Do not recommend the All collection as complementary products
  assign products = null
```

That is correct long-term behaviour -- better to show nothing than random merch. It only
becomes a problem under a campaign deadline, where an empty row means the promo is
invisible on every uncurated product.

That is why the live theme carries `sections/ona-product-complementary.liquid`, which
falls back to a collection when nothing is curated. **That section duplicates the native
intent mechanism and should not be ported here.** If this theme ever needs the same
fallback, add it as a *new* file that wraps or sits beside the native section -- never by
editing `sections/product-recommendations.liquid`. Editing that file is precisely what
stops upstream fixes to it from ever arriving (see below).

Now that curation exists, the gap is largely moot: the native behaviour is fine.

## Why this theme must stay close to stock

Measured 2026-09-21 by diffing upstream Horizon `45c7db5` (v3.5.1) against `f9aef27`
(v4.2.0) and comparing both to the live theme:

| | live | this theme |
|---|---|---|
| Horizon version | 3.5.1 | 4.1.4 |
| of the 321 files Shopify changed, how many we had modified | **197** | near zero |
| ONA-prefixed or legacy sections | **98 of 145 (68%)** | few |
| can Shopify auto-update it | **no** | yes, while it stays near-stock |

Shopify only auto-updates unmodified theme-store themes. On 2026-09-21 it updated two old
untouched themes to 4.2.0 and produced `Updated copy of ...` clones; it did not touch live,
because live is too modified to update in place.

Live cannot practically move to 4.2: Horizon 4.0 replaced the colour system
(`settings.*_color_scheme` -> `color-custom-*` plus a `color_palette` setting), so even
files live has *not* modified cannot simply be dropped in. Of 124 such files, 15 reference
the new palette API and 21 more render a snippet that does not exist in 3.5.1.

**This theme is one minor version behind stock and should stay that way.** That is its
main advantage over live, and it is easy to lose.

## Rules that keep it upgradable

1. **Add files; do not edit stock ones.** A new `ona-*.liquid` never conflicts on upgrade.
   A one-line change to `blocks/price.liquid` makes that file a merge forever.
2. **Prefer theme blocks over section surgery.** `_product-details` accepts `@theme`
   blocks, so a new public block in `blocks/` can be positioned in the editor without
   touching any stock file or template.
3. **Scope CSS inside the block** with `{% stylesheet %}`, rather than editing `base.css`
   or the shared stylesheets.
4. **Never copy JSON templates from upstream.** `templates/*.json` are store
   configuration, not code -- upstream's would wipe the homepage, PDP and cart layouts.
5. **Use the 4.x colour system** (`color-custom-*`, `color_palette`). Do not reintroduce
   `settings.*_color_scheme`, which 4.0 removed.
6. **Keep configuration in the catalogue where possible.** Complementary products are the
   model: metafields on the product, so every theme benefits and nothing is trapped in a
   theme that later gets retired.
7. **Commit theme-only files to git.** Live has at least two templates that exist in the
   theme but not in its repo (`product.filtersub.json`, and the homepage
   `learn_with_ona` section config). Anything that only exists in Shopify is one publish
   away from being lost.

## Known gap to fix when the PDP is built here

Both subscription products (`single-origin-subscription-filter`,
`single-origin-subscription-espresso-coffee`) use `templateSuffix: "filtersub"`. On live,
`templates/product.filtersub.json` has no recommendations-complementary entry at all, so
the highest-attach page on the store (8.05%, 5.7x baseline) shows no cross-sell.

Their metafields are already curated. Whatever product template this theme uses for
subscriptions needs the complementary row included from the start.
