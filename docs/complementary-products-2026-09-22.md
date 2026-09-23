# Complementary products: the ranking, and how to undo it

**Date:** 2026-09-22

Committed here so the ranking and the rollback state survive without access to a
developer's machine or a sibling checkout. Complementary products are catalogue-level
(product metafields), so this applies to every theme on the store, including this one.

## The metafield

```
namespace: shopify--discovery--product_recommendation
key:       complementary_products
type:      list.product_reference
owner:     PRODUCT
```

Written via `metafieldsSet`. Surfaced by Shopify's recommendations API as
`?intent=complementary`, and by Horizon's `product-recommendations` section/block via
`recommendation_type: complementary`.

## State before this change

**Every product in the catalogue had zero complementary products.** Verified two ways:
`/recommendations/products.json?intent=complementary` returned 0 for aspen, maple, gateway,
unwind and raspberry-candy; and `productByHandle(aspen).metafields(namespace:
"shopify--discovery--product_recommendation")` returned an empty list.

## Rollback

Delete the `complementary_products` metafield from each product below (or set it to an
empty list). Since all were previously unset, removal restores the prior state exactly.
Any theme row then falls back to whatever its section defines -- on live, the merch
collection; with Horizon's native section, nothing.

## Evidence behind the ranking

180 days of order history, 15,886 orders, exported via `bulkOperationRunQuery` on
2026-09-19.

- **86% of merch orders also contain coffee.** Only 31 merch-only orders in six months.
  Merch is an attachment product, not a destination -- which is what makes cross-sell the
  right lever.
- **Baseline: 1.41%** of all orders contain merch.
- **The ONA Coffee Mug was the #1 merch companion for every single coffee tested** -- all
  18 rows, no exceptions. 105 of the 193 mixed baskets.
- Counter-intuitively, the **biggest coffees attach worst**. Maple 0.70%, Raspberry Candy
  0.69%, Aspen 0.85% -- roughly half the baseline. High-volume coffees are bought by repeat
  buyers who know what they want.
- **Subscriptions attach best by a wide margin: 8.05%, 5.7x baseline** (19 of 236 orders),
  and the Mug was their top companion. Instant coffee and drip bags ran ~2-3x baseline.

Sizing, so nobody over-invests: lifting attach from 1.41% to 3% is worth roughly
+253 merch orders per 180 days, about +$15k/year at a $30 average. High margin and cheap
to capture, but it will not move the business on its own.

## What was set, 2026-09-22

Merch targets, all in stock at the time:

| | GID |
|---|---|
| ONA Coffee Mug | `gid://shopify/Product/7144298184895` |
| Huskee x ONA Cup | `gid://shopify/Product/8249202540735` |
| Better Days with ONA Cold Cup | `gid://shopify/Product/6775044374719` |
| Raspberry Candy Candle | `gid://shopify/Product/7026313855167` |

| coffee | complementary, in order |
|---|---|
| single-origin-subscription-filter | Mug, Huskee |
| single-origin-subscription-espresso-coffee | Mug, Huskee |
| instant-coffee-aspen | Mug, Huskee |
| instant-coffee-maple | Huskee, Mug |
| instant-coffee-candy | Mug, Huskee |
| instant-coffee-unwind | Mug, Huskee |
| filter-drip-bags-raspberry-candy | Mug, RC Candle |
| raspberry-candy-filter | Mug, RC Candle |
| raspberry-candy | RC Candle, Mug |
| maple | Mug, Huskee |
| aspen | Mug, Cold Cup |
| gateway | Mug, Huskee |
| unwind | Mug, Huskee |

Order matters -- the first entry renders first.

## Deliberately excluded, and worth revisiting

The candles are named after the coffees (Maple, Aspen, Raspberry Candy, Gateway), which is
the cleanest pairing the catalogue naturally offers and it maps onto the three biggest
coffees. At the time of curation **Maple Candle and Aspen Candle were both at zero stock**,
so they were left out -- recommending them would have sent shoppers to a dead end on the
#1 and #2 coffees.

Aspen Candle has since been restocked (1 unit as of 2026-09-22, `inventoryPolicy: DENY`,
tracked). **On a real restock, add coffee -> matching candle**; the basket data supports it
(Aspen Candle co-occurred with Aspen coffee in 7 of its 10 mixed baskets).

## Not yet curated

Only 13 products are done -- the highest-attach and highest-reach ones. The rest of the
catalogue is uncurated and falls back to whatever the theme's section does. Extending the
ranking is merchandising work, not engineering.
