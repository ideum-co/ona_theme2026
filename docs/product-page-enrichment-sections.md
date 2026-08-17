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
- **Data does not live on the product.** The product only stores a pointer:
  `accentuate.select_artlice` (plain string, e.g. `"brewguides/raspberry-candy"`).
  The live section loops every article in a *Shopify Blog* named `brewguides`
  looking for `article.handle == target_handle`.
- **Format inconsistency found**: the stored pointer value includes a
  `"brewguides/"` prefix, but real article handles in that blog are bare
  (`"raspberry-candy"`, `"maple"`, etc. — confirmed via the blog's actual
  article list). A literal `article.handle == target_handle` comparison
  should never match by that reading — and yet it empirically works
  correctly on live (verified Raspberry Candy and Maple show genuinely
  different, correct brew specs). Didn't chase down why; when this gets
  built, use `target_handle | split: '/' | last` defensively so the port
  isn't relying on unexplained behavior.
- The article itself carries `accentuate.content_brew_guide` (heading/intro
  HTML) plus two **parallel arrays**, `title_item` and `content_item` — the
  spec table (Age best used / Dose / Yield / Temperature / etc.) is built by
  zipping these two arrays together by index, not from named fields.
- One brew guide article per product confirmed (not shared/reused across
  products, at least in the 5 sampled) — so this is a real per-product
  content type, not a small shared set.
- Horizon note: Liquid supports direct handle-indexed article lookup
  (`blogs.brewguides.articles[handle]`), which would replace live's
  loop-over-500-articles with a single lookup — worth doing this way rather
  than porting the loop verbatim.

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
