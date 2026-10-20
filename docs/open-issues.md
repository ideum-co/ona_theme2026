# Open issues — found while working, not yet fixed

Things picked up in passing that are real but out of scope for the change that
found them. Annotated here so they are not lost and not fixed blindly.

Each entry says what was **measured**, not what was assumed. Nothing here has
been acted on. Started 2026-10-20.

## Storefront data

ONA's actual sourcing footprint, from Cropster green-lot records
(`gold.dim_green_lot.countries_of_origin_json`), for reference when judging any
origin claim below:

| Country | Green lots |
| --- | --- |
| Colombia | 6 |
| Honduras, Panama, Kenya | 3 each |
| Rwanda, El Salvador, Ethiopia | 2 each |
| Brazil, Peru, Bolivia | 1 each |

South America (Colombia, Brazil, Peru, Bolivia) is nine lots — yet **not one
single-origin coffee on the storefront is correctly filed under South America**.
Every `South America` value on a single origin is on a coffee from somewhere
else. That asymmetry is what first suggested these are data-entry errors rather
than an alternative taxonomy.

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
| Instant Coffee – Maple | blend | East Africa | South America + East Africa (see 2b) |
| Instant Coffee – Aspen | blend | East Africa | East Africa + Central America + Asia Pacific (see 2b) |
| Regional Aurea | **Papua New Guinea** | East Africa | **no valid value exists** |

Plus three Unwind products — see issue 2.

The two Instant rows above are **derived**, not observed: an instant coffee has
no country of its own, so its origins are whichever its parent blend currently
has. They therefore follow issue 2b's six-month window and change with it. An
earlier revision of this file gave them values taken from unfiltered roast
history, which contradicted 2b — if 2b is re-run, these two rows move with it.

Missing entirely: Guji Yabitu Koba G1 (Ethiopia), Raspberry Candy Filter,
Instant Coffee – Raspberry Candy, Milk-Blend Bundle.

**The vocabulary needs extending — researched 2026-10-20.** It is four values:
Central America, South America, East Africa, Asia.

Papua New Guinea is not an edge case. ONA's own roasting records carry
`80kg PNG Kaw Kaw W` (558 roasts), `120kg PNG Kaw Kaw W` (308) and
`ASPEN - 120kg PNG Arokora W` (153) — over a thousand roasts across PNG lots.
It is a staple origin that the storefront cannot describe.

`Asia` is not the answer, and is itself suspect. Exactly one product uses it —
Maple — and Maple's roast records are Ethiopian, Colombian, Brazilian and
Honduran, with no Asian component at all. Aspen *does* contain PNG and is not
tagged `Asia`. So `Asia` is unsupported by any current coffee.

**Recommendation: rename `Asia` to `Asia Pacific`.** It matches how the trade
groups PNG, gives it a home without adding a single-product facet, and the
rename costs nothing because the only product using `Asia` should not be. A
separate `Oceania` value would mean two sparse facets instead of one real one.

### 2. Unwind is mis-filed — answered, Colombia is South America

Researched 2026-10-20; no longer an open question.

Two independent confirmations that ONA treats Colombia as South America:

- **Colombia Monteverde, Dark Blue Honey** carries tag `Origin.South America`
  *and* `filters.origin: ["South America"]`. The two agree, which they rarely do.
- **Bruma, Colombia, Washed** carries the correct tag `Origin.South America`
  while its metafield says `East Africa` — so even where the metafield is
  corrupt, the tag records the same convention.

And Unwind is confirmed Colombian from ONA's own roasting records, not just its
marketing copy: the roast is named **`UNWIND - COL Decaf 20kg`**.

So Unwind (`Central America`) and its two derivatives (`East Africa`) are all
wrong and should be `South America`. Nothing here needs a business decision.

### 2b. The blends' origins are wrong too, and only Cropster shows it

A single origin can be checked against its own title. A blend cannot — its
components are only in the roasting records.

**Method.** `gold.fact_roast`, restricted to roasts since **2026-04-20** (the
last six months). The window matters: these recipes change seasonally, so
all-time history describes what a blend *has* contained, not what it contains.
Reading it unfiltered puts Brazil in Aspen and Colombia and Honduras in Maple,
none of which they have been roasted with this season.

| Blend | Roasts in window | Countries now | Should be | Storefront says |
| --- | --- | --- | --- | --- |
| **Aspen** | 1,202 | ETH, NCA, HON, **PNG** | East Africa, Central America, Asia Pacific | Central America, South America |
| **Maple** | 1,653 | **BRA**, ETH | South America, East Africa | **Asia**, Central America, South America |
| **Gateway** | 1,211 | ETH, **COL**, KEN | East Africa, South America | Central America, East Africa |
| **Raspberry Candy** | 212 | ETH | East Africa | East Africa ✅ |
| **Unwind** | 405 | **COL** | South America | Central America |

So Aspen is missing East Africa — its largest component — and Papua New Guinea,
while still claiming a South America it no longer contains. Maple claims `Asia`
and `Central America` with nothing behind either, and omits East Africa.
Gateway claims Central America and omits South America. Raspberry Candy is the
only one correct.

**This is a moving target.** The window above is a snapshot; a recipe change
next season invalidates it. Hand-correcting these in Shopify will drift again,
which argues for deriving blend origins from the roast records rather than
maintaining them by hand. Whoever picks this up should re-run the query rather
than trust the table.

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

### 5b. The PDP coffee quiz cannot recommend anything

Found by Codex on #239, confirmed by reading the section and the template.

`coffee_quiz_VLVDpw` was built in the theme editor and is live on every product
page, but it is a half-finished copy of the homepage quiz:

| | PDP quiz | Homepage quiz |
| --- | --- | --- |
| Match blocks carrying a product | **0 of 3** | 7 of 7 |
| Options carrying a scoring tag | 14 of 32 | 21 of 32 |
| `explore_link` | **blank** | `/collections/all-coffee` |

`sections/coffee-quiz.liquid:78-80` serializes a match with no product as
`"url": null, "variantId": 0, "available": false`. So a shopper who finishes the
quiz gets a disabled Add to cart, no Subscribe, no product link — and with
`explore_link` blank, no way onward at all. Three of the six questions (brew,
drink style, shopping purpose) score nothing, so half the flow is for show.

The fix is configuration, not code, and the homepage section is the template for
it: assign the sellable product to each match, tag the remaining options, set
`explore_link`. Two of the three match titles (Raspberry Candy, Maple) map to
products the homepage quiz already points at; **Ugly Sweater needs confirming** —
it is not among the homepage matches.

### 5c. One coffee has no `custom.profile_intro`

`filter-el-angel-el-salvador-natural` is the only coffee of 23 without it, so its
Profile tab now shows the tasting note and no body copy. Every other coffee has
one; the 37 products without are merch, equipment and matcha, which have no
Profile tab worth filling. Content gap for the ONA team, not a theme bug.

## Theme and pages

### 6b. `ona-unique-coffees` keeps its collapse in the shared sheet

The section has a preset, so it can be placed on any JSON template — but the
rules that stack its slides and show one (`#MainContent .unique-coffee-block
.imgs-slider-unique …`) live in `assets/legacy-page-layout.css`, which only
loads for a fixed list of page suffixes. On any other template the script would
toggle `is-active` while nothing collapses anything, and every slide would show
at full size. That is exactly how the FAQ sections broke before #218.

It works today because it is only used on `/pages/wholesale`. The fix is the
one `ona-supported` and `ona-wholesale-testimonial` now use: move the rules into
the section's own `{% stylesheet %}`, or adopt the shared `<ona-slider>`.

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

### 12. ~~The legacy measure and Horizon's still part above 1520px~~ — withdrawn

This was wrong, and the measurement that found it was taken at too narrow a
viewport to show it.

`layout/theme.liquid` renders `<body class="page-width-{{ settings.page_width }}">`,
and `assets/base.css` declares `--page-margin` and `--page-content-width` on
those classes. Custom properties inherit, so legacy markup carries Horizon's
live values already — measured on `/pages/faq`, the legacy `.container` resolves
`--page-margin` to 40px and `--page-content-width` to 90rem, the same as the
Horizon section beside it. At a 1686px viewport both sit at left=118, width=1440.

They never diverged. The sheet now references those variables instead of
restating them, so the gutter steps when Horizon's steps and the measure follows
whichever `settings.page_width` is set.

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

### 16. Four app embeds load on every page and render nothing anywhere

Audited 2026-10-20 against the live storefront (8 pages sampled: home,
`/collections/all`, `/products/aspen`, and the locations, wholesale, contact,
bookings and training pages), plus all 26 page bodies and every template in the
repo. `config/settings_data.json` carries fourteen app embeds. Four of them
have no consumer at all:

| Embed | Evidence it is unused |
| --- | --- |
| `promap-rp/findonline-embed-block` | 0 containers on any sampled page |
| `promap-rp/stockistform-embed-block` | 0 references in any of the 26 page bodies |
| `promap-rp/storelocator-embed-block` | the store finder is the theme's own `page.locations.json` |
| `promap-rp/wheretobuy-embed-block` | no ProMap app block in any template |

Between them they add `storelocator.css` and `findonline.css` to every page,
and `//cdn.roseperl.com/storelocator-prod/assets/js/infobubble.min.js` — a
third-party origin — to four of them.

Two more render nothing but are cheaper:

- `dotdigital/chat` is configured `"region": "none"`. It still pulls six files
  from `webchat.dotdigital.com` (bootstrap, bridge, the widget CSS and two
  iframe documents) and produces no fixed-position element on the page.
- `microsoft-clarity/brandAgents_js` issues **zero** network requests. Clarity
  itself works — one tag, `xsv0z8njx6`, `window.clarity` is a function, and
  there is no second copy of it anywhere.
- `forms` (Shopify Forms) loads `shopify-forms-loader.js` on every page. There
  is no `<shopify-form>` element on any sampled page, no reference in any page
  body and no app block in any template. Worth checking in the admin before
  switching off: a form configured as a timed or once-per-visitor popup would
  not show up in this audit.

### 17. Powerful Form Builder costs 212 KB on every page for one form

`powerful-form-builder/app-embed` injects a single inline `<script>` of
**216,945 bytes** into the `<head>` of every page — 23% of the homepage's
952 KB of HTML. It carries the markup for every form in the account, including
ones the page will never show.

Exactly one form in the store uses it: form `62822` on `/pages/contact`, which
posts to `form.globo.io`. It is placed in the page's body HTML, not in the
theme. Nothing else in the store references Globo.

The wholesale page already proves the alternative: its "Get in touch" form is a
native Shopify `/contact` form with eight fields, rendered by the theme's own
`ona-gust-r` section, with no app involved.

So the fix is not to disable the embed — that breaks the contact form. It is to
rebuild form 62822 the way wholesale already does it, then uninstall the app.

### 18. Rebuy loads on every page through a script tag and renders nothing

Not an app embed, so it is invisible to the App embeds panel and unaffected by
anything in `config/settings_data.json`. Rebuy Personalization Engine is
installed with `write_script_tags` and injects six files on every page —
`rebuy.js`, a global bundle, two stylesheets including a full FontAwesome, a
cached user stylesheet and a Splide vendor bundle. `window.Rebuy` is an object;
`[data-rebuy-id]` matches **0** elements on every page sampled.

Turning it off means uninstalling the app or removing its script tag in the
admin, not a theme change.
