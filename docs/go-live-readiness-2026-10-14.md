# Go-live readiness, 14 October 2026

> **Superseded in part by [`formswell-migration-map-2026-10-14.md`](./formswell-migration-map-2026-10-14.md)**
> (same PR). That document re-reads the template question under the agreed strategy —
> fold onto the Formswell design, delete the old complexity — and the answer changes
> materially: nine of the "28 missing templates" are orphan files no live resource uses, the
> `article`, `llms` and `maintenance` suffixes have **no template on any theme** and
> already fall back, and **PR #142 should be closed rather than resolved**, because its
> diff deletes `pdp_product_summary` and reverts the Formswell PDP header.
>
> **Read the map first, and treat its §4.3 as governing for drift and deployment.** This
> document was written before PR #149 landed, so §1.2 and §1.4 below are historical.
> §4.3 of the map now also corrects something this document originally got wrong in the
> other direction: theme `154676789439` **is** GitHub-connected (`ona_theme2026/main`),
> the connection cannot be removed, and a merge to `main` deploys within seconds. The
> shop's editor state is still the authoritative *input*, but it is reconciled **into the
> repo** (PR #151) rather than edited in place. What still stands here is Horizon 4.3.0
> and the broad sequencing.

Target: publish `ona_theme2026` in place of theme `160335790271`.

Everything below was measured on the shop or in the two repos on 2026-10-14. Counts come
from the Admin API over all 92 active products, 26 pages and 5 blogs -- not a sample.

The headline: **the theme is in good shape; the content wiring around it is not.** Two
thirds of the catalogue (56 of 92) and roughly three quarters of the pages (19 of 26) are
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
| Products | **56 of 92 active** -- 26 on `product-2`, 22 on `product-3`, 6 on `Default product`, **2 on `filtersub`** | `templates/product.json` |
| Pages | **19 of 26** -- `about`, `sustainability` (x3), `privacy`, `faq`, `wholesale`, `training`, `bookings` (x3), `private-courses-and-experiences`, `learn`, `faq-subscriptions`, `text-template`, `html-sitemap`, `llms`, `maintenance`, `location` | `templates/page.json` |
| Blogs | `brewguides`, `news` | `templates/blog.json` |

Three of these need naming out loud:

- **`filtersub`** carries both subscription products (`single-origin-subscription-filter`,
  `single-origin-subscription-espresso-coffee`). Subscriptions are ~24% of the Water For
  Good campaign by value. They would render as ordinary coffees.
- **`location`** looks covered but is not. The page `locations` carries the suffix
  `location`; this theme ships `templates/page.locations.json` -- *plural*. The suffix does
  not match the file, so the Locations page falls back. **Rename the file**, not the page:
  a page's `templateSuffix` is shop-wide, so re-pointing it would also move the page on
  the currently published theme.
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
- **PDP badge: built, but its only PDP placement is disabled.**
  `blocks/ona-product-tags.liquid` and both snippets are here, and `ona_promo_tags` does
  appear in `templates/product.json` — **inside the disabled `group_icgrde`**, so it
  renders nowhere on the PDP. Live's `product-template-2`/`-3` *do* show it, so equipment
  and merch PDPs are a real parity gap; live's coffee PDP shows none, so coffee is not.
  See map §3.2. (An earlier draft of this line said the PDP badge "already works". It does
  not.)
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
> structurally rather than by size, and which records what the live GitHub integration
> then did to them. The table below was measured when `main` was `f78e8cf`; `main` is now
> `ed3261d`, `collection.json` and `search.json` shipped #149's `ona_promo_tags` block to
> the theme on merge, and `index.json` / `product.json` were overwritten by the same pull
> and are restored by PR #151. Size comparison was also the wrong instrument: it hid that
> the shop's `product.json` held five sections the repo lacked.

| file | repo at `f78e8cf` | shop | verdict then |
|---|---|---|---|
| `config/settings_data.json` | `bcd4ef44` | `bcd4ef44` | in step |
| `templates/collection.json` / `cart.json` / `search.json` | identical sizes | identical | in step |
| `templates/index.json` | 172,565 b | 109,856 b, edited 2026-09-29 | **drifted** |
| `templates/product.json` | 43,476 b | 44,485 b, edited **2026-10-05** | **drifted** |

The shop homepage carries a `floating_badge_r89NRP` section the repo's `index.json` does
not list, and the PDP was edited in the theme editor six days after the last commit. Push
the repo over the top and those edits are gone — which is precisely what the #149 merge
went on to do, because the integration **is** connected and pulls on every commit that
touches a file. The fix is not to avoid pushing (that is not available) but to make the
repo carry the editor's state before anything lands. See the migration map §4.3 for the
checksum test that tells you whether it already does.

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

1. **Reconcile the shop's editor state into the repo, then merge once — PR #151, then
   PR #152.** The
   GitHub integration is live and cannot be disconnected: theme `154676789439` is named
   `ona_theme2026/main` and pulls within seconds of any commit to `main` that touches a
   file. So "edit the shop copy in place and never push" is not a strategy that holds —
   the next merge touching those files overwrites it, which is what happened to ten
   editor-made sections on 2026-10-14. The shop's state is still the authoritative
   *input*: for `index.json` and `product.json` it holds sections and editor-set values
   the repo did not, so the repo copy is rebuilt from it rather than the other way round.
   Before any merge that touches a shop-owned template, run the checksum test in map
   §4.3 — equal to the repo file means the integration owns it and merging is safe,
   unequal means the editor has diverged it and must be merged in first.

   **#151 merged at 12:29:57Z and only half of it landed.** `product.json` pulled seven
   seconds later and its checksum now matches the repo file. `index.json` did not pull at
   all: at 28 sections it was over Shopify's limit of 25 per JSON template, so the
   integration declined the whole file — silently, with no error anywhere, and with the
   repo now looking correct. The only symptom was a checksum that had not moved. **PR
   #152** (`c410869`, merged 12:45:49Z) brought the file to 25 by dropping the three
   sections that had never been on the theme, and added a test for both platform limits.
   It pulled at 12:45:56Z, checksum `260ba3fb…` == md5 of the repo file, so **both
   templates are now restored and verified on the theme.** The rule this adds: **a merge
   is not a deploy until you have re-read the checksums and confirmed every file you
   touched actually pulled.** Note also that the homepage now sits at exactly 25 of 25 —
   a hard platform cap, so any new homepage section means removing one.
2. **Water For Good campaign — deployed 2026-10-14, one decision outstanding.**
   The badges expire **2026-10-31**. Merging
   #149 (`ed3261d`) already deployed `sections/ona-donation-counter.liquid`,
   `blocks/_product-card.liquid`, `templates/collection.json` and `templates/search.json`
   to the theme, so the card badge on collection and search is shipped. What remains is
   the counter section on the homepage and the two remaining card-badge placements, all
   three of which were folded into PR #151 — and #151 plus #152 **completed the deploy
   on 2026-10-14.** Verified rendering on theme `154676789439`: the counter at
   `$11,129`, heading `DOLLARS CONTRIBUTED SO FAR`, CTA resolving to
   `/collections/donation-products`; and the promo badge on the homepage (7 cards), the
   `donation-products` collection (14, matching the live theme's count), search (9) and
   the PDP recommendation cards (3, immediately after the gallery). What is left on this
   item is the Palmer Lake vs Silk Serif CTA decision with Formswell.
3. Re-check the counter against live at desktop and at both mobile breakpoints — including
   a real phone, since Chrome on this workstation cannot reach phone width. The desktop
   render is confirmed; the two mobile breakpoints are **not** yet checked on a device.
4. **Two PDP decisions that must land before publishing.**

   a. **Clear the Maple copy off the shared PDP template — the single largest
   pre-publish item, live-visible on all 92 products.** `templates/product.json` is the
   *only* product template in this theme, so every product renders it. Four of its
   enabled sections carry hard-coded Maple copy, none metafield-driven: the
   `product_tabs_fW4maV` tab (text *and* a `maple.webp` image), `story_video_VUwQ6f`
   ("Maple has become one of ONA's most familiar coffees"), `product_dna_trxBBN`
   (heading "Maple DNA") and `section_EhyeAD` ("Who's Maple For?"). Verified 2026-10-15
   on one product of every suffix — an ONA vest's page currently says "Maple DNA".
   Map §3.1 has the table; it is the same decision as the badge fallbacks, so take them
   together. **Verify by fetching one product of each suffix and reading the page** —
   this is invisible from the template, which is why it survived several review rounds.

   b. **Give every enabled CTA a destination.** Scanned both live templates 2026-10-15
   for a non-empty label paired with an empty link; four are **enabled** and render a
   dead link today: `club_benefits_937XiA` ("Find your subscription"),
   `story_video_URBFL6` ("Learn more about ONA") and `coffee_quiz` ("Explore all our
   coffees") on the homepage, and `inline_cta_8ann9f` ("Try our coffee quiz") on all 92
   PDPs. Six more sit in disabled sections -- and those are the same sections whose
   enabling is an open decision, so give them destinations when they are enabled, not
   after. Map §3.1 has the full table.

   c. **Resolve PR #142, and separately decide the promo badge's placement.** The
   map's recommendation on #142 is to **close** it -- but closing it only *keeps* the
   Formswell header; it does not move `ona_promo_tags`, which stays inside the disabled
   `group_icgrde` where the badge renders nowhere on the PDP. That is a second, separate
   action, and it is a decision rather than a chore: there is one shared
   `templates/product.json`, so lifting the block puts the badge on coffee PDPs too,
   where the live theme shows none. Map §3.2 has the three options (accept it on coffee,
   gate on suffix or product type, or leave it stranded until `product-2`/`product-3`
   get their own templates) and the exact move -- the block definition has to move
   containers, not just gain an order entry. Step 7b lists badges only as QA, so this
   will not get done unless it is decided here.

**Then, the template decision (the long pole)**

5. Walk the suffixes that still need a decision -- **not all 28.** The migration map
   removes **nine** as orphan files with zero active resources (eight product templates
   plus `page.melbourne.json`) and three more (`llms`, `maintenance`, `article`) as templates that
   exist on no theme and already fall back, so several of the 28 have nothing to open.
   For each remaining group, open one live example and one 2026 render side by side and
   record: fold into the generic template, rebuild, or re-point.

   > **"Re-point" is the one option with a live blast radius.** `templateSuffix` lives on
   > the resource, not on the theme, so changing a product's, page's or article's suffix
   > takes effect on the **currently published** theme the moment it is saved -- before
   > this theme is published at step 14 below. Prefer the theme-side option (add or rename a
   > template file here), and if resources genuinely must be re-pointed, do it **after
   > the storefront has been walked and accepted** — not during this audit, and not at
   > the moment of publishing either, because a suffix change is shop-wide and destroys
   > the rollback. **Step 14 holds the procedure**; it is the authority for this, and
   > anything here that disagrees with it is stale. Map §5 step 7 has the worked example:
   > the 43 `news`-suffix Journal articles.

   Start where the money is
   -- `filtersub` (subscriptions, and note the map's finding that it needs *less*, not
   more), then `product-2`/`product-3` (48 products: equipment, merch, candles), then
   `wholesale`, `learn`, `location`, `faq`. Map §2 lists the orphans; §3 lists the real
   decisions.
6. Fix the `location` / `page.locations` suffix mismatch -- rename the **file** to
   `page.location.json` (not the page's suffix, which is shop-wide). Update
   `docs/locations-metaobject-migration.md` in the same commit: it tells an operator to
   pick `page.locations` in the theme editor, and the rename removes that template.

**Then the surfaces, in the order you asked for**

7. **PDP** -- it has had the most work and still owns the most risk.

   a. **First, restore the content that renders nowhere.** This is implementation work,
   not QA, and nothing earlier in this order covers it. `templates/product.json` is the
   only product template, so these affect every product that has the data. Measured
   2026-10-15 across all 92 active products -- each of these renders **nowhere** on the
   2026 theme today:

   | content | metafield | populated on |
   |---|---|---|
   | brew-guide spec table | `accentuate.title_item` / `content_item` | 32 |
   | lifestyle gallery | `accentuate.image` | 37 |
   | Coffee Profile prose + 2 images | `accentuate.content_coffee_profile`, `image_coffee_profile_1`/`_2` | 37 |
   | product FAQs | `custom.accordion` | 23 |
   | origin + sourcing prose, image and specs | `content_origin`, `content_sourcing`, `image_origin`, `producer`, `region`, `varietal`, `process`, `altitude` | 25 (all eight together) |

   Plus the **`Reviews` tab**, which is enabled with no child blocks and so opens a blank
   panel on all 92 PDPs: wire a reviews integration or delete the tab. Map §5 step 5 has
   the destinations and the reasoning; wire it all **in the repo**, never on the shop
   copy. Verify on one blend, one single origin, one drip bag, one equipment and one
   merch product, and click every tab -- none may open empty.

   b. **Then the QA pass:** the disabled block group, 48 products arriving on it from
   `product-2`/`product-3`, subscriptions from `filtersub`, promo badges, Product DNA
   metaobject coverage, image quality at the sizes this theme actually renders.
8. **Menu / header** -- Shop, Subscriptions, Learn, Locations, Wholesale, Journal all have
   to land on a template that exists (see step 5, and step 6 for `location`). Mega-menu behaviour and the transparent
   header over the hero.
9. **Collections** -- card composition, badges, filters, pagination, image quality.
10. **Search** -- predictive search and the results page share the card blocks from step 9.
11. **Blog** -- `brewguides` and `news` fall back today; article layout and images.
12. **Pages** -- the groups in step 5. **This includes the third long pole: the
    `wholesale` and `barista-courses` Formswell rebuilds**, which are builds rather than
    a QA pass and are the reason this step is not cheap. Do `wholesale` first (it is the
    one with revenue attached), then `barista-courses`, then `learn` and the rest of the
    groups, which fold onto Horizon generics.
13. **Cart** -- drawer and page. 4.3.0 fixes several cart bugs, but the bump stays at
    step 15, after go-live: section 3 measured 26 real conflicts across 8 files, and
    pulling it forward is exactly the night-before version change this document warns
    against. Fix any cart bug found here directly, and re-check cart after the bump.

14. **Publish — the cutover.** Swap `ona_theme2026` in for theme `160335790271`. This
    document had no publish step at all until now, which left the one irreversible
    action in the project undefined. Do it in this order: re-read the §4.3 checksum test
    so no shop-owned template is mid-divergence, publish, then walk the storefront.
    Keep the previous theme **unpublished rather than deleted**: republishing it is the
    rollback.

    > **Reassigning resource suffixes destroys that rollback, so do it last or not at
    > all.** `templateSuffix` is shop-wide, so once the suffixes are changed,
    > republishing the old theme makes it look for templates matching the *new*
    > suffixes — which it does not ship — and if the superseded legacy templates have
    > also been deleted, there is nothing to go back to. The two halves of this step are
    > therefore in tension, and the resolution is order plus evidence:
    >
    > 1. Prefer **not reassigning at all.** Every fold in this plan can be done
    >    theme-side with a wrapper template (step 6's note, map §5 step 7), which leaves
    >    the rollback intact permanently. This is the default.
    > 2. If resources genuinely must be re-pointed, do it **after the storefront has
    >    been walked and accepted**, not at the moment of publishing — and first write
    >    down the **reverse mapping** (resource → its current suffix) so the change can
    >    be undone, and leave the legacy templates in place until it is accepted.
    > 3. Delete the superseded legacy templates **last of all**, once no rollback is
    >    wanted.
    >
    > A rollback that has silently stopped working is worse than no rollback, because it
    > is relied on. (Codex, PR #150.)

**After go-live**

15. Bump to Horizon 4.3.0 (section 3).
16. Ship the WFG counter job in `ona-data-platform` so the number stops being written by
    hand, and re-check its storefront contract against this theme's markup.

---

## 5. On "go live tomorrow"

Step 2 — the campaign — is done, and it did not wait on the rest, which was right: the
badges expire 2026-10-31.

**There are three long poles, not one, and all three are pre-publish.** Map §5 keeps the
canonical list — this summary had drifted from it twice, so take the map as the authority
and treat anything here that disagrees as stale.

**Step 5, the suffix decisions** — the step that decides whether the site looks right the
morning after. The decisions are **per suffix group, not per resource**: four product
groups (`product-2`, `product-3`, `Default product`, `filtersub`) covering 56 products,
and the page groups in map §3.4, where `llms` and `maintenance` need nothing at all. Read
the migration map before starting it; it takes nine orphan files and three
already-falling-back suffixes off the list.

**Step 7a, the PDP content restoration** — and this one is *implementation*, not
decisions, which makes it harder to compress. Measured 2026-10-15: content renders nowhere
on 23–37 products per surface, **every image surface among them has no renderer at all**
— `accentuate.image` (37), `image_origin` (25) and `image_coffee_profile_1`/`_2` (37), so
four image metafields needing new code — the FAQ section needs re-enabling, the disabled
`brew_guide` block cannot be reused as-is (map §5 step 5 has its three faults), and the
`Reviews` tab opens a blank panel on all 92 PDPs. Step 4a — the Maple copy on the one shared product template —
is the same kind of work and is live-visible on every product. None of this is covered by
step 5, and a summary that names only step 5 invites treating the suffix audit as the last
blocker. It is not.

**`wholesale` and `barista-courses`, the two Formswell page rebuilds** (step 12) — builds,
not a QA pass, and the only two pages the fold-don't-port strategy does not absorb. This
summary omitted them while the map counted them, which is precisely how a three-workstream
project gets scheduled as a two-workstream one. (Codex, PR #150, twice.)

The honest shape of it has changed since this was written, and half the question is now
answered. **For products it is confirmed: `templates/product.json` is the only product
template, and all 92 active products already render it** -- so the folding is not a
proposal, it is the current state. What that revealed is the problem: the one shared
template carries four blocks of Maple-specific copy (step 4a) and leaves five content
surfaces rendering nowhere (step 7a). So the risk was never "will they fold" but "what
does the thing they fold onto actually say", and the answer needs work before publishing.

For **pages** the original question still stands: the groups in map §3.4 have not been
confirmed, and tomorrow could still publish content pages on a layout they were never
designed for.

Confirming that, for one example per suffix, is the cheapest way to find out. It is maybe
three hours of looking.
