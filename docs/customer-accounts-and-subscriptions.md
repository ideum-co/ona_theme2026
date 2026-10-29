# Customer accounts and subscriptions are not in this theme

**Almost nothing on this page can be changed by editing this repository.** The
customer account area — including every Appstle control *in that area* — is
configured in the Shopify admin, outside the theme. A merge to `main` cannot fix it.

There is exactly one exception that can silently break the subscriptions nav, and it
bites in the same dimension this document is about. `sections/header-group.json` carries
`"customer_account_menu": "customer-account-main-menu"`, which `sections/header.liquid`
forwards to `snippets/header-actions.liquid`, which spends it on
`<shopify-account menu="…">`. All three links have to hold. Blank that
value or drop the key and the storefront header's account dropdown stops offering the
Subscriptions item, while the admin still looks perfectly correct — and
`sections/header-group.json` is a shop-owned, editor-writable file this repo has lost
keys from before. `tests/customer-accounts-outside-the-theme.test.mjs` pins it.

(Separately, the Appstle *storefront* helper is an app embed in
`config/settings_data.json`, not an account-area setting. That one is in the repo and
can be switched off by a merge.)

Written 2026-10-26, after the subscription controls became hard to reach for
customers and the cause was mistakenly looked for in the theme.

## Why the theme has nothing to do with it

The store runs **new customer accounts**: customers sign in at a `shopify.com`
account URL, not at `onacoffee.com.au/account`. New customer accounts ignore the
legacy `templates/customers/*` Liquid templates entirely.

Checked and confirmed: neither the live theme nor `ONA - LIVE 11/05/2026`
(`151303127231`), the theme it was checked against, contains any `templates/customers/*`
file. No customer-account *template* exists to regress, and
`tests/customer-accounts-outside-the-theme.test.mjs` keeps it that way — adding one
would look like a fix and do nothing at all. The guard covers the template family and
the legacy `layout/customers.liquid`; it does not and cannot prove the absence of every
conceivable account-shaped file, only the ones a person reaching for this would add.

## Where it actually lives

**Settings → Checkout → Configurations → the ONA Coffee configuration →
Customize.** The page selector at the top of that editor switches between
Checkout, Thank you, and the Customer accounts pages (Sign-in, Orders, Order
status, Profile, and any app pages that have been added).

Two separate layers both have to be right, and only one of them is in that editor:

1. **Placement** — which Appstle blocks and pages appear, and where. Shopify
   admin, in the editor above.
2. **Permissions** — which actions a customer may take once they get there.
   Appstle → Customer Portal → Customize portal. Note the app's handle is
   `subscription-by-rhem` (Appstle was formerly Rhem), so an admin URL built from
   the name "appstle" will 404.

The October 2026 complaints were a **reachability** problem, not a lost-features
one: cancel, pause, resume, resume-cancelled, order-now and skip-upcoming were all
still enabled in the portal the whole time. Customers simply had no link to them.

## The state this should be kept in

- **Orders page** — the Appstle *Manage Subscription Button* block, aligned to the
  end. Orders is the page customers land on after signing in, so this is the
  primary entry point; without it the account area looks like it has no
  subscriptions at all.
- **Profile page** — the same block, aligned to the end. Its alignment was left
  blank, which renders it inconsistently against the Orders page.
- **Account navigation** — a `Subscriptions` item in the
  `customer-account-main-menu` menu pointing at the *Subscription management*
  page, so the area is reachable by navigation and not only by a button.

*Subscription management* is the right page to link, not *Subscription Detail*.
Subscription management lists a customer's subscriptions and degrades gracefully
for the majority who have none ("No subscriptions found…"). Subscription Detail
expects a subscription to have been chosen already and otherwise renders only
"Select a subscription to view its details."

Because the button shows for every signed-in customer, most of whom have no
subscription, the graceful empty state is what makes the entry point safe to leave
switched on.

## What can actually revert it

Not a merge. The realistic risks are:

- an admin edit in the checkout/accounts editor that removes a block or a page;
- an Appstle app update or reinstall, which can re-register its extensions and
  drop placements that were added by hand;
- a new checkout profile being published, since this configuration belongs to one
  profile and does not follow the theme.

After any of those, re-check the three items above before assuming the theme broke.

## Related

The checkout's Order summary also carries two *Rebuy Smart Component* blocks that
report an error in the editor. They are **not** dead: both are waiting on a
protected-customer-data access approval for the Rebuy app. Removing them would
discard working configuration; granting the access is a data-sharing decision, not
a cleanup.
