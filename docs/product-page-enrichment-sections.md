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
`brew_guide`) pull from a legacy app's metafield namespace (`accentuate.*`).
That's the part worth documenting before anyone tries to port this in a
hurry.

> **Corrected 2026-10-15.** This paragraph used to end "and **one of them — brew
> guide — doesn't even read from the product itself**", which is wrong and sent a
> PR review off designing the whole renderer around an article lookup. Measured
> across all 92 active products: the product owns **both** the brew-guide intro
> (`content_brew_guide`) and the spec table (`title_item`/`content_item`), each on
> **32** products. The article is the **link target only** — `select_artlice` on
> **24** products resolves the "Full brewing guide" href and nothing else. Render
> the intro and the table unconditionally; make only the link conditional on the
> lookup succeeding, or the 8 table-bearing products with no pointer lose content
> they have. See §2.

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
> article lookup. **Neither does the intro:** `content_brew_guide` is product-owned
> and populated on the same 32 products. What the pointer adds is **the "Full
> brewing guide" link, and nothing else** — and it is a narrower surface:
> `select_artlice` is on only **24** products, absent on every drip bag that has a
> spec table. So render the intro and the table unconditionally and make only the
> link conditional on the lookup; gating the intro on the pointer drops it for the
> 8 products that have it. Everything below about the pointer applies to the link.
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
  - **Never strip the prefix.** `article.handle` in Liquid is itself compound
    ([docs](https://shopify.dev/docs/api/liquid/objects/article), e.g.
    `potion-notions/how-to-tell-if-you-have-run-out-of-invisibility-potion`), so the
    stored `brewguides/maple` is the correct form for *both* access patterns.
  - **Direct lookup (preferred): `articles[pointer]`, prefix intact.** One lookup,
    no loop over 747 articles.
  - **A loop also works unchanged:** `a.handle == raw_handle` compares compound with
    compound. This is why live works, and two earlier versions of this file were
    wrong about it — first recommending a "defensive" `| split: '/' | last`, then
    scoping that strip to the loop case. Either would have broken all 24 matches.
    (Codex, PR #150.)
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
  a single lookup instead of live's loop over 747 articles, which is also capped at
  the first page by its `paginate ... by 250`. Note this is `articles[...]`, **not**
  `blogs.brewguides.articles[handle]`, which an earlier version of this bullet
  recommended: `blog.articles` is an array, and the handle-indexed form is the global
  one keyed by the compound handle.

### 3. Origin — NOT PORTED, **pre-publish** (prevalence measured 2026-10-15)
- Source: `accentuate.image_origin` (single raw image URL) +
  `accentuate.content_origin` (rich HTML).
- **Prevalence: 25 of 92 active products.** The bulk query this section used to
  ask for is done, and the answer changes the priority: this is no longer "low
  priority pending a check", it is pre-publish work. See §4 — Origin and
  Sourcing turn out to be **one** populated set, not two.
- **Blank on Raspberry Candy** — confirmed via direct query, both fields
  null. Whatever farm/lifestyle imagery appeared on Raspberry Candy's live
  page was actually the Profile block's `image_coffee_profile_1`/`_2` and
  the Image Slider photos, not a separate Origin section — corrected this
  assumption mid-investigation.
- Raspberry Candy is genuinely outside the 25, so it was not a measurement
  error — but it *was* unrepresentative, which is the trap this document's own
  closing note warns about. One blank product is not a prevalence check.

### 4. Sourcing / "Story" — NOT PORTED, **pre-publish**; one set with Origin
- Source: `accentuate.content_sourcing` (rich HTML) + flat fields
  `producer` / `region` / `varietal` / `process` / `altitude`.
- **Measured 2026-10-15 across all 92 active products: Origin and Sourcing are a
  single populated set.** On the same **25** products, every one of
  `content_origin`, `content_sourcing`, `image_origin`, `producer`, `region`,
  `varietal`, `process` and `altitude` is present; on the other 67, none is.
  There is no product with one and not the others.
- So this is **one** destination decision for a structured spec block plus an
  image, not two independent rich-text ports — and the flat specs are the half
  most likely to be dropped, because the prose is the part anyone notices
  missing. In this theme the prose and the specs are read only by the **disabled**
  `story` section, and `image_origin` has **no renderer at all**.
- Also blank on Raspberry Candy, consistent with it being outside the 25.

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
