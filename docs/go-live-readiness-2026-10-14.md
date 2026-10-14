# Go-live readiness, 14 October 2026

> **Superseded in part by [`formswell-migration-map-2026-10-14.md`](./formswell-migration-map-2026-10-14.md)**
> (same PR). That document re-reads the template question under the agreed strategy —
> fold onto the Formswell design, delete the old complexity — and the answer changes
> materially: ten of the "28 missing templates" are orphans no live resource uses, the
> `article`, `llms` and `maintenance` suffixes have **no template on any theme** and
> already fall back, and **PR #142 should be closed rather than resolved**, because its
> diff deletes `pdp_product_summary` and reverts the Formswell PDP header.
>
> **Read the map first, and treat its §4.3 as governing for drift and deployment.** This
> document was written before PR #149 landed and before Felipe confirmed that the GitHub
> integration is deliberately not connected, so §1.2 and §1.4 below are historical: the
> shop's `index.json` and `product.json` are authoritative and take surgical in-place
> edits only. What still stands here is Horizon 4.3.0 and the broad sequencing.

Target: publish `ona_theme2026` in place of theme `160335790271`.

Everything below was measured on the shop or in the two repos on 2026-10-14. Counts come
from the Admin API over all 92 active products, 26 pages and 5 blogs -- not a sample.

The headline: **the theme is in good shape; the content wiring around it is not.** Two
thirds of the catalogue (62 of 92) and roughly three quarters of the pages (19 of 26) are
assigned to templates this theme does not contain, and Shopify resolves a missing template by silently falling back to the
generic one.

---

## 1. Blockers -- a publish tomorrow goes out wrong without these

### 1.1 Missing templates (the big one)

The legacy theme has 28 templates this one does not. Shopify keeps the template assignment
on the *resource* (`templateSuffix`), so when the suffix has no matching file the resource
renders on the default template instead. Nothing errors. It just looks wrong.

| surface | assigned to a template this theme lacks | falls back to |
|---|---|---|
| Products | **62 of 92 active** -- 26 on `product-2`, 22 on `product-3`, 6 on `Default product`, **2 on `filtersub`** | `templates/product.json` |
| Pages | **19 of 26** -- `about`, `sustainability` (x3), `privacy`, `faq`, `wholesale`, `training`, `bookings` (x3), `private-courses-and-experiences`, `learn`, `faq-subscriptions`, `text-template`, `html-sitemap`, `llms`, `maintenance`, `location` | `templates/page.json` |
| Blogs | `brewguides`, `news` | `templates/blog.json` |

Three of these need naming out loud:

- **`filtersub`** carries both subscription products (`single-origin-subscription-filter`,
  `single-origin-subscription-espresso-coffee`). Subscriptions are ~24% of the Water For
  Good campaign by value. They would render as ordinary coffees.
- **`location`** looks covered but is not. The page `locations` carries the suffix
  `location`; this theme ships `templates/page.locations.json` -- *plural*. The suffix does
  not match the file, so the Locations page falls back. Either rename the file or re-point
  the page.
- **`llms` and `maintenance`** carry suffixes on live *pages*, but
  `templates/page.llms.*` and `templates/page.maintenance.*` exist on **neither repo, nor
  the live theme `160335790271`, nor theme `154676789439`** -- verified by filename query
  against all three. Both pages already fall back to `page.json` today, so this is the
  status quo and needs no work. (An earlier draft read this as evidence of uninventoried
  direct edits on live. That was wrong.)

The decision this needs is not technical. For each of those 28, either the 2026 design
deliberately folds it into the generic template -- in which case someone has to *look* at
one product and one page per suffix -- or it is a gap. Nobody has made that call yet.

### 1.2 Water For Good -- half ported today, half still open

The campaign runs to 31 October inclusive and this theme had none of it.

- **Counter: done.** `sections/ona-donation-counter.liquid` ported in PR #149, measured
  against live in the browser: card 71x92, 83px Karla, 16px gaps, 12px radius, `#441925`.
  Identical on both themes. The one difference is the CTA face -- live uses *Palmer Lake
  Print*, which this theme does not ship, so it falls back to Silk Serif. **Needs a
  Formswell decision.**
- **PDP badge: already works.** `blocks/ona-product-tags.liquid` and both snippets are
  here and wired into `templates/product.json`.
- **Card badges: placed in the repo, not yet on the shop.** On live every coffee card
  carries "$3 PER 200G AND $12 PER KILO DONATED TO WATER FOR GOOD". PR #149 both taught
  `_product-card` to accept `ona-product-tags` and **placed** it on the four surfaces live
  uses -- `index.json` (`coffee_spotlight`), `collection.json`, `search.json` and
  `product.json`'s recommendations -- deliberately not on `cart.json` or `404.json`. No
  code work remains; what remains is the Shopify side (map §4.3). Note the badge is **not**
  on the 2026 PDP: `ona_promo_tags` sits inside the disabled `group_icgrde`, and live's
  coffee PDP shows no badge either, so that is parity rather than a gap.
- **Cart contribution: out of scope.** The snippet in draft theme `160396837055` has never
  been live and is still unreviewed by Macarena. Shipping it tomorrow would be shipping an
  unreviewed money message.

### 1.3 The PDP body blocks are disabled on `main`

In `templates/product.json` the group holding the product title, price and
`ona_promo_tags` is `"disabled": true` -- replaced by `pdp_product_summary` in #140/#141.
PR **#142** ("Restore PDP customizer template blocks") was opened on 2026-09-29 to undo
exactly that and is still open. Whatever the intent, `main` currently ships a PDP whose
promo badge group is switched off. Resolve #142 before publishing.

### 1.4 The repo and the shop theme have drifted

> **Historical — superseded by the migration map §4.3**, which compares the same files
> structurally rather than by size and reflects `main` after PR #149. The table below was
> measured when `main` was `f78e8cf`; `main` is now `ed3261d`, and `collection.json` and
> `search.json` now differ from the shop by exactly #149's `ona_promo_tags` block, so they
> are **not** "in step" and importing them is what ships the card badge. Size comparison
> is also the wrong instrument: it hid that the shop's `product.json` holds five sections
> the repo lacks.

| file | repo at `f78e8cf` | shop | verdict then |
|---|---|---|---|
| `config/settings_data.json` | `bcd4ef44` | `bcd4ef44` | in step |
| `templates/collection.json` / `cart.json` / `search.json` | identical sizes | identical | in step |
| `templates/index.json` | 172,565 b | 109,856 b, edited 2026-09-29 | **drifted** |
| `templates/product.json` | 43,476 b | 44,485 b, edited **2026-10-05** | **drifted** |

The shop homepage carries a `floating_badge_r89NRP` section the repo's `index.json` does
not list, and the PDP was edited in the theme editor six days after the last commit. Push
the repo over the top and those edits are gone — which is exactly why the GitHub
integration is deliberately not connected and files are imported one at a time. Treat the
shop's `index.json` and `product.json` as authoritative and edit them in place; see the
migration map §4.3.

---

## 2. What is already good

- **The theme itself is well built.** 56 sections, 103 blocks, 24 test files passing
  before today's work, a real design-token layer (`--font-brand-display` / `--font-brand-text`
  over Horizon's own tokens), and brand fonts shipped as local woff2 rather than a CDN.
- **PDP work is the most developed surface** -- 20 of the last 21 commits are PDP:
  breadcrumbs, transparent header, Product DNA from a metaobject, tabs, inline CTA,
  viewport fitting, variant gaps.
- **The PDP product image sizing problem does not exist here.** This theme carries none of
  ONA's legacy `main.css` and sizes the shot from the media column; a drip-bag box renders
  proportionate with no help. The PR #46 fix on the legacy theme is a stopgap that dies at
  cutover.
- **Analytics is cleaner than live.** Neither theme hardcodes GA4 or GTM -- both rely on
  Shopify's pixel layer -- but this one emits Horizon's standard events
  (`page-view-event.js`, `view-event-elements.js`, `@shopify/events`), which the legacy
  theme does not. Any web pixel that subscribes to Shopify's standard events keeps working
  and gets *better* data. The one thing to check is a pixel written against legacy DOM
  selectors; that would break.

---

## 3. Horizon version

This theme is on **4.1.4**. Latest upstream is **4.3.0** (4.2.0 and 4.3.0 both landed since
this theme was cut).

Measured today, 4.1.4 -> 4.3.0 against this repo: 213 files changed upstream, 83 of them
also modified here. 57 of those 83 are locale catalogues that union mechanically. That
leaves **26 real code conflicts, of which only 8 overlap at line level -- 59 lines**:
`footer-policy-list` (23), `product-information-content` (10), `slideshow.js` (8),
`theme.liquid` (6), `header.liquid` (5), `password.liquid` (4), `hero.liquid` (2),
`resource-list-carousel` (1). Call it a day's work.

4.3.0 is worth having -- it fixes cart notes not saving on a first add, cart quantity
buttons, product cards needing two taps in carousels on iPhone, header dropdowns not
resizing, the sticky header vanishing on mobile, and first paint. Those land squarely on
the surfaces being reviewed.

**But not tomorrow.** A version bump the day before go-live replaces a theme that has been
exercised for weeks with one nobody has clicked through. Publish what has been tested, bump
immediately after.

---

## 4. Order of work

Ordered so each step is verifiable before the next, and so nothing waits on a decision that
has not been made.

**Before anything else**

1. **Do NOT reconcile by making the repo win.** There is no GitHub integration, by
   design: files are imported into Shopify one at a time so that a push cannot overwrite
   the custom JSON on the Shopify side. For `index.json` and `product.json` **the shop
   copy is authoritative** — each holds five sections the repo does not, so uploading the
   repo's copy or confirming "the theme matches the repo" erases editor-owned wiring. Edit
   those two in place, surgically. `collection.json` and `search.json` hold nothing
   shop-only and can be imported whole. See the migration map §4.3 for the per-file table.
   Note too that the shop's `product.json`, not the repo's, is the PDP that renders — any
   PDP analysis taken from the repo copy is wrong.
2. **Resolve PR #142** -- the PDP body blocks (section 1.3).

**Then, the template decision (the long pole)**

3. Walk the 28 missing templates. For each suffix, open one live example and one 2026
   render side by side, and record: fold into the generic template, rebuild, or re-point
   the resource. Start where the money is -- `filtersub` (subscriptions), then
   `product-2`/`product-3` (54 products: equipment, merch, candles), then `wholesale`,
   `learn`, `location`, `faq`.
4. Fix the `location` / `page.locations` suffix mismatch -- a rename, five minutes.

**Then the campaign**

5. **Both code steps are done:** PR #149 is merged (`ed3261d`) and `ona-product-tags` is
   placed on the four card surfaces. What is left is the Shopify side — import the counter
   section and `collection.json` / `search.json`, and hand-insert into the shop's
   `index.json` and `product.json` (map §4.3) — plus settling the CTA font with Formswell.
6. Re-check the counter against live at desktop and at both mobile breakpoints.

**Then the surfaces, in the order you asked for**

7. **PDP** -- it has had the most work and still owns the most risk: the disabled block
   group, 54 products arriving on it from `product-2`/`product-3`, subscriptions from
   `filtersub`, promo badges, Product DNA metaobject coverage, image quality at the sizes
   this theme actually renders.
8. **Menu / header** -- Shop, Subscriptions, Learn, Locations, Wholesale, Journal all have
   to land on a template that exists (see step 3). Mega-menu behaviour and the transparent
   header over the hero.
9. **Collections** -- card composition, badges, filters, pagination, image quality.
10. **Search** -- predictive search and the results page share the card blocks from step 9.
11. **Blog** -- `brewguides` and `news` fall back today; article layout and images.
12. **Pages** -- the 19 in step 3, with Wholesale and Learn first.
13. **Cart** -- drawer and page. 4.3.0 fixes several cart bugs, which is an argument for
    doing the bump before this step rather than after.

**After go-live**

14. Bump to Horizon 4.3.0 (section 3).
15. Ship the WFG counter job in `ona-data-platform` so the number stops being written by
    hand, and re-check its storefront contract against this theme's markup.

---

## 5. On "go live tomorrow"

Steps 1, 2, 4, 5 and 6 are a day's work. Step 3 is not: 62 products, 19 pages and 2 blogs
need a human decision each, and that is the step that decides whether the site looks right
the morning after.

The honest shape of it: either the 28 templates fold into the generic ones -- which is
plausible, since this theme was designed around a single rich product template, but nobody
has confirmed it -- or tomorrow publishes a storefront where two thirds of the catalogue
and most of the content pages render on a layout they were never designed for.

Confirming that, for one example per suffix, is the cheapest way to find out. It is maybe
three hours of looking.
