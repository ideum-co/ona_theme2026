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

- **Two sections are already correct.** `wholesale_partnership` and
  `cafe_testimonial` render at live's height. Whatever they do, the others
  should copy — they are the control group, not a coincidence to ignore.
- **`faq_lists` is the opposite problem.** It is *shorter* than live, so
  content is collapsed or missing rather than stretched. Different bug, do not
  lump it in.
- **The top three account for most of it.** `icon_and_content` and
  `unique_coffees` alone are 14,846px of the 30,486px excess.

---

## Track A, Stage 1 — stabilise

Goal: stop the page looking broken. **No redesign, no re-architecture.** Scoped
`{% stylesheet %}` per section, constraining what has escaped.

Ordered by damage, worst first:

1. **`ona-icon-and-content`** — 16.4x. Five icons at 100-195px natural, painted
   at 1016px. Constrain the icon box and restore the row. One section, five
   images, kills the single worst defect on the page.
2. **`ona-unique-coffees`** — 14.5x, the largest absolute excess.
3. **`ona-wholesale-brands`** — 6.5x. A logo wall; same class of fault.
4. **`ona-wholesale-testimonial`** — 4.2x.
5. **The four `sourcing` variants** — 2.9x to 3.9x, likely one shared fault.
6. **`ona-faq-lists`** — the collapsed one. Different fix: it needs the
   accordion behaviour, not a size cap.

Definition of done for Stage 1: wholesale within ~15% of live's 10,400px, no
image upscaled beyond 1.3x, and a test that measures it so it cannot regress.

Then repeat the measurement on `/pages/about`, `/pages/barista-courses`,
`/pages/private-courses-and-experiences`, `/pages/canberra-bookings`. Those
showed no image upscaling but use the same unstyled sections, so they need the
same height comparison before anyone calls them fine.

## Track A, Stage 2 — fix properly

Only after Stage 1, and section by section:

1. **Move images to `image_tag`** so they get `srcset` and intrinsic dimensions.
   Outside `/blogs` there is not one `srcset` in the theme today.
2. **Rebuild each section on the theme's tokens** — spacing, type, colour —
   rather than reproducing the legacy cascade, which this theme does not have.
3. **Retire the dead markup.** `wowo`, `fadeInUp`, `animate__heartBeat` are on
   every one of these sections and the library behind them is not in the theme.
   They are inert attributes inflating the DOM.
4. **Drop the legacy class names** once nothing depends on them.

## Track A, Stage 3 — the rest

Already written up, not started:

- Brew guides **filtering** — `docs/brew-guides-2026-10-20.md` stage 2. Tag
  facets over 747 articles. Pagination landed in #199.
- **`ona-read-more-content`** below the brew-guides list — stage 3 there.
- The **seven fallback page templates** — `docs/front-end-audit-2026-10-20.md`
  section 4.4. Only the FAQ pages lost content and those are ported; the rest
  lose layout only.
- **Empty-state collection** for no-results search — one theme setting, listed
  in the audit's admin section.

---

## Track B — Victor's follow-ups

Full detail in `docs/victor-handoff-2026-10-20.md`. As a checklist:

1. **Mega menu** — designed in XD screens 2 and 3, not built; the theme opens a
   hamburger drawer at every width. The markup already exists in the DOM.
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
