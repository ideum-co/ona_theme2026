# Responsive and mobile review — `ona_theme2026`, 16 October 2026

Companion to `docs/archive/2026-10-go-live/victor-review-2026-10-16.md`. Measured against `main` = `77174e8` and theme
`154676789439`.

**What this is not:** a visual check. Chrome in this environment clamps window resizing at about
1283px, the storefront blocks iframes via `frame-ancestors`, and CSS zoom does not move media
queries — so **no claim here comes from looking at a small viewport.** Everything below is
static: parsed stylesheets, parsed Liquid, selector-to-markup matching, and fetched HTML.
§7 is the list that still has to be done on a physical device.

---

## 1. This theme has two breakpoints. Use them.

Census across every `.css` and `.liquid` file:

| boundary | occurrences |
|---|---|
| `min-width: 750px` | 261 |
| `max-width: 749px` | 154 |
| `min-width: 990px` | 20 |
| `max-width: 989px` | 4 |
| everything else | 1–8 each, almost all one-offs |

**749/750** is mobile ↔ desktop. **989/990** is the tablet band. Anything else is a one-off that
will disagree with the rest of the theme somewhere between the two.

`assets/legacy-page-layout.css` and `assets/home-mobile-overflow.css` both use 749 — correct.
One migrated section does not: `sections/ona-page-title.liquid` carries an inline
`@media (max-width: 575.98px)` and a hardcoded `font-family: "Karla"` instead of the theme's
font token. It is placed on `/pages/learn`.

`tests/responsive-breakpoint-pairing.test.mjs` now enforces the boundaries for the two legacy
stylesheets. It does not yet cover inline `{% style %}` blocks inside sections.

---

## 2. What the two new stylesheets actually cover

`assets/legacy-page-layout.css`, 86 lines, loaded only for the six migrated page suffixes. It
works by naming class hooks: `.about`, `.our-philoshophy`, `.awards`, `.careers`,
`.sustainability-top`, `.sustainability-list`, `.banner-top`, `.banner-detail-top`,
`.add-image-and-text`, `.add-image-and-text-slider`, `.training`, `.two-columns-title-intro`,
`.training-bookings`, `.learn-list`, `.product-search`, `.bread-crumbs-content`,
`.ona-legacy-contact-form`.

Matched against the wrapper class each migrated section actually emits:

**34 of 43 sections are covered. 9 are not**, and 2 of those 9 ship their own CSS
(`legacy-page-feature`, `ona-sr-heading`), which leaves **7 sections with no responsive rules
from anywhere** — not from the legacy sheet, not from their own file, and not from Horizon,
which knows nothing about this markup.

One thing done well and worth keeping: all **11** sections that render `.add-images-slider`
markup sit under the `.add-image-and-text-slider` wrapper, so the 3-column-to-1-column grid rule
reaches every one of them. That is the right way to retire a JS slider — turn it into a grid
rather than port the slider.

---

## 3. The homepage overflow fix covers one carousel of several

`assets/home-mobile-overflow.css` is loaded only on `index` and lands on the theme. Two things
about how it is scoped:

**`.ui-test-product-list` is a schema class on `sections/product-list.liquid` and nothing else.**
It is declared at `sections/product-list.liquid:90` as `"class": "ui-test-product-list"`. On the
homepage today, `coffee_spotlight` is the only `product-list` section, so the class appears
**once** — while `resource-list__slide` appears 8 times, `resource-list__carousel` 3 times and
`slideshow-component` 10 times. The other carousels — `slideshow_nBcaMx`,
`collection_carousel_GRkRhJ` — get none of these rules. Nor would a `collection-list` or
`featured-blog-posts` section added later, though they render the same component.

**The page-level guard is conditioned on that same section existing.** `body:has([data-testid=
"product-list"]) { overflow-x: clip }` currently applies, and `overflow-x: clip` hides overflow
**from any source** — so the symptom can be gone while a different section is still the cause.
Disable or remove `coffee_spotlight` and the clip disappears with it.

Not a reason to revert it. A reason to (a) find the element that actually overflows before
declaring it fixed, and (b) scope the rules to the carousel component rather than to one
section's test hook.

---

## 4. Seven sections with no responsive rules — and what that looks like

All seven are placed on live pages.

| section | wrapper | page | consequence |
|---|---|---|---|
| `ona-training-text-two-images` | `.training-intro` | barista-courses | **images do not render** |
| `ona-icon-and-content` | `.col-4-icons` | wholesale | 4-up icon grid, no grid and no collapse |
| `ona-faq-lists` | `.add-faqs-section` | wholesale, bookings | accordion with no JS |
| `ona-gust-r` | `.wholesale-form.pop-up-form` | wholesale | the popup is not a popup |
| `ona-training-form` | `.training-form` | barista-courses | 2-col wrapper unstyled |
| `ona-training-text-image-bg` | `.training-bg` | barista-courses | unstyled |
| `ona-page-title` | `.page-title` | learn | own CSS, wrong breakpoint (§1) |

Three of these are worse than "unstyled":

**`.training-intro` images are invisible.** The section renders two `<div class="img-bg image-1">`
with nothing but an inline `background-image`. A div with no content and no height is zero
pixels tall. `legacy-page-layout.css` gives `.img-bg` a height in four places —
`.sustainability-list`, `.banner-top`, `.banner-detail-top`, `.learn-list` — and
`.training-intro` is in none of them. There is no rule for `.image-1` or `.image-2` anywhere in
the theme. Fix: `aspect-ratio` on the pair, as `.learn-list .img-bg` already does.

**The accordions have no JavaScript.** `ona-faq-lists` and five other migrated sections
(`ona-training`, `ona-supported`, `ona-unique-coffees`, `ona-traning-supported`,
`ona-expressions`) toggle an `is-active` class. **Zero of the 42 migrated sections ship any
JavaScript, and no asset file references these class names.** The markup renders with whatever
`is-active` state Liquid writes — for `ona-faq-lists`, the first item open and the rest shut,
permanently, with no way to open them. On a phone this is the difference between a long page and
an unusable one.

**The wholesale "popup" renders inline.** `ona-gust-r` carries `.pop-up-form`, a
`.pop-up-form-close` link and a `.wholesale-roaster-form-btn` trigger. No CSS hides it, no JS
opens it. Confirmed in the fetched HTML: the form's content sits in the page's text flow
directly before "Join our community". PR #178 replaces the `{formbuilder:50188}` shortcode with
a working native form, so after it merges the page gains a real enquiry form — **inline, with a
dead "Get in touch" button above it.** Decide which you want: a real `<dialog>`, or drop the
popup wrapper and present the form inline on purpose.

---

## 5. Nothing targets the tablet band

The theme has a 750–989px band and uses it in 24 places. **Neither new stylesheet has a single
rule in it.** Across 750–989px the migrated pages jump straight to the full desktop grid — two
and three columns, with gutters that only clamp by `vw`:

```
--legacy-page-gutter: clamp(20px, 5vw,  72px);
--legacy-page-gap:    clamp(48px, 7vw, 110px);
```

At 768px that is a 38px gutter around a two-column editorial layout whose type is also still
scaling off `vw`. It will not break; it will look cramped. This is the band an iPad in portrait
sits in, and it is the band nobody has looked at.

---

## 6. Pair every breakpoint with whatever else depends on it

A migration produces a specific kind of bug: two files that are each correct and disagree with
each other. `sections/ona-training-banner.liquid` is the worked example, fixed in **PR #180**.

The section states its own invariant at the top — *"Single-width preload per media query
strictly matches the inline url in pc-show/mobile-show"* — and the migration broke it. In the
production theme those two classes swapped at **992px**, which is where the preload hints still
pointed. Here they swap at **750px**, in `legacy-page-layout.css:61,76-77`, written by #172 after
#171 brought the section across.

| viewport | preloaded `fetchpriority="high"` | actually painted |
|---|---|---|
| ≤ 749px | 800w | 800w ✅ |
| **750–991px** | **800w** | **1920w** ❌ |
| ≥ 992px | 1920w | 1920w ✅ |

In the tablet band the browser fetches the 800px image at high priority, throws it away, and
paints a 1920px background that was never preloaded. Two downloads, and the LCP element is the
un-preloaded one. Correct on a phone, correct on a desktop — which is exactly why checking both
ends missed it.

There is a second, subtler half to it. The obvious repair is `(min-width: 750px)`, and that is
still wrong: `max-width: 749px` and `min-width: 750px` are not complements. A layout viewport of
749.5px — an embedded storefront, a zoom and DPR combination — satisfies neither, so nothing is
preloaded while the CSS, whose rule has also stopped applying, paints the 1920px image. The
desktop hint is therefore `not all and (max-width: 749px)`, the exact set the CSS condition
excludes. If you ever see that "tidied up" back to a `min-width`, it is a regression.

`tests/responsive-breakpoint-pairing.test.mjs` reads the switch point out of the stylesheet
rather than hardcoding it, requires the owning media block to carry **both** halves of the swap,
and checks the default-state rule that hides the mobile image outside any media query. Keying on
one rule was not enough: moving `.mobile-show` to another block left the test green and the
banner blank on a phone.

**The general rule: when you change a breakpoint, grep for the number.** Preload hints, `sizes`
attributes, `imagesrcset`, inline `{% style %}` blocks and JS matchMedia all carry copies of it,
and none of them are near the CSS you edited.

---

## 7. The device pass — none of this has been done

Everything above is static analysis. These need a real phone and a real tablet. **Report back
per row**; a row with no note is not a pass.

**Devices:** one iOS phone (Safari), one Android phone (Chrome), one tablet in portrait —
the tablet is the point of §5. Widths that matter: **375**, **390**, **768**, **820**.

### Must pass before publish

| # | page | check |
|---|---|---|
| 1 | home | no horizontal scroll at 375px — and confirm *which* element was overflowing, per §3 |
| 2 | home | the three carousels not covered by the fix: slideshow, collection carousel, coffee spotlight |
| 3 | home | hero renders (it is a flat grey block in every capture so far) |
| 4 | PDP | media gallery: swipe, zoom, thumbnails |
| 5 | PDP | variant switch updates price, image and availability |
| 6 | any | add to cart → cart drawer opens, updates, and closes |
| 7 | any | checkout reachable from the drawer |
| 8 | collection | card price reacts to the variant selector (the #167 / #169 fix, on a touch device) |
| 9 | header | tap targets ≥ 44px: search, cart, menu, account — they overlapped before #169 |
| 10 | header | the mega-menu quirk: overlapping lines and areas, reported and never reproduced here |

### Migrated pages, at 375px and at 768px

| # | page | check |
|---|---|---|
| 11 | `/pages/barista-courses` | the two `.training-intro` images render at all (§4) |
| 12 | `/pages/barista-courses` | enquiry form submits and the confirmation appears (after #178) |
| 13 | `/pages/barista-courses` | banner LCP image is the one that was preloaded (after #180) |
| 14 | `/pages/wholesale` | the 4-up icon grid does not run off the screen (§4) |
| 15 | `/pages/wholesale` | FAQ accordion opens and closes (§4 — expected to fail) |
| 16 | `/pages/wholesale` | "Get in touch" does something (§4 — expected to fail) |
| 17 | `/pages/private-courses-and-experiences` | enquiry form submits (after #178) |
| 18 | `/pages/about` | the animated SVG does not overlap the copy at 375px |
| 19 | `/pages/canberra-bookings` | FAQ accordion (§4) |
| 20 | all six | the 750–989px band specifically — this is §5, and it is unexamined |

### Forms, after #178

| # | check |
|---|---|
| 21 | submitting one form shows the confirmation on **that form only** — the Wholesale page is the case that matters |
| 22 | a validation error shows on the submitting form only |
| 23 | the enquiry arrives, with its `contact[subject]` intact |
| 24 | inputs do not trigger iOS zoom on focus (effective font-size ≥ 16px) |

### Tracking — a publish gate, not QA

| # | check |
|---|---|
| 25 | a real test purchase appears in GA4 Realtime **and** DebugView, with revenue and session attribution intact |
| 26 | webhooks fire for that order, including the ones created in the admin UI |

Both prior tracking failures were silent data loss, and Horizon's cart and checkout JavaScript
is not the old theme's. Parity cannot be assumed.
