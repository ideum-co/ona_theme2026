# The legacy `ona-*` sections ship without their CSS

Found while checking image stability on `/pages/wholesale`, 2026-10-20.

This is the real reason those pages do not look like the live site. It is not a
missing design — it is missing stylesheets.

---

## 1. The measurement

`/pages/wholesale`, all images loaded (the page was scrolled end to end first,
so lazy loading is not a factor — 43 images in `<main>`, 43 loaded, 0 missing):

| theme | visible images | upscaled >1.3x |
|---|---|---|
| live `160815546559` | 42 | **0** |
| theme2026 `154676789439` | 43 | **17** |

Worst offenders, all in the same section:

```
10.2x   nat 100x150  -> 1016x1526   [icon_and_content]
 7.5x   nat 136x150  -> 1016x1122   [icon_and_content]
 6.8x   nat 150x150  -> 1016x1016   [icon_and_content]
 6.8x   nat 150x150  -> 1016x1016   [icon_and_content]
 5.2x   nat 195x150  -> 1016x782    [icon_and_content]
 3.2x   nat 150x150  ->  480x480    [wholesale_brands]
```

A 100x150 icon painted at 1016x1526. It renders as mud.

**This is a regression.** Live renders the same sections, from the same image
sources, with zero upscaling.

Layout shift is *not* the problem — CLS on that page measures **0.0051**, which
is excellent. Nothing jumps. It is simply blurry.

## 2. The cause

`sections/ona-icon-and-content.liquid:14` is the whole story:

```liquid
<img src="{{ block.settings.icon | img_url: '400x' }}" ... class="wowo animate__heartBeat">
```

Two things compound:

1. `img_url: '400x'` asks for 400px wide. Shopify **does not upscale**, so a
   100px source comes back at 100px.
2. Nothing constrained the element. The markup targets `.col-4-icons`,
   `.icon-c` and `.icon-box-anchor`, and at the time of this measurement none
   of those selectors existed anywhere in the theme, so with no width rule the
   `<img>` filled its container: 1016px. **Past tense since #204** —
   `assets/legacy-page-layout.css` now defines the `.col-4-icons` grid and caps
   the icon at 120x88. This paragraph is the diagnosis of what was wrong, not a
   description of the current checkout. (Codex, #203.)

## 3. It is not one section

**Thirty of the theme's 46 legacy `ona-*` sections carry no scoped CSS of
their own** — no `{% stylesheet %}` and no `{% style %}`. It was forty when
this was written on 2026-10-20; ten have been scoped since, among them
`ona-awards`, `ona-cafe-testimonial`, `ona-faq-lists`, `ona-icon-and-content`,
`ona-supported` and `ona-wholesale-testimonial`, all of which this document
originally listed. `tests/legacy-sections-scoped-css.test.mjs` now derives the
count, so the next one to be scoped moves this sentence instead of stranding
it (Codex, #203). They are not bare, though: every one of
them draws on the shared `assets/legacy-page-layout.css`, which
`layout/theme.liquid` loads for the migrated page suffixes. An earlier draft of
this document said they had "no matching rules in `assets/`" — that was wrong
(Codex, PR #203), and it pointed the fix in a direction that would have
duplicated or fought the shared sheet.

What is true is that the coverage is **partial**. **85** distinct selectors
used by these sections have no rule in that stylesheet — recounted against the
current sheet after #204 and #209 shipped, which took it down from the 95 an
earlier draft reported by covering `.block`, `.slider-block` and `.bg-img`
(Codex, #203). Rerun the count rather than trusting this number after the next
fix lands.

Of the 85, the ones that still cost layout are `.section-full-large`
(16 uses), `.match-height` / `.equal-height` (12 / 11) and the `.start` /
`.medium` / `.end` trio (14 each). `.more-btn` (14) was on this list and is
now covered by `assets/legacy-page-layout.css` (Codex, #203) — another reason
to rerun the count rather than work from it. The largest by raw count are
animation hooks — `.fadeInUp` at 63, `.fadeIn` and `.fadeInup` at 16 each — and
those are inert in this theme, so they need deleting rather than styling. So
the work is to finish the shared sheet selector by selector, not to write thirty
new ones:

```
ona-bookings-top                ona-bread-crumbs                ona-brewguides-and-training
ona-careers                     ona-content                     ona-exclusive-access
ona-expericences-content        ona-gust-r                      ona-inner-banner
ona-our-philosophy              ona-sourcing                    ona-sustainability-list
ona-sustatnability              ona-training-banner             ona-training-form
ona-training-iframe             ona-training-image-text         ona-training-text-image-bg
ona-training-text-two-images    ona-traning-sourcing            ona-traning-sourcing-v2
ona-traning-sourcing-v3         ona-traning-sourcing-v4         ona-unique-coffees
ona-wholesale-partnership       ona-wholesale-sourcing-v2       ona-wholesale-sourcing-v3
ona-wholesale-sourcing-v4       ona-wholesale-sourcing-v5       ona-wholesale-sourcing-v6
```

They were ported as markup and their stylesheets were left behind. The pages
render — every section is present, the type is on-scale, there is no overflow —
which is exactly why a structural audit calls them clean. They are unstyled, not
broken.

This is the same trap that bit the FAQ port and the brew-guides template: legacy
markup whose CSS never came across.

## 4. Why "there is no design to work from" was the wrong framing

Said earlier in the session, and worth correcting. These pages do not need a
design comp. The design already exists — as CSS on the live theme. The work is
to re-express it in this theme, not to invent it.

## 5. Scope

Measured per page, images in `<main>`, after a full scroll:

| page | images | upscaled | srcset |
|---|---|---|---|
| `/pages/wholesale` | 43 | **17** | 0 of 43 |
| `/pages/about` | 7 | 0 | 0 of 7 |
| `/pages/barista-courses` | 5 | 0 | 0 of 5 |
| `/pages/private-courses-and-experiences` | 1 | 0 | 0 of 1 |
| `/pages/learn` | 0 | — | — |
| `/blogs/brewguides` | 50 | 0 | **50 of 50** |

Two things fall out:

- **Wholesale is the acute case.** The others use the same unstyled sections but
  happen not to stretch anything badly.
- **Brew guides is already right**, because it uses Horizon's native
  `main-blog` + `_blog-post-card` rather than a ported `ona-*` section. That is
  the template for what "fixed" looks like.

## 6. Proposed order

1. ~~**Stop the stretching.** Constrain the icon in `ona-icon-and-content`.~~
   **Shipped in #204.** `assets/legacy-page-layout.css` defines the
   `.col-4-icons` grid and caps the icon at 120x88, with
   `tests/legacy-image-sizing.test.mjs` holding it; the section measured
   6,491px -> 230px. The measurements above this line describe the pre-fix tree
   and are kept as the record of what was wrong, not as work to do. **Remeasure
   before picking up item 2.** (Codex, #203.)
2. **Extend `assets/legacy-page-layout.css` to the remaining uncovered
   selectors** (85 at the last count, and recount before starting),
   rebuilt on the theme's own tokens rather than copied from the legacy sheet —
   the legacy CSS depends on a cascade this theme does not have. Extend the
   shared sheet rather than adding scoped `{% stylesheet %}` blocks: the sheet is
   already loaded for these page suffixes and already styles the other selectors
   these same sections use, so a per-section block would fight it.
3. **Move images onto `image_tag`** so they get `srcset` and intrinsic
   dimensions. None of the five legacy page templates measured here emits a
   single `srcset` — they all use raw `<img src="{{ ... | img_url }}">`. This is
   a property of those templates, not of the theme: `sections/hero.liquid`,
   `locations-flagships.liquid`, `product-dna.liquid` and the shared image
   snippets already go through `image_tag`. (Scope corrected after Codex, #203.)
4. Retire `wowo` / `animate__heartBeat`. The classes are on every one of these
   sections and the library behind them is not in this theme, so they are inert
   markup.

Wholesale first: it is the largest commercial page, has the worst damage, and is
nowhere near Victor's home-page work.
