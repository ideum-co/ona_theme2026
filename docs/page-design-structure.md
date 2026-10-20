# Page and landing design structure

How every `/pages/*` template gets rebuilt, in stages, and what each stage is
allowed to change. Written 2026-10-20, after auditing all 24 published pages on
the live theme (`ona_theme2026/main`, id 154676789439, Horizon 4.1.4).

The brief: pages are reviewed and aligned with the new design **in stages**, and
by the last stage they are rich in formatting and properly designed. Horizon is
the default — we only depart from it where departing is better UI/UX *and*
preserves the intended design.

## The four sources, and what each one is allowed to decide

| Source | Decides | Does not decide |
| --- | --- | --- |
| **Horizon 4.1.4** | layout mechanics: page width, gutters, breakpoints, section/block model, spacing scale | brand voice, imagery, editorial rhythm |
| **Formswell XD** | the intended design: composition, hierarchy, component inventory, colour roles | how it is implemented |
| **Old ONA theme** (147508887743, Debut 17.13.0) | content inventory and intent — what a page is *for*, which blocks it had | layout mechanics; it predates the design system |
| **Onyx Coffee Lab** | reference for editorial richness — the target standard, not a thing to copy | anything ONA-specific |

Precedence when they disagree: the XD decides *what*, Horizon decides *how*, the
old theme decides *what must not be lost*, Onyx is inspiration only.

## Measured signals

Everything below was measured, not assumed.

### Horizon (`assets/base.css`, `snippets/theme-styles-variables.liquid`)

- `--page-margin`: **16px**, **40px** from 750px up.
- Breakpoints: **749/750** and **989/990**. There are no others in this theme.
- Width tokens: `--narrow-page-width` 90rem (1440px), `--normal-page-width`
  120rem (1920px), `--wide-page-width` 150rem (2400px),
  `--normal-content-width` 42rem (672px).
- Prose measures: `--max-width--body-normal` 32.5em,
  `--max-width--body-narrow` 22.75em.
- Sections are a grid, not `max-width: X; margin: auto` — see the comment in
  base.css. Full-bleed backgrounds with constrained content come free.

### Onyx Coffee Lab (measured live, Shopify, 1546px viewport)

- Body **Montserrat 16px**; display **Bajern 68px/68px** — line-height 1.0 on
  large headings; secondary **Room-205 40px, uppercase, 2px tracking**.
- Buttons: **`border-radius: 0`**, 22px/18px padding, 1px tracking.
- Containers run near-full-bleed (1530 of 1546).
- Hero is one full-viewport image with very little chrome over it.

Transferable: square corners, display type set tight, uppercase wide-tracked
secondary headings, generous button padding, full-bleed hero. Not transferable:
the palette, the script wordmark, the dark-first treatment.

### Formswell XD

- Product page: <https://xd.adobe.com/view/919bd9af-00b8-4592-979e-6e220bdfee4e-c4c8/>
  (three concepts — click the ONA logo top-left to cycle)
- Homepage: <https://xd.adobe.com/view/1d6791a5-7387-49ad-8fb3-34c22e30efd1-4834/>

Both render to a **WebGL canvas**: there is no DOM, so fonts, spacing and colours
cannot be read out of them and pixel-scraping is blocked. Measurement is
screenshot-against-live, where the live side is measured precisely in the DOM.
An XD *Share for Development* link would give real spec data; we do not have one.

Observed in product-page V1: full-bleed per-product background colour, left rail
of three stacked taste-note thumbnails, centred bag, and a right column of two
pill badges, serif title, tasting-note line, price, review stars, two variant
cards, full-width add-to-cart.

### Old ONA theme

Photos clipped to organic blob shapes with an offset mustard blob behind;
accordion rows as hairline rules with `+` indicators; uppercase wide-tracked
eyebrow labels; a condensed face on accordion titles.

## The stages

Each stage is shippable on its own. A page can be at a different stage from its
neighbours — that is the point.

### Stage 1 — structure and alignment

Make the page correct and consistent with Horizon's mechanics. No visual
redesign; nothing moves that was not already misplaced.

- Every page suffix has a template (guarded by
  `tests/page-template-coverage.test.mjs`).
- Legacy sections sit on Horizon's gutters and breakpoints, and share one
  measure (guarded by `tests/legacy-horizon-page-width.test.mjs`).
- The shared stylesheet reaches every template that needs it (guarded by
  `tests/legacy-stylesheet-gate.test.mjs`).
- No duplicated content, no dead embeds, no content lost against the old theme.

### Stage 2 — components

Replace legacy section internals with Horizon blocks wherever the swap is
invisible to a reader. The test is whether a merchant can edit it in the theme
editor afterwards; a ported `ona-*` section usually fails that, a Horizon
`section`/`group`/`text` tree passes.

Precedent: `sections/ona-faq-layout.liquid` and
`sections/ona-page-media-gallery.liquid` are Horizon-native and style themselves,
so they need no shared sheet at all. That is the target shape.

### Stage 3 — richness

The design work: XD composition, the blob masks, eyebrow treatment, accordion
indicators, section colour inversions, imagery rhythm. Measured against the XD
screenshot-by-screenshot. Nothing here starts before stage 2 on that page.

## Page inventory

Content measured inside `<main>` on the live theme, 2026-10-20. "Old" is the
pre-Horizon theme where a comparison exists.

### Landing and marketing pages — the ones that carry the brand

| Page | Suffix | Now | Stage |
| --- | --- | --- | --- |
| `/pages/wholesale` | `wholesale` | 12,822 chars, 43 images, 19 sections | 1 done → 2 |
| `/pages/barista-courses` | `training` | 4,412 chars, 8 images, 10 sections | 1 done → 2 |
| `/pages/about` | `about` | 2,404 chars, 7 images, 7 sections | 1 done → 2 |
| `/pages/locations` | `location` | 45,873 chars, 20 images — but 1.35 MB of `<main>` | 1, needs a perf pass |
| `/pages/learn` | `learn` | 2 tiles, 612px each | 1 done → 2 |
| `/pages/private-courses-and-experiences` | `private-courses-and-experiences` | 852 chars, 1 image | thin, needs content |
| `/pages/womenincoffee` | `sustainability` | 860 chars, 5 images | thin, needs content |
| `/pages/recycled-boxes` | `sustainability` | 1,128 chars, 1 image | thin, needs content |

The last three are thin against the old theme and cannot reach stage 3 on layout
alone — they need their content back first.

### Booking pages

`/pages/canberra-bookings`, `/pages/sydney-bookings`, `/pages/melbourne-bookings`
— all on `bookings`, 2,437–2,980 chars, each an iframe plus an FAQ list. Stage 1
done. Stage 2 is mostly about the iframe's framing.

### Support and policy

| Page | Suffix | Now |
| --- | --- | --- |
| `/pages/faq` | `faq` | 7,229 chars — Horizon-native layout already |
| `/pages/subscription-faq` | `faq-subscriptions` | 7,280 chars — same |
| `/pages/privacy` | `privacy` | 9,385 chars |
| `/pages/shipping-information` | `text-template` | 3,551 chars |
| `/pages/contact` | `contact` | 306 chars + details; **two live forms** |

Contact carries both the Globo (Powerful Form Builder) form, embedded in
`page.content`, and Horizon's native `contact-form`. The Globo one has the
enquiry-type router admin depends on; the native one arrived with the Horizon
base template. One has to go, and the native route is Shopify's own **Forms**
app, which is already installed.

### System and orphan pages

`/pages/llms` (restored 2026-10-20), `/pages/maintenance` (no template — its
image asset is not in this theme), `/pages/search-results-page`, and five
`/pages/spurit-*` shells left by a removed subscriptions app. None of these are
design surfaces; the spurit pages should be unpublished rather than styled.

## Rules

1. **Horizon first.** A new section is a Horizon section with a `{% schema %}`
   and `{% stylesheet %}`. Porting another `ona-*` section needs a reason.
2. **One measure per page.** Width comes from `--legacy-page-measure` or a
   Horizon `.page-width-*` class, never a literal.
3. **Two breakpoints.** 749/750 and 989/990. Anything else only misbehaves in
   the band between them.
4. **Extend the shared sheet, do not add per-section blocks** — unless the
   section is Horizon-native and styles itself completely, in which case it
   should not touch the shared sheet at all.
5. **Merged is not deployed.** Check the file's `updatedAt` on the theme. The
   GitHub sync has silently dropped single files three times in one day.
6. **A guard that enumerates protects only what you remembered.** Derive the
   list and compare, as the three tests above do.
