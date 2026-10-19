# Brew Guides — pagination and filtering

Found during the front-end preview audit (`docs/front-end-audit-2026-10-20.md`).
Stage 1 is implemented; stages 2–4 are planned and not started.

---

## 1. What was wrong

`/blogs/brewguides` holds **747 articles**. The 2026 theme served **50**, and
that was the end of the road.

| | live (160815546559) | theme2026, before |
|---|---|---|
| shown | 26, paginated | **50** |
| `?page=2` | the next 26 | **the identical 50** |
| sections | `main` + read-more + FAQ | `main` only |

Pages 2, 5, 15 and 16 each returned the same 50 articles — overlap 50, nothing
new. **697 guides were reachable only by direct URL or the sitemap**, with no
way to browse to them and no internal linking.

### Cause

`sections/main-blog.liquid` looped `blog.articles` with no `{% paginate %}`.
Liquid caps an unpaginated `blog.articles` at 50 and ignores `?page=`.

This was not a regression here. That file was untouched since the Horizon base
import (`669f457`), and pagination has never existed in its history.
`main-blog` is the only listing section Horizon shipped without it —
`main-collection`, `search-results`, `product-list` and `featured-blog-posts`
all paginate. Horizon assumes a small blog; 747 articles is not that.

`/blogs/news` (Journal, 43 articles) sat under the cap and would have broken
silently at its 51st article.

---

## 2. How the live theme does it

`sections/ona-blog-template.liquid`, 12.7 KB. It is not just a paginated list:

1. **Pagination** — `{% paginate blog.articles by limit %}`, limit from a
   `paginate-page-size` snippet, default 24, links via `include 'pagination'`
2. **Results counter** — "SHOWING 24 OF 747 RESULTS"
3. **Tag tab row** — "View All" plus the *unnamespaced* tags, linking to
   `/blogs/brewguides/tagged/<handle>`
4. **Faceted filter drawer** — groups built from *namespaced* tags, combining
   into multi-tag URLs (`/blogs/brewguides/a+b`)
5. Cards: image, title, "View Brewguide"

### Why it was not ported verbatim

Same trap as the FAQ port, and worse. The section depends on:

| needs | present in this theme |
|---|---|
| `snippets/pagination.liquid` | no |
| `snippets/paginate-page-size.liquid` | no |
| `snippets/image-style.liquid` | no |
| `.shop-content .shop-list .shop-top .shop-filter .tab-filter .filters-wrapper` | **0 of 6** |
| filter-drawer JavaScript | no |

It also uses the deprecated `{% include %}`. A verbatim copy would have
rendered unstyled and inert.

---

## 3. The tag data

39 tags on the blog, which is what any filtering has to be built from:

| group | count | values |
|---|---|---|
| `Taste Notes.*` | **21** | Berry, Biscuit, Botanical, Caramel, Chocolatly, Citrus, Floral, Fruity, … |
| `Brew Method.*` | 5 | Aeropress, Espresso, French Press, Moka Pot, Pour Over |
| `Coffee Type.*` | 4 | Espresso, Filter, Milk, Reserve |
| `Origin.*` | 4 | Centeral America, East Africa, Middle East, South America |
| `Roast Type.*` | **0** | — |
| unnamespaced | 4 | Espresso, Filter, Milk-based, Sasa Sestic |

Two things follow:

- **The live "Roast Type" facet is dead.** It renders only
  `if allcur contains 'Roast Type'`, and no such tag exists. Do not rebuild it
  without first deciding whether the tags are coming.
- **The data needs cleaning** (stage 4): `Origin.Centeral America` is a typo,
  and three Taste Notes carry a leading space — `Taste Notes. Jasmine`,
  `. Tea-like`, `. Yellow Peach` — so they would render as separate facets from
  their siblings.

---

## 4. Stages

### Stage 1 — pagination · **done**

`{% paginate blog.articles by section.settings.articles_per_page %}` around the
article loop, closed after it, with the theme's own
`{% render 'pagination-controls' %}` inside the block. Follows
`sections/main-collection.liquid`. Default 24, matching live; the range maxes at
48 because above 50 Liquid truncates regardless and the control must not offer a
value that silently loses articles.

Fixes `/blogs/brewguides` and pre-empts `/blogs/news`. No new CSS, no new
snippets, Horizon's card design untouched — which matters because Victor is
working in these files.

`tests/blog-pagination.test.mjs` asserts the loop sits *inside* the paginate
block and the controls render after it. Probed four ways: wrapper removed,
controls dropped, loop moved outside the block, and the max raised past 50.

**Still to verify after merge:** the tests match source text and do not render
Liquid. Load `/blogs/brewguides?page=2` and confirm the articles differ from
page 1.

### Stage 2 — filtering · not started

747 guides need facets to be usable. Proposal: reuse the radio-pill pattern
built for the locations finder rather than the legacy drawer — Brew Method,
Coffee Type and Origin as pill rows, driven by `/blogs/brewguides/tagged/…`.

Open: Taste Notes has 21 values. A pill row is too long; it needs either a
collapsed group or to be left out of the first pass.

### Stage 3 — content below the list · not started

Live carries two sections under the article list that this theme does not:

- `ona-read-more-content` — expandable SEO copy. Not in this repo; needs
  rebuilding, not copying.
- `ona-faq-lists` — **already in this repo**, four blocks of FAQ content on live.

### Stage 4 — tag hygiene · content job, not code

The typo and the three leading spaces in §3.

---

## 5. Decisions taken, and what would change them

- **24 per page**, matching live and Horizon's collection default. Change the
  section setting, not the code.
- **Horizon's blog cards kept**, not live's image + "View Brewguide". Victor is
  actively working in these files and may have styled them deliberately; this is
  his call to reverse.
- **Pagination before filtering.** Pagination makes 697 articles reachable at
  all; filtering only makes them easier to find. The first is a blocker, the
  second is an improvement.
