# Measurement: what Shopify already gives us, and the small piece we have to add

**Date:** 2026-09-23
**Audience:** whoever instruments a merchandising surface in this theme.

Read this before writing any tracking code. The short version: **most of what you want
is already measured.** The gap is narrow, and the correct fix is much smaller than an
analytics layer.

## What prompted this

On 2026-09-21 a merch cross-sell row shipped to the live theme, to push merch during a
promo. When we tried to answer "did it work", we could not — the row had no
instrumentation of any kind. We fell back to comparing merch attach rates before and
after, and got the analysis wrong twice:

1. Comparing **gross** sales hid that the ONA Coffee Mug was largely being given away
   free by a gift-with-purchase app. Several baseline days show gross == discount, net
   $0, zero refunds. Two thirds of the "baseline merch attach" was gifts, not purchases.
2. Even after correcting to **net**, nothing distinguishes a sale caused by the row from
   one caused by the 15% merch discount or the ads/email/SMS push running at the same
   time.

Outcome data cannot separate concurrent causes. That is what attribution is for, and it
is why this note exists.

## What is already measured, with zero theme code

Shopify's Web Pixels API emits these with no help from the theme:

`page_viewed`, `product_viewed`, `product_added_to_cart`, `product_removed_from_cart`,
`cart_viewed`, `search_submitted`, `collection_viewed`, `checkout_started`,
`checkout_completed`.

So **we are not blind on outcomes.** Add-to-cart and purchase are captured already. Do
not rebuild them.

Every one of those events also carries a `context` object with `document` (including
`location` and `referrer`) and `window`. That context is the lever this whole design
hangs on.

## What Horizon itself provides — and what it is NOT

Horizon ships two in-page DOM event systems:

- **`ThemeEvents`** (`assets/events.js`): `media:started-playing`,
  `quantity-selector:update`, `megaMenu:hover`, `zoom-media:selected`.
- **`StandardEvents`**, imported from `@shopify/events`: `cartLinesUpdate` (19 call
  sites), `productSelect` (15), `searchUpdate`, `collectionUpdate`, `cartError`,
  `cartNoteUpdate`, `cartDiscountUpdate`.

**These are component-coordination events, not analytics.** They are ordinary DOM events
dispatched on `document` so one component can react to another. They do **not** reach
web pixels on their own, and nothing forwards them.

That distinction matters: the right way to extend is to *subscribe* to these, never to
add new emitters inside stock Horizon components.

## The actual gap

One thing, precisely: **which surface caused the add-to-cart.** Shopify knows a mug was
added. It does not know the shopper came from the PDP cross-sell row rather than search,
a collection, or the cart drawer.

## The design

### 1. The pixel goes in first

Create a **custom pixel** in admin (Settings → Customer events). It is sandboxed,
survives theme swaps, and is the only thing that also sees checkout.

Order matters. Per Shopify's docs, custom events are delivered **only to web pixels
configured on the store** — if no pixel is active, `publish()` resolves and does
nothing. Ship the pixel before anything that publishes to it, or you build a second
blind spot on top of the first.

### 2. Attribution rides on the URL, not on JavaScript

Give each merchandising surface a `ref` parameter on the product links it renders:

```
/products/ona-coffee-canberra-mug?ref=pdp-xsell
/products/ona-coffee-canberra-mug?ref=cart-xsell
```

The **existing** `product_viewed` and `product_added_to_cart` events then carry it in
`context.document.location`. Surface attribution, with no tracking code at all.

This is deliberately boring, and that is the point:

- It works on the **live 3.5.1 theme** as well as this one, so it can be measured before
  cutover rather than after.
- It survives Horizon upgrades, because it is a link attribute, not a component edit.
- It degrades to nothing if the pixel is removed.

Keep the values in a short, closed vocabulary (`pdp-xsell`, `cart-xsell`,
`cart-drawer-upsell`, `home-featured`) and write them down here when you add one.
Free-form values make the pixel-side grouping unanalysable within a month.

### 3. For interactions that never navigate, forward what Horizon already emits

A quick-add directly from the row never loads a product page, so no `ref` travels with
it. For those, add **one** listener — in a new file — that subscribes to Horizon's
existing `StandardEvents.cartLinesUpdate` and publishes a custom event carrying the
surface:

```js
import { StandardEvents } from '@shopify/events';

document.addEventListener(StandardEvents.cartLinesUpdate, (event) => {
  const surface = event.target?.closest?.('[data-ona-surface]')?.dataset.onaSurface;
  if (!surface) return;
  window.Shopify?.analytics?.publish('ona_surface_add', { surface });
});
```

Subscribing to an event Horizon already dispatches costs us nothing on upgrade. Adding
a `publish()` call inside `component-cart-items.js` or `quick-add.js` would make those
stock files ours forever — see the upgradability rules in
`cross-sell-and-forward-compatibility.md`.

## Constraints worth knowing before you design around them

- **`clicked` DOM events exist for custom pixels, but are thin.** `event.data.element`
  exposes `id`, `value` and `href` — **not arbitrary `data-` attributes.** If you want
  to identify a clicked element, the identity has to live in its `id` or its `href`.
  That is a second reason the `ref` parameter approach wins.
- **`advanced_dom_clicked` is not available to us.** It requires a scope granted only to
  apps doing heatmaps or session recording, and the docs state it cannot be used on
  custom apps. Do not design around it.
- **Custom events reach pixels only.** They are not a general message bus and they do
  not reach Shopify's own analytics reports.
- **Payloads must be JSON-serializable**, and must not carry PII.

## A/B testing: the honest position

Shopify has **no native theme A/B split.** The options are a client-side bucket (which
means flicker and layout shift on anything visual, so it is a poor fit for testing
merchandising layouts) or a third-party app that splits at the edge.

If real A/B matters, buy it. But **not before the `ref` attribution exists** — splitting
traffic you cannot attribute just produces two equally unmeasurable variants, at extra
cost.

## Where to spend the effort

Merch is ~0.8% of net revenue. Subscriptions attach at **8.05%, 5.7x the site baseline**.
Instrument by what moves the business, not by what is currently interesting. The `ref`
vocabulary should cover the subscription and cart surfaces before it covers merch.
