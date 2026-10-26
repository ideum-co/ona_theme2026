# The two subscription doors, and how to keep them feeling like one

Measured on live 2026-10-26. This extends `customer-accounts-and-subscriptions.md`, which
records *that* customer accounts live outside the theme. This one records *what a customer
sees* once they are there, and which lever changes each part.

## The surfaces

A customer can reach their subscriptions by two routes. Both are Appstle; neither is ours.

| | **Portal** | **Account page** |
|---|---|---|
| URL | `onacoffee.com.au/apps/subscriptions` | `shopify.com/46448246934/account` → Subscriptions |
| How it is served | Shopify app proxy, inside **this theme's layout** | Shopify-hosted, customer-account UI extension |
| Chrome around it | our header, our footer | Shopify's account shell |
| Who styles the frame | the theme | checkout branding, profile `585302207` |
| Who styles the content | Appstle (inherits our tokens) | Appstle (inherits Shopify's) |
| Reachable by | magic-link email, FAQ links, direct URL | footer "My Account", header account icon |

There is a third entry point that is not a third surface: a **Manage Subscription** button on
the account Orders page, which links to `ona-coffee.myshopify.com/apps/subscriptions`. That
301s to the primary domain, so it is one wasted hop, not a leak. It renders for every signed-in
customer, including the ~284 who hold no active subscription (837 total, 553 active).

## Which one customers are used to

The portal. This is not a preference, it is what we have published:

- `templates/page.faq-subscriptions.json` links to `/apps/subscriptions` **eight times**, and is
  the page that answers "how do I pause / skip / change my coffee".
- The subscription magic-link email sends customers there.
- **No file in this theme links to `/account` at all.** The footer "My Account" entry comes from
  the Shopify navigation menu, not from theme code.

So the portal is the primary door and should stay the primary door. The account page is the one
people arrive at by accident — from the header icon, or after checkout — and it has to lead
somewhere that feels like the same place.

## Where they diverge today

Both render the same Appstle application, so the *functions* match: skip, reschedule, swap
product, change frequency, add product, ship next order now, and the Details / Upcoming Orders /
Past Orders tabs. The divergence is entirely presentation.

| | Portal (in our layout) | Account page (Shopify-hosted) |
|---|---|---|
| Headings | Silk Serif | Karla |
| Body | Karla | falls back to `-apple-system` |
| Background | `#f4f3e9` | `#F2F0EB` |
| Ink | `#470a12` | `#862041` brand, `#651D32` accent |
| Nav / secondary text | `#470a12` | `rgba(0,0,0,.56)` — 4.76:1 |

The portal already inherits the theme's Karla and `#470a12`, because it sits inside our page and
Appstle honours the inherited tokens (the same reason the PDP widget does — see
`snippets/appstle-widget-styles.liquid`). **The portal is the on-brand surface. The Shopify
account page is the one that does not match.**

## The levers, and what each one costs

1. **Theme CSS** — reaches the portal only. Free, reviewable, ours. Used by
   `snippets/appstle-portal-styles.liquid`.
2. **Appstle → Customer Portal → Custom CSS** — currently **empty**. Reaches Appstle's own
   markup. This is the only lever that can restyle the Appstle content on the Shopify-hosted
   account page, because that page is a different origin and the theme cannot reach it.
3. **Checkout branding, profile `585302207`** — reaches the Shopify account shell: its fonts,
   background and brand colour. **This is the same configuration that styles checkout.**
   `CheckoutBrandingCustomizations` exposes no customer-account-only fields, and the Customize
   button on Settings → Customer accounts navigates to `settings/checkout#checkoutprofiles`.
   There is no way to restyle the account pages without also restyling checkout.

That third point is the constraint that shapes everything: matching the account page to the
theme means changing the look of checkout. That is a decision about the money path, not a
styling tweak, and it is not made in this repo.

## Keeping it manageable

Levers 2 and 3 live in admin text fields with no version control and no review. The rule we
follow: **anything pasted into Appstle Custom CSS has its canonical copy in this repo**, so a
change is reviewable and a drift is visible. The theme-side half is
`snippets/appstle-portal-styles.liquid`; a future Appstle-side block belongs beside it with a
test pinning the shared tokens.

## Known, not fixed here

- The Manage Subscription button shows to customers with no subscription. Appstle account-page
  extension placement, not theme.
- "Subscriptions" in the account nav, "Subscription" as the Appstle page heading, "My Account"
  in our footer, "< My Account" inside the portal — four labels for two places.
- `#862041` is a third maroon in the system, alongside the theme's `#470a12` and the account
  accent `#651D32`. It is also the Judge.me star colour already recorded at 1.74:1 on the PDP.
