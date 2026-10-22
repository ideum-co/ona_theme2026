# Staged plan: stabilise the UI, then fix it properly

Two tracks that run in parallel and do not touch the same files.

- **Track A — us.** `/pages` and `/blogs`. Stage 1 stabilises, Stage 2+ rebuilds.
- **Track B — Victor.** Home page, header, quiz. Listed at the end as follow-ups.

Evidence: `docs/legacy-sections-unstyled-2026-10-20.md`.

---

## The damage, measured

`/pages/wholesale`, section heights, 1396px viewport, both themes fully loaded:

| section | live | theme2026 | factor |
|---|---|---|---|
| `icon_and_content` | 396 | 6,491 | **16.4x** |
| `unique_coffees` | 575 | 8,355 | **14.5x** |
| `wholesale_brands` | 355 | 2,308 | **6.5x** |
| `wholesale_testimonial` | 926 | 3,887 | 4.2x |
| `wholesale_sourcing_v3` | 468 | 1,809 | 3.9x |
| `wholesale_sourcing_v4` | 468 | 1,767 | 3.8x |
| `sourcing` | 572 | 2,044 | 3.6x |
| `wholesale_sourcing_v2` | 660 | 1,935 | 2.9x |
| `wholesale_sourcing_v5` | 1,097 | 2,619 | 2.4x |
| `supported` | 588 | 1,376 | 2.3x |
| `training` | 718 | 1,343 | 1.9x |
| `exclusive_access` | 617 | 1,180 | 1.9x |
| `gust_r` | 784 | 1,083 | 1.4x |
| `expressions` | 556 | 705 | 1.3x |
| `wholesale_partnership` | 605 | 582 | **1.0x** |
| `cafe_testimonial` | 613 | 601 | **1.0x** |
| `faq_lists` | 268 | **70** | **0.3x** |
| **whole page** | **10,400** | **40,886** | **3.9x** |

**The table is 17 rows and the page has 18 sections.**
`wholesale_sourcing_v6` is enabled in `templates/page.wholesale.json` and was
never measured. The rows above sum to 10,266px live and 38,155px in theme2026
against the stated whole-page 10,400px and 40,886px, so 134px and 2,731px are
unaccounted for. That residual is either `_v6` itself — which would make it the
worst ratio on the page by some distance, ahead of `icon_and_content` — or page
chrome the per-section measurement did not attribute. It was not resolved, and
#209 has since changed the row layout these sections share, so the 2026-10-20
numbers cannot be reproduced to settle it. Re-measure before using this table to
rank anything (Codex, #203).

Three things this tells us that a screenshot does not:

- **Two sections match live's height — which is not the same as being
  correct.** `wholesale_partnership` and `cafe_testimonial` come in at 1.0x. An
  earlier draft called them "the control group" and told everyone to copy them;
  Codex checked, and for `cafe_testimonial` that was wrong (PR #203). Every logo
  in it sits on a bare `<div class="bg-img" style="background-image: ...">`, and
  at the time of this measurement **`.bg-img` had no rule anywhere in
  `assets/*.css`** — the shared sheet styled the differently-spelled `.img-bg`
  (6 rules). With no height and no aspect ratio the element collapsed to
  411x0, so the section's media was invisible while its total height resembled
  live by accident. **Fixed in #209**, which gives it `padding-top:100%` and
  `border-radius:50%`; it now renders 125x125, production's size, and
  `tests/legacy-image-sizing.test.mjs` holds it. The lesson outlives the bug:
  matching height is a symptom worth explaining, never a certificate. `wholesale_partnership` is built on
  `.add-image-and-text`, which the shared sheet does cover — but verify it
  element by element before holding it up as a model.
- **`faq_lists` is the opposite problem.** It is *shorter* than live, so
  content is collapsed or missing rather than stretched. Different bug, do not
  lump it in.
- **The top two are a bit under half of it.** 14,846px is what
  `icon_and_content` and `unique_coffees` *measured*, not what they
  contributed: the excess is each one's height minus live's. That is
  (6,491 - 396) + (8,355 - 575) = **13,875px of the 30,486px excess, 45.5%**.
  An earlier draft reported the raw sum and called it "most of it" — wrong
  arithmetic in the direction that flattered the prioritisation, which is the
  worst direction for it to be wrong in. The ordering still holds; the claim
  behind it was overstated. (Codex, #203.)
- **The shared fault behind the `sourcing` variants is the row layout, not
  `.bg-img`.** An earlier draft said otherwise; Codex checked the template and
  it was wrong (#203). `wholesale_sourcing_v2` through `_v6` carry **0 blocks**
  in `templates/page.wholesale.json`, and each variant's only `.bg-img` sits
  inside the block loop — so none of them renders one, and a `.bg-img` rule
  cannot move their height at all. What they do render is one always-present
  image in a `<div class="content container">` row, and the two-column rule
  never matched that single-element markup, so image and text stacked full
  width. Fixed in #209: those six sections went 1,941-2,994px to roughly half.
  `.bg-img` still matters, but only for `ona-sourcing` (4 blocks) and
  `ona-cafe-testimonial`, where it rendered 411x0 — invisible.

---

## Track A, Stage 1 — stabilise

Goal: stop the page looking broken. **No redesign, no re-architecture.**

**Put the rules in `assets/legacy-page-layout.css`, not in a scoped
`{% stylesheet %}` per section.** `layout/theme.liquid` already loads that sheet
for these page suffixes and it already styles most of the classes these sections
use; a per-section block would duplicate or fight it. See
`docs/legacy-sections-unstyled-2026-10-20.md` — the uncovered selectors are
listed there, and they are shared across sections, so a fix written once lands
everywhere. A scoped `{% stylesheet %}` is right only for something genuinely
local to one section, such as the icon-box constraint in item 1. (Codex, #203 —
the first draft of this plan sent every item to its own stylesheet.)

Ordered by damage, worst first. **Items 1 and 3 have since shipped in #204**
(`6648c74`) — the numbers below them describe the pre-fix tree, so remeasure
before picking up item 2 rather than trusting this ordering (Codex, #203):

1. ~~**`ona-icon-and-content`** — 16.4x. Five icons at 100-195px natural,
   painted at 1016px.~~ **Done, #204.** `assets/legacy-page-layout.css` now
   defines the `.col-4-icons` grid and caps icons at 120x88;
   `tests/legacy-image-sizing.test.mjs` holds it. Measured on the deployed page:
   the section went 6,491px -> 230px.
2. **`ona-unique-coffees`** — 14.5x, the largest absolute excess. **Not a CSS
   job.** With the three configured blocks it emits nine images and three
   `.slider-handle` controls, and `slider-handle` and `imgs-slider-unique`
   appear nowhere outside that one Liquid file — no listener, no component. CSS
   can bring the height down; only rebuilt behaviour makes a tab select its
   coffee. Budget it as behaviour, not layout (Codex, #203).
3. ~~**`ona-wholesale-brands`** — 6.5x. A logo wall; same class of fault.~~
   **Done, #204.** Brand logos capped at 170px wide; the section went
   2,308px -> 265px. Together with item 1 the page went 32,136px -> 23,830px,
   upscaled images 17 -> 12, and the worst upscale 11.8x -> 3.7x.
4. **`ona-wholesale-testimonial`** — 4.2x.
5. ~~**The `sourcing` family** — six sections render on the page (`sourcing`
   and `wholesale_sourcing_v2` through `_v6`, all enabled); the table measures
   five of them, 2.4x to 3.9x.~~ **Done, #209.** Their
   shared fault was the row layout, not `.bg-img` (they render none — see
   above): the two-column rule did not match the single-element
   `<div class="content container">`. With that fixed the live page went
   27,033px -> 15,974px and its upscaled images 10 -> 0.
6. **`ona-faq-lists`** — the collapsed one, and it is a content problem before
   it is a behaviour problem. All six blocks under
   `templates/page.wholesale.json` are `"disabled": true`, so the section
   renders no entries at all — which is why it measures 70px against live's
   268px, roughly its own heading. Enable or migrate the entries first; an
   accordion over nothing is still nothing (Codex, #203).

Definition of done for Stage 1: wholesale within ~15% of live's 10,400px, no
image upscaled beyond 1.3x, and a test that measures it so it cannot regress.

Then repeat the measurement on `/pages/about`, `/pages/barista-courses`,
`/pages/private-courses-and-experiences`, `/pages/canberra-bookings`. Those
showed no image upscaling but use the same unstyled sections, so they need the
same height comparison before anyone calls them fine.

## Track A, Stage 2 — fix properly

Only after Stage 1, and section by section:

1. **Move images to `image_tag`** so they get `srcset` and intrinsic dimensions.
   None of the five legacy page templates measured here emits a single
   candidate — they all use raw `<img src="{{ ... | img_url }}">`. This is a
   property of those templates, not of the theme: `hero.liquid`,
   `locations-flagships.liquid`, `product-dna.liquid` and the shared image
   snippets already go through `image_tag`, so do not convert those. (Scope
   corrected after Codex, #203.)
2. **Rebuild each section on the theme's tokens** — spacing, type, colour —
   rather than reproducing the legacy cascade, which this theme does not have.
3. **Retire the dead markup.** `wowo`, `fadeInUp`, `animate__heartBeat` are on
   every one of these sections and the library behind them is not in the theme.
   They are inert attributes inflating the DOM.
4. **Drop the legacy class names** once nothing depends on them.

## Track A, Stage 3 — the rest

Already written up, not started:

- Brew guides **filtering** — `docs/brew-guides-2026-10-20.md` stage 2. Tag
  facets over 747 articles. Pagination landed in #205 (which superseded #199),
  and that document and the audit below reached `main` with it.
- **`ona-read-more-content`** below the brew-guides list — stage 3 there.
- The **seven fallback page templates** — `docs/front-end-audit-2026-10-20.md`
  section 4.4. Only the FAQ pages lost content and those are ported; the rest
  lose layout only.
- **Empty-state collection** for no-results search — one theme setting, listed
  in the audit's admin section.

---

## Track B — Victor's follow-ups

Full detail in `docs/victor-handoff-2026-10-20.md`. As a checklist:

1. **Mega menu** — **built, not missing.** `header-drawer.liquid` renders
   `header-megamenu` into the same `<details>` as the drawer, and the CSS swaps
   drawer for full-width panel at `min-width: 750px`; it has shipped since #89
   and #97 in August. Compare the panel's *content* against XD screens 2 and 3
   — do not rebuild it. (An earlier draft said the drawer opened at every
   width; Codex caught it, #203.)
2. **Coffee quiz** — 8 designed screens (XD 4-11) against one built modal.
   Walk the built flow against the comps.
3. **"Add to cart" wraps to two lines** at 139px on product cards. #200 fixed
   the vertical alignment; this is horizontal. Live gives the button the full
   card width.
4. **Flagship photography** — `locations-flagships` leads with ONA Dubai across
   16 images; live shows the five Australian flagships across 43.
5. **Use the new assets** — 20 photographs in Shopify Files (`ona-home-*`), 10
   vector marks in `assets/` (#202), eight of them recolourable via
   `currentColor`.
6. **Reconcile before merging** — `templates/index.json` and
   `config/settings_data.json` carry theme-editor changes from 2026-10-19 that
   the repo does not have.

There is **no XD design for any `/pages`**. If a second prototype covers the
inner pages it changes Track A's approach; worth asking before Stage 2.
