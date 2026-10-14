# Product page enrichment sections — data model & migration plan

**Status: BLOCKED — pending Formswell + Victor review.** Do not start
building any of the sections below until that review lands. This doc is the
handoff artifact for that review; it's the investigation/plan, not an
implementation in progress.

Planning doc only — nothing in this doc is built yet. Written 2026-08-17 after
investigating how the live theme sources the richer PDP content (properties
table aside, which is already ported — see below). Revisit when ready to
build the rest.

## Why this needed its own investigation

The live product template (`templates/product.json` on the live theme) isn't
one section — it's eight, each a dedicated custom section type, each
independently guarded to render nothing if its data is blank:

```
main → profile → sourcing → image_slider → origin → brew_guide → accordion → recommendations
```

Five of those eight (`profile`, `sourcing`, `image_slider`, `origin`,
`brew_guide`) pull from a legacy app's metafield namespace (`accentuate.*`),
and **one of them — brew guide — doesn't even read from the product itself**.
That's the part worth documenting before anyone tries to port this in a
hurry.

## Section-by-section

### 1. Coffee Profile — ALREADY PORTED (commit `d322532`)
- Source: `accentuate.tastes_like`, `accentuate.roast`, `accentuate.components`
  (flat strings on the product).
- **Gap vs. live**: live also renders `accentuate.content_coffee_profile` (a
  rich intro paragraph above the table) and `accentuate.image_coffee_profile_1`
  / `_2` (two decorative background images). We only built the table.
- Caution: `content_coffee_profile` on Raspberry Candy is legacy
  rich-text-editor HTML full of inline styles (`font-family: sans-serif`,
  explicit `color: rgb(65,65,65)`, etc.) — rendering it raw will fight
  Horizon's typography. Worth stripping inline styles or reformatting rather
  than copy-pasting when this gets built.

### 2. Brew Guide — NOT PORTED, most complex of the four remaining

> **Corrected 2026-10-14.** The line below — "data does not live on the product" —
> is wrong for the **spec table**, and it misled a PR review into planning an
> article fetch that is not needed. Measured across all 92 active products: the
> product itself carries `accentuate.title_item` and `accentuate.content_item` on
> **32** products, with genuinely per-product values and per-product lengths
> (`maple` 7 labels/7 values, `aspen` 6/6, `14-30 days after roast` vs `13-30`).
> The table is built by zipping those two product arrays by index and needs no
> article lookup. What the pointer adds is the surrounding **prose**, and it is a
> narrower surface: `select_artlice` is on only **24** products, and absent on
> every drip bag that has a spec table. Everything below about the pointer applies
> to the prose, not to the table.
>
> The pointer bullets below are rewritten to match; the old "format
> inconsistency" has an explanation now and is no longer a warning.

- **The pointer:** the product stores
  `accentuate.select_artlice` on **24** products (not 32 — it is absent on every
  drip bag that has a spec table), a plain string like
  `"brewguides/raspberry-candy"`. The live section loops every article in the
  `brewguides` blog (**747** articles) comparing `article.handle`.
- **The `brewguides/` prefix is correct, not a bug — and this resolves a loose end
  this doc used to carry.** Liquid's global `articles[...]` is keyed by the
  *compound* handle `blog-handle/article-handle`
  ([docs](https://shopify.dev/docs/api/liquid/objects/articles), e.g.
  `articles['potion-notions/new-potions-for-spring']`), so `brewguides/maple` is
  already exactly the right key. This doc previously called the prefix an
  inconsistency that "empirically works on live, didn't chase down why": the reason
  is that the compound handle is right, and it only looked wrong because a bare
  handle was assumed.
  - **Direct lookup (preferred): `articles[pointer]`, prefix intact.** One lookup,
    no loop over 747 articles.
  - **Only if you loop the blog** and compare against `article.handle`, which *is*
    bare, normalise with `| split: '/' | last`.
  - Stripping the prefix and *then* doing a direct lookup resolves nothing. That is
    what an earlier version of this correction told you to do. (Codex, PR #150.)
  - Either way, handle the case where the pointer names an article that no longer
    exists — lot rotation makes that likely.
- The **product** carries `accentuate.content_brew_guide` (heading/intro
  HTML — generic, the same `<h3>How to get the best tasting cup</h3>` on every
  product sampled) plus two **parallel arrays**, `title_item` and `content_item` — the
  spec table (Age best used / Dose / Yield / Temperature / etc.) is built by
  zipping these two arrays together by index, not from named fields.
- One brew guide article per product confirmed (not shared/reused across
  products, at least in the 5 sampled) — so this is a real per-product
  content type, not a small shared set.
- Horizon note: use the global `articles[pointer]` with the stored value as-is —
  a single lookup instead of live's loop over 747 articles. Note this is
  `articles[...]`, **not** `blogs.brewguides.articles[handle]`, which an earlier
  version of this bullet recommended: `blog.articles` is an array, and the
  handle-indexed form is the global one keyed by the compound handle.

### 3. Origin — NOT PORTED, low priority pending a prevalence check
- Source: `accentuate.image_origin` (single raw image URL) +
  `accentuate.content_origin` (rich HTML).
- **Blank on Raspberry Candy** — confirmed via direct query, both fields
  null. Whatever farm/lifestyle imagery appeared on Raspberry Candy's live
  page was actually the Profile block's `image_coffee_profile_1`/`_2` and
  the Image Slider photos, not a separate Origin section — corrected this
  assumption mid-investigation.
- Before building: check how many products in the catalog actually populate
  this (could be rare — worth a bulk metafield query across all products
  before investing build time here).

### 4. Sourcing / "Story" — NOT PORTED, same caveat as Origin
- Source: `accentuate.content_sourcing` (rich HTML) + flat fields
  `producer` / `region` / `varietal` / `process` / `altitude`.
- Also blank on Raspberry Candy. Same recommendation: check real prevalence
  across the catalog before prioritizing.

### 5. Image Slider (lifestyle gallery) — NOT PORTED
- Source: `accentuate.image`, a `json_string` array of **raw external CDN
  URLs** from the old Accentuate.io app (`cdn.accentuate.io/...`) — not
  native Shopify image objects, so no automatic width/height/srcset/CDN
  transforms.
- Live's code has a real, documented performance fix worth preserving
  verbatim: Accentuate's own resize service appends `?WIDTHxHEIGHT` to every
  delivered URL, and the theme parses that suffix back into explicit
  `width`/`height` attributes so the browser can reserve layout space before
  each image loads. The live code comment cites a measured CLS improvement
  from this (product pages were "poor" CLS ~9% vs. ~4% on collection pages
  before the fix). Any port must replicate this or find an equivalent, or
  CLS regresses.
- Bigger-picture option worth a real conversation later: migrate these
  images into native Shopify `files`/media so we get real responsive images
  instead of depending on a third-party app's URL convention indefinitely —
  flagged, not decided.

## Recommended approach when this gets picked back up

- Keep everything metafield-driven — no data migration needed, Horizon reads
  the exact same `accentuate.*` / `custom.*` fields live already uses.
- Match the guard pattern already established (Profile, FAQs): each section
  is a hard no-op when its data is blank, so partial content across ~150
  products never breaks a page.
- Verify every new block against several real products before calling it
  done — presence is inconsistent (Profile: yes; FAQs: mostly yes; Origin/
  Sourcing: no on the one product checked so far). Don't assume Raspberry
  Candy is representative.
- Re-sequence once more sections land — live's order is Profile → Sourcing →
  Image slider → Origin → Brew guide → FAQs → Recommendations; our dev theme
  currently only has Profile → FAQs → Recommendations.
- Brew guide deserves its own isolated test pass given the handle-format
  question above — confirm the matching logic explicitly (including the
  case where `select_artlice` points at an article that doesn't exist) before
  trusting it.
