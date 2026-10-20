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

Three things this tells us that a screenshot does not:

- **Two sections match live's height — which is not the same as being
  correct.** `wholesale_partnership` and `cafe_testimonial` come in at 1.0x. An
  earlier draft called them "the control group" and told everyone to copy them;
  Codex checked, and for `cafe_testimonial` that was wrong (PR #203). Every logo
  in it sits on a bare `<div class="bg-img" style="background-image: ...">`, and
  **`.bg-img` has no rule anywhere in `assets/*.css`** — the shared sheet styles
  the differently-spelled `.img-bg` (6 rules). With no height and no aspect
  ratio the element collapses, so the section's media is invisible and its total
  height resembles live by accident. Matching height is a symptom worth
  explaining, never a certificate. `wholesale_partnership` is built on
  `.add-image-and-text`, which the shared sheet does cover — but verify it
  element by element before holding it up as a model.
- **`faq_lists` is the opposite problem.** It is *shorter* than live, so
  content is collapsed or missing rather than stretched. Different bug, do not
  lump it in.
- **The top three account for most of it.** `icon_and_content` and
  `unique_coffees` alone are 14,846px of the 30,486px excess.
- **`.bg-img` is the shared fault behind the `sourcing` variants.** Eleven
  legacy sections paint media onto that unstyled class — `ona-sourcing`,
  `ona-cafe-testimonial` and all nine `*-sourcing-v*` variants. One rule fixes
  the group.

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

Ordered by damage, worst first:

1. **`ona-icon-and-content`** — 16.4x. Five icons at 100-195px natural, painted
   at 1016px. Constrain the icon box and restore the row. One section, five
   images, kills the single worst defect on the page.
2. **`ona-unique-coffees`** — 14.5x, the largest absolute excess. **Not a CSS
   job.** With the three configured blocks it emits nine images and three
   `.slider-handle` controls, and `slider-handle` and `imgs-slider-unique`
   appear nowhere outside that one Liquid file — no listener, no component. CSS
   can bring the height down; only rebuilt behaviour makes a tab select its
   coffee. Budget it as behaviour, not layout (Codex, #203).
3. **`ona-wholesale-brands`** — 6.5x. A logo wall; same class of fault.
4. **`ona-wholesale-testimonial`** — 4.2x.
5. **The four `sourcing` variants** — 2.9x to 3.9x. The shared fault is
   `.bg-img`, above; one rule should move all of them.
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
