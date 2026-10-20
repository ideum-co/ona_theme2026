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
2. Nothing constrains the element. The markup targets `.col-4-icons`, `.icon-c`
   and `.icon-box-anchor` — and **none of those selectors exist anywhere in this
   theme**. With no width rule, the `<img>` fills its container: 1016px.

## 3. It is not one section

**Twenty-plus legacy `ona-*` sections carry no CSS at all** — no
`{% stylesheet %}`, no `{% style %}`, and no matching rules in `assets/`:

```
ona-awards            ona-bookings-top       ona-bread-crumbs
ona-brewguides-and-training                  ona-cafe-testimonial
ona-careers           ona-content            ona-exclusive-access
ona-expericences-content                     ona-expressions
ona-faq-lists         ona-gust-r             ona-icon-and-content
ona-inner-banner      ona-our-philosophy     ona-sourcing
ona-supported         ona-sustainability-list
ona-sustatnability    ona-training-banner    ...
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

1. **Stop the stretching.** Constrain the icon in
   `ona-icon-and-content.liquid` with a scoped `{% stylesheet %}`, and request a
   width that matches how it is drawn. Smallest change, kills the worst 5.
2. **Give each legacy section a scoped `{% stylesheet %}`**, section by section,
   rebuilt on the theme's own tokens rather than copied from the legacy sheet —
   the legacy CSS depends on a cascade this theme does not have.
3. **Move images onto `image_tag`** so they get `srcset` and intrinsic
   dimensions. Nothing outside `/blogs` has a single `srcset` today.
4. Retire `wowo` / `animate__heartBeat`. The classes are on every one of these
   sections and the library behind them is not in this theme, so they are inert
   markup.

Wholesale first: it is the largest commercial page, has the worst damage, and is
nowhere near Victor's home-page work.
