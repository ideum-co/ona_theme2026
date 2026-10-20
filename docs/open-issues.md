# Open issues — found while working, not yet fixed

Things picked up in passing that are real but out of scope for the change that
found them. Annotated here so they are not lost and not fixed blindly.

Each entry says what was **measured**, not what was assumed. Nothing here has
been acted on. Started 2026-10-20.

## Storefront data

### 1. Fourteen coffees have the wrong origin, and one cannot be right

`filters.origin` drives the storefront origin filter. Every coffee states its
country in its own title, so these are checkable, and fourteen contradict it.

| Coffee | Country | `filters.origin` | Should be |
| --- | --- | --- | --- |
| Gargari Gutity G1 Red | Ethiopia | Central America | East Africa |
| Kaliluni AA | Kenya | Central America | East Africa |
| Thageini Karibu | Kenya | South America | East Africa |
| Guji Uraga Siko G1 (drip box) | Ethiopia | South America | East Africa |
| El Ángel | El Salvador | East Africa | Central America |
| Yula Regional Lot | Guatemala | South America | Central America |
| Iris Estate (drip bags) | Panama | South America | Central America |
| Irmãs Pereira Lot 153 (drip) | Brazil | Central America | South America |
| Instant Coffee – Maple | blend | East Africa | Asia + C. America + S. America |
| Instant Coffee – Aspen | blend | East Africa | C. America + S. America |
| Regional Aurea | **Papua New Guinea** | East Africa | **no valid value exists** |

Plus three Unwind products — see issue 2.

Missing entirely: Guji Yabitu Koba G1 (Ethiopia), Raspberry Candy Filter,
Instant Coffee – Raspberry Candy, Milk-Blend Bundle.

**The vocabulary needs extending.** It is four values — Central America, South
America, East Africa, Asia. Papua New Guinea cannot be filed correctly in any of
them. Adding **Oceania** fixes it and would also cover Timor and Indonesia if
`Asia` is ever split.

### 2. Unwind is filed as Central America, but its own copy says Colombia

Unwind's description reads *"a regional blend from Huila, Colombia"*, and
Colombia is South America. The same applies to Instant Coffee – Unwind and
Filter Drip Bags – Unwind, both currently East Africa.

**Held deliberately.** Correcting it is only right if ONA's taxonomy treats
Colombia as South America. If the business groups Colombian coffees with Central
America on purpose, the parent is right and the two derivatives just need to
match it. Needs one sentence from someone who knows the sourcing, not a guess —
this is a flagship decaf.

### 3. Two taste taxonomies that disagree with each other

`Taste Notes.*` product tags and the `filters.taste_notes` metafield are
maintained separately and have drifted apart:

| Coffee | Tags say | Metafield says |
| --- | --- | --- |
| Yula Regional Lot | Apple, Chocolate, Raisin, Red Apple | Almond, Brown sugar, Fig |
| El Avión | Toffees, Chocolate milk, Citrus, Orange | Herbal, Nutty |
| Bridazul Lot 1 | Chocolate, Plum, Raisin | Chocolate, Grapes |
| Kagumo AB | Apricot, Caramel, Citrus, Fruity, Sweet | Fruity, Pink fruit, Sweet |

Two tags are also malformed with a leading space: `Taste Notes. Red Apple`,
`Taste Notes. Toffees`. Which of the two is authoritative is a decision, not a
cleanup.

### 4. The Espresso subscription carries the Filter subscription's data

Single Origin Subscription (Espresso Coffee): `filters.coffee_type` is `Filter`,
`filters.brew_method` is Aeropress / French press / Pour over, and
`custom.tastes_like` is the same string as the Filter subscription. So it does
not appear under an espresso filter and does under a filter one.

### 5. Three filter coffees list espresso-only brew methods

Los Suyates, Bridazul Lot 1 and Raspberry Candy Filter are typed `Filter` but
their `filters.brew_method` is Espresso / French press / Moka Pot — so a
customer filtering for pour over does not see them.

### 6. A flagship coffee lives at `/products/milk-w-som1`

Gargari Gutity G1 Red, Ethiopia, Natural has the legacy handle `milk-w-som1`
from a renamed product. Changing it needs a redirect; worth doing for a coffee
the quiz routes to.

## Theme and pages

### 7. `/pages/locations` ships 1.35 MB of `<main>` HTML

It works — 45,873 characters of text, 20 images — but the store-finder section
inlines its data. Needs a performance pass, not a design one.

### 8. Three pages are thin against the old theme and need content, not layout

`private-courses-and-experiences` (852 chars, 1 image), `womenincoffee` (860, 5),
`recycled-boxes` (1,128, 1). No amount of stage-3 design work fixes a page that
is missing its copy.

### 9. Five `spurit-*` pages and `search-results-page` are published but empty

Left over from removed apps. They should be unpublished rather than styled.
`/pages/spurit-subscriptions` additionally carries hand-written CSS in its page
body that overrides `.page-width` — which will fight the theme.

### 10. `/pages/maintenance` has no template, and cannot get one yet

Its old template is a single full-bleed image, `maintenance-page-2.jpg`, which is
not among this theme's assets. Porting the template without the asset renders a
broken image on an unlinked dormant page — worse than the current empty
fallback. The asset has to come across first.

### 11. `templates/page.locations.json` is dead

No published page uses the `locations` suffix; the live page uses `location`.

### 12. The legacy measure and Horizon's still part above 1520px

After #226 the two agree exactly up to a 1520px viewport. Above that Horizon
widens toward `--normal-page-width` (120rem) while legacy pages hold at
`--narrow-page-width` (90rem). Closing it means choosing the final measure
against the XD — a stage-3 design decision, deliberately not a token swap.

## Process

### 13. The GitHub → Shopify sync silently drops individual files

Three times on 2026-10-20: `assets/legacy-page-layout.css` and
`sections/locations-flagships.liquid` (#201/#204, fixed by #208), then
`templates/page.contact.json`, which sat at its 2026-08-18 copy while every other
file from the same day's merges synced (fixed by #223). Merged is not deployed —
check the file's `updatedAt` on the theme.

### 14. Shopify cannot write back to `main`

`main` requires a PR with zero bypass allowances and `enforce_admins: true`, so
the Shopify app's push is rejected and there are no Shopify-authored commits on
it. Anything edited in the theme editor lives only on the theme until someone
pulls it. Needs a bypass allowance for the `shopify` app — an admin change.

### 15. Four shop-owned files are theme-ahead of the repo

`templates/index.json`, `templates/product.json`, `templates/page.location.json`
and `config/settings_data.json` are edited in the theme editor and are ahead of
git. PR #159 is flagged do-not-merge for this reason (an Oct-14 snapshot against
an Oct-20 theme). Any PR touching these needs to pull first.
