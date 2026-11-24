# For Victor — 2026-11-23 (after the sale, not during)

Four things about the Black Friday landing cards. Three are fixed and waiting on
`staging-v2`; none of them should go to `main` until the sale is over, because
`main` is the live theme and the sale runs 21–27 November.

Felipe's call: **do not take the risk mid-sale.** Everything below is written so
it can be picked up cold on the 28th.

The first section is a trap rather than a task. Please read it before touching
`templates/page.bfcm.json`, because the obvious move is the destructive one.

---

## 0. Do NOT merge `staging-v2`'s `templates/page.bfcm.json` into `main`

The live copy of that file and the repo copy have diverged, and the repo copy is
**not** the authority. Measured 23 Nov:

| | auto-generated banner | section settings | `products_columns` |
| --- | --- | --- | --- |
| live theme (`ona_theme2026/main`, `154676789439`) | **yes** | ~50 — all the real content | **3** |
| `main`, in the repo | no | **0** | absent → schema default 4 |
| `staging-v2`, in the repo | no | 49 | absent |

The live file carries the title, `date_line`, the countdown start/end, all six
category links, every FAQ answer and the subscriber consent line. **`main`'s repo
copy carries none of it** — it renders correctly only because the section schema
supplies defaults for almost everything.

So a plain `staging-v2` → `main` merge of that file overwrites the live template
with a copy that is missing `products_columns: 3` and that carries a *different*
`signup_legal` wording. The consent line is not ours to change, and Felipe has
said so explicitly.

The live file also has the auto-generated banner, which means the theme editor
has taken ownership of it. `docs/deploy-verification.md` §0 is the general form
of this ("the theme editor writes to the same files from the other side, so a
push can also *remove* work nobody in git knows about"). This is a live instance
of it.

**How to promote item 1 safely:** read the live file from the Admin API, change
only the four padding values in it, and push that — do not ship the repo's
version of the file. Keep `products_columns` and `signup_legal` exactly as the
live file has them unless item 2 is decided otherwise.

```
{ theme(id: "gid://shopify/OnlineStoreTheme/154676789439") {
    files(first: 1, filenames: ["templates/page.bfcm.json"]) {
      nodes { filename updatedAt body { ... on OnlineStoreThemeFileBodyText { content } } } } } }
```

---

## What is actually worth doing — and what is not

Added 24 Nov. The four items below are ordered by how they were found, not by
how much they matter, and the wider backlog has the same problem. So here is the
ranking, with the reasoning, so this can be triaged rather than worked through
top to bottom.

**One measurement reframes most of it: real users already pass Core Web Vitals
on both mobile and desktop.** That is CrUX field data at the 75th percentile.
The mobile Lighthouse 68 is a throttled lab simulation of a page that real
people are not struggling with. Almost every "performance" item on this list
therefore buys a number, not an experience.

### Worth doing

1. **The mobile video rendition.** 12.1 MB of a 17 MB page is three videos; the
   hero alone is 9.6 MB with exactly one 1080p / 3.3 Mbps rendition, so no theme
   change can pick a lighter file — it needs a new asset. This is the only item
   that changes what someone on cellular actually experiences, and the only one
   that moves mobile 68 → ~93. Everything else in the performance bucket is
   rounding error beside it. Server response is 28 ms, so this is payload, not
   hosting.

2. **Migrating the six Custom CSS rules into the repo** (item 3 below). The
   reason is not the badge jump; it is that those rules are invisible to every
   repo grep, and that nearly cost us. In #491 the obvious `h5` → `span` fix
   would have turned the badge text red on every product card — caught only by
   measuring the live DOM first. That landmine stays armed for whoever next
   touches card markup.

3. **Reconciling `templates/page.bfcm.json` between live and repo** (§0). Same
   category. The trap was found before it fired; the next person works from the
   repo, sees a valid-looking template, merges, and silently deletes the
   countdown dates and the FAQ. Worth closing rather than documenting around
   forever.

4. **The wrong data that is customer-facing right now.** The stale banner
   subtitle, the `Origin.Centeral America` tag typo, Finca Idolia's wrong
   `accentuate.tastes_like`, La Huerta's `custom.region`. Minutes of work each,
   and each currently shows something false to a customer. Best
   value-per-effort on the list.

5. **The five red tests on `staging-v2`** (see the test-suite note at the end).
   Unglamorous, but every future PR's gate depends on it. "CI is red" currently
   carries no information, which means it gets waved through — and that is how a
   real regression ships.

### Worth shipping only because it is already built

Items 1 and 2 below — the gallery padding and the column override. Real,
visible, and reported, but cosmetic. They are done and tested, so ship them;
they would not have been worth scheduling ahead of the five above.

### Where this hand-off argues against its own work

**#492, the render-blocking CSS inlining, was marginal and was oversold.** It
was described in the PR as the best remaining win available without waiting on
anyone. That was wrong: those files load in parallel, so removing two of three
shortens the critical path by roughly one round-trip rather than the ~960 ms the
per-file figures suggest, and real users already pass CWV. It is harmless, and
the test documents a genuine shadow-DOM stylesheet trap, but it was not worth
prioritising.

### Not worth the time

- **Chasing the mobile Lighthouse score itself.** Until the video lands the
  number will not move; once it lands the rest is noise.
- **The `find-ona-1.webp` alt field** "to take SEO 92 → 100". Add the alt text
  because it is right for screen readers, not for the score. The score is
  lab-only.
- **The 297 KB badge SVG.** An absurd size for a badge, but it is one cached
  asset.
- **The ~150 stale remote branches, the old PRs, the obsolete preview theme.**
  Tidiness with no user impact. Only worth it if it is actively confusing
  someone.
- **The `inert` slideshow refactor.** Ten lab failures overstates it. It needs an
  IntersectionObserver rewrite, because swipe never updates `aria-hidden` and
  `visibleSlidesAmount` can exceed 1 — so tying `inert` to either would leave
  *visible* slides non-interactive. Real value for keyboard users, but the most
  effort for the least visible return here. The cheap twin is better: the PDP
  media gallery and `zoom-dialog.js` almost certainly carry the same
  `aria-selected` defect #490 just fixed, which is a near-copy of a merged
  change.
- **The console 400s and the 404.** Worth one look to confirm they are
  third-party app noise. If they are, leave them.

Items 1–5 are roughly a day of work and cover everything that touches a customer
or protects the codebase. The rest is most of the backlog and close to none of
the value.

---

## 1. The landing cards don't line up with the collection cards — one value

Ready on `staging-v2` as **#494**. Verified on the staging theme.

The promo chip sits **30px above** the product image on the landing, against
**10px** on a collection card. That offset is the misalignment.

The cause is that the chip's position comes from the shop-owned Custom CSS in
`config/settings_data.json`, not from this repo:

```css
.product-card .ona-pdp-tags .custom_product_tags { position: absolute; top: 10px; left: 10px; }
```

Its offset parent is the **card**, not the image. So the gallery block's padding
*is* the distance between the chip and the image it is meant to sit on:

| | gallery padding | card top | image top | chip vs image |
| --- | --- | --- | --- | --- |
| `/collections/black-friday` | 20 | 468 | 488 | **−10px** |
| `/pages/black-friday` (live) | 40 | 1578 | 1618 | **−30px** |

#489 hand-replicated the collection's product card into `page.bfcm.json` rather
than reusing its config, and the copy's gallery shipped at 40.

The target value is confirmed twice over: `templates/collection.json` sets the
gallery padding to `20` explicitly, and the live collection card computes to
`20px`.

After the fix, measured on the staging theme: gallery `20px`, card→image gap
`20px`, image 295px wide against the collection's 283px.

**Side effect worth your eye:** halving the padding gives the image 40px more
width inside the same card. That is inherent to matching the collection card,
and it is what #489 was aiming at, but it is a visible change.

`tests/bfcm-landing-card-matches-collection.test.mjs` derives its expectation
from `collection.json` rather than hard-coding `20`, so changing the collection
card moves the test with it instead of leaving a stale literal behind.

---

## 2. The column override on live — a decision, not a bug

The live landing renders **3** columns; the repo has no `products_columns` at
all, so the repo value is the schema default of **4**. The `3` exists only on the
live theme, set in the theme editor after #489 merged (live file `updatedAt`
21 Nov 13:18, #489 merged 08:17).

It reads as a workaround for item 1. At 40px padding, 4 columns left a 255px
image; dropping to 3 got it back to 377px. Once the padding is 20, **4 columns
gives 295px against the collection's 283px** — the images are the right size
again without the override.

Both measured at a 1536px viewport, same page, the two themes previewed side by
side.

So: if the goal is cards that match the collection, item 1 lands and the
override comes off. If you would rather keep 3 columns as a deliberate choice,
keep it — but then the landing stays visibly different from every collection
page, which is the thing that was reported. Either way it is a one-value change;
just make it on the live file per §0, not by shipping the repo's copy.

---

## 3. The chip jumps on first render — site-wide, not a landing bug

Worth knowing this is **not** specific to the landing. The collection pages do
it too.

The chip is two elements. The wrapper `.product_single_custom_tag_black` is
`position: static` with **height 0**, sitting in normal flow *below* the image.
The inner `.custom_product_tags` is lifted to the card's top-left by the
`position: absolute; top: 10px` rule above. Measured on live:

| | wrapper in flow at | image bottom | chip after CSS applies |
| --- | --- | --- | --- |
| landing | 2039 | 1995 | 1588 |
| collection | 795 | 771 | 478 |

Because that rule lives in `settings_data.json`, it is applied *after* first
paint. Until then the chip renders where the flow puts it — below the image —
and then snaps up. That is exactly what Felipe reported seeing.

**The fix is to migrate the six `platform_customizations.custom_css` rules into
the repo's stylesheets.** Then the chip is positioned in blocking CSS, there is
no jump anywhere on the site, the rules become reviewable and testable, and two
other things follow for free:

- the badge can go back to being a `<span>` instead of an `<h5>`, and the
  `role="presentation"` added in #491 can be removed — see
  `snippets/ona-product-tags.liquid` and the note in
  `tests/ona-product-tags-not-a-heading.test.mjs`
- the other three rules (hiding `.purchase-options`, width-capping product
  recommendations, centring `slideshow-container`) stop being invisible to
  everyone reading the repo

Read them from the live theme before you start; a repo grep for
`custom_product_tags` returns two Liquid files and misses all of this.

---

## 4. Buy buttons sat at different heights within a row — FIXED on live

**Done.** Victor shipped this in #496, merged to `main` 23 Nov 14:14. The
explanation this section originally gave was wrong in a way worth recording,
because it would have sent the next person to the wrong fix.

What was measured on the live landing, second row, before the fix:

```
btnTop:   2903 / 2961 / 2929     (58px spread)
priceTop: 2824 / 2883 / 2851
```

**The wrong diagnosis** (what this doc first said): that the card's buy group
has no `margin-top: auto`, that a fix would have to be invented, and that
collection pages carried the same latent defect and only looked clean because
their 4-column grouping happened to pair products of equal content height.

**What was actually true:** the theme already had a complete equal-height system
in `snippets/product-card-styles.liquid` — `height: 100%` on `.product-card`
and `.product-card__content`, `min-block-size: 2lh` on the title, `1lh`/`2lh`
on the metafield lines, `block-size: 64px` on the variant placeholder, and
`margin-block-start: auto` on the price so it absorbs the free space above and
price → variant → buttons drop to the bottom together.

Every one of those rules was scoped to
`:is(.product-grid__item, .resource-list__item)`. #489 introduced a **new
wrapper class**, `.bfcm-landing__grid-item`, which was never added to those
lists — so the landing grid received none of the system. Collection pages were
never affected; they had the rules the whole time.

The fix adds `.bfcm-landing__grid-item` to all seven selector lists. It reuses
the existing mechanism rather than bolting a parallel one onto the card, which
is why it is nine lines and carries no risk to the other surfaces.

Verified on live 24 Nov: every row's buttons now share an identical top
(2249 / 3049 / 3849 at a 1536px viewport), all eight cards are 770px, and the
collection grid is unchanged and still aligned (two rows, 630px and 658px, zero
spread).

**The reusable lesson:** those seven selector lists in
`snippets/product-card-styles.liquid` are the theme's equal-height contract.
Any new surface that renders `_product-card` inside its own grid wrapper has to
be added to them, or its cards will silently lose equal heights and
bottom-anchored buttons while every other grid keeps them. Worth checking
whenever a new grid wrapper class appears.

---

## Found in the 24 Nov review of the live landing and countdown

### 5. The sale grid and the "Shop sale" button point at the whole catalogue

**This is the one worth acting on soonest, and it is a single theme-editor
field with no deploy.**

The section resolves its collection like this:

```liquid
assign sale_collection = s.products_collection
if sale_collection == blank
  assign sale_collection = collections['all']
endif
assign shop_url = sale_collection.url | default: '/collections/all'
```

`products_collection` is **empty on the live theme**, so both the "On sale now"
grid and the primary button fall through to `collections['all']` — the entire
catalogue, 230 products, merch and brew gear included — rather than the sale
collection, which has 19.

Two consequences:

- **The grid is luck, not selection.** It takes the first 8 available products
  of `collections['all']`. Today all 8 happen to be sale products, but position
  8 in that collection's order is a **non-discounted merch item** and position 9
  another non-sale product; they are absent from the page only because they are
  not currently available on the storefront. A stock or publish change puts a
  full-price product on the Black Friday page, in a card whose promo badge will
  not render.
- **The primary CTA does not go to the sale.** During the sale the button reads
  "Shop sale" and links to all 230 products instead of the 19 on offer.

Setting the section's **Sale collection** field to the Black Friday collection
in the theme editor fixes both at once, is reversible instantly, and touches no
code. It is the only item in this document that is safe to do mid-sale.

**Also fix the schema `info` string while you are there.** It claims the setting
"Defaults to all coffee until set", but the fallback is `collections['all']`,
which is every product including merch and brew gear — not all coffee. The
string tells whoever reads it in the editor that the default is narrower and
safer than it is, which is how this went unnoticed.

### 6. The homepage banner subtitle is pre-launch copy

The banner's status line and CTA *are* phase-aware and currently correct
("BLACK FRIDAY IS ON", "SHOP NOW — ENDS FRIDAY 27 NOVEMBER"). The subtitle
underneath is a static string still reading "…starting Saturday 21 November",
written before launch and never updated. Not false, but it frames a sale that is
more than halfway through as something upcoming. One editor field.

### The countdown itself reviewed clean

Checked against an independently computed target. On live at 01:39 UTC on
24 Nov: phase `live`, status "Ends in", clock showing **03d 11h 20m 37s**
against a computed 3d 11h 21m to `2026-11-28T00:00:00+11:00`. Correct.

The component is well built and the review found nothing to change in it:

- it **requires an explicit UTC offset** on both dates
  (`/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/`) and
  bails otherwise, which is what stops the classic "parsed as the visitor's
  local midnight" bug
- the clock is `hidden` by default with the static date line as its fallback, so
  a bail-out degrades to the date rather than to a frozen `00:00:00:00`
- `role="timer"` with `aria-live="off"` is the right choice; a polite live region
  on a per-second clock would announce continuously
- it clears its interval once the end passes, and `data-text-ended` is wired, so
  the ended state has copy to show

**One caveat worth knowing.** The status text is server-rendered as
`label_before` ("Starts in") on every request, and only corrected once the
module runs. So between parse and hydration, and permanently if the script fails
or is blocked, a live sale reads "Starts in" above the static date line. Liquid
can compare `'now' | date: '%s'` against the two settings and render the correct
initial label, which would remove both the flash and the no-JS wrong state. Low
severity, not urgent, but it is the same family as the badge jump in item 3:
correct state arriving after first paint.

### Mobile, computed rather than measured

The browser extension refused to resize the window below ~50% of the screen, so
mobile layout could not be measured directly in this session. From the
breakpoints in `sections/bfcm-landing.liquid` the grid goes to 2 columns at
749px and stays there, so at a 390px viewport each card is roughly 171px wide.
With the gallery padding still at 40 that leaves a **~91px product image**; at
20 it is ~131px. Treat those two numbers as arithmetic from the CSS, not
observations — but they say the padding fix in item 1 matters more on a phone
than on the desktop screenshots it was diagnosed from. Worth measuring properly
on a real device before and after.

---

## Also ready on `staging-v2`

**#492 — the two small head stylesheets are inlined rather than linked.**
`app-stacking.css` and `home-mobile-overflow.css` were separate blocking
`<link>`s; Lighthouse on mobile attributed ~480 ms to each, against 1,090 ms for
the whole render-blocking set. At ~1.5 KB apiece the cost is the round-trip, not
the bytes.

Real HTML cost is **~1.4 KB**, not the ~3 KB the PR text estimates:
`inline_asset_content` strips comments, and `app-stacking.css` is 1,695 bytes of
which only 41 are CSS. Verified on the staging theme — the rule applies, and
`home-mobile-overflow` is present on the homepage and absent on collection
pages, so the index-only gate still holds.

`overflow-list.css` is the third file in that Lighthouse group and is
deliberately left linked: it is emitted inside each
`<template shadowrootmode="open">` in `snippets/overflow-list.liquid`, which
renders once per overflow list (variant swatches, filters, header menu), so
inlining would repeat it per instance instead of fetching it once. The test pins
that as intentional.

**#493 — `main` → `staging-v2` sync.** `staging-v2` had drifted 4 commits behind
(#488, #489, #490, #491 — all of the BFCM work) while carrying 150 of its own,
so the card tree being fixed did not exist on the review surface. `main` is now
an ancestor of `staging-v2`, which means the next sync is a clean merge rather
than the same two conflicts again. Please keep §4 step 5 of
`docs/branching-and-release.md` going after the sale.

---

## One limitation of the review surface

**`staging-v2` cannot verify anything about the chip.** `settings_data.json` is
per-theme and the staging theme's copy has none of the six Custom CSS rules.
Measured there: the chip is `position: static`, background `rgba(0,0,0,0)`, text
`rgb(71,10,18)` — against `absolute` / `#b57c1d` / cream on live.

Card geometry does review correctly on staging (padding, gaps, column counts all
measure true), which is why item 1 could be verified there. The chip's position
after item 1 is arithmetic from that verified 20px gap — chip at card-top + 10,
image at card-top + 20, so 10px above the image, same as the collection — but
nobody has watched it render.

To see the chip, preview the live theme with `?preview_theme_id=154676789439`.
Be aware the preview cookie then sticks to the domain and quietly contaminates
later measurements until you preview a different theme; that caught me out once
in this session.

---

## Test suite note

`staging-v2` is not green, and was not before any of this. Five failures remain,
all homepage figures that drifted when the theme editor added sections:
`index.json` editor-made sections, the Horizon block usage counts, the homepage
section count and its headroom, and the derived-figures guard. They are real
drift and worth a pass of their own; they are unrelated to the landing page, so
they were left alone rather than folded in here.

The practical consequence is that **the merge gate on `staging-v2` is "no new
failures", not "CI green"** — please check the failing test names against this
list rather than waving a red check through.

#493 did fix one of them: the custom `type_preset` count. `main` claimed 83
(76 block / 7 section), `staging-v2` claimed 80 (73 / 7), and the merged template
set actually holds **82 (75 / 7)**. Recomputed and corrected rather than taking
either side's number.
