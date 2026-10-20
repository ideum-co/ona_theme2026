# Home page design assets — extracted 2026-10-20

Source: `Web 1920 – 1.svg` (57.7 MB Figma export, 1920 x 11814), from
`formswell_26_09_29-ona-bag-animation-small-mp4_2026-09-29_0609/`.

20 embedded images, mapped to home-page blocks by their position on the
artboard, deduplicated, and resized to web masters.

**41.2 MB -> 4.33 MB (89% smaller).** Nothing was upscaled. Masters are 2x the
size each image is actually drawn at on the 1920 artboard, floored at 1200px on
the long edge and capped at 2400px — Shopify resizes down from the master, so
an 8000px source was pure waste.

| block | file | drawn at | master |
|---|---|---|---|
| Hero | `01-hero__17190655-hd-1920-1080-24fps.jpg` | 1928x1085 | 1920x1080 |
| Hero | `01-hero__santuario-sul-90.jpg` | 818x785 | 1636x1091 |
| Find your Coffee | `02-coffee-quiz__ona-coffee-quiz.jpg` | 711x1070 | 2140x1717 |
| Coffee spotlight | `03-coffee-spotlight__gallery-1-*.jpg` | 470x465 | 400x599 |
| Coffee spotlight | `03-coffee-spotlight__coffee-hero-sof-*.png` | 241x394 | 735x1200 |
| Coffee spotlight | `03-coffee-spotlight__coffee-hero-sr-*.png` | 241x394 | 735x1200 |
| Coffee spotlight | `03-coffee-spotlight__maple-*.png` | 232x379 | 735x1200 |
| Special release | `04-special-release__ugly-web.jpg` | 1021x791 | 2042x1459 |
| Subscribe & Save | `05-subscribe-save__ona-pewpewstudio-*.jpg` | 1762x730 | 1600x2400 |
| The sweet spot | `06-sweet-spot__26-09-29-ona-bag-animation-small.jpg` | 2245x1263 | 1920x1080 |
| More than coffee | `07-about__untitled.jpg` | 1522x873 | 1500x1001 |
| Learn with ONA | `08-learn-with-ona__*-251875 / -251658 / -252080.jpg` | 424x391 | 1200x800 |
| Find ONA | `09-find-ona__lr-260820-ona-pewpew-251790.jpg` | 1021x791 | 1200x800 |
| Discover by category | `10-discover-category__*.jpg` (5) | 309x309 | 1200 long edge |

## What was merged

- **`gallery-1` was placed three times** (once per Coffee spotlight card) with an
  identical payload. Extracted once, not three times.
- **The portrait's alpha channel was dropped.** `07-about` shipped as a 0.93 MB
  PNG whose alpha was only 0.2% non-opaque — a soft edge, not a cut-out. Flattened
  onto white as JPG: 0.93 MB -> 0.11 MB.
- The three bag cut-outs **kept** their alpha (5.2% transparent each — genuine
  cut-outs) and stayed PNG.

## Not merged, deliberately

The Coffee spotlight cards are each a cream `#f5f4ea` rectangle + a bag cut-out,
with `gallery-1` as a second state. They *could* be flattened into three finished
card images — but those are **product** shots, and in the theme a product card
pulls its image from the Shopify product, not from a theme asset. Flattening them
would bake a product photo into the design. Left as layers; see the open question.

## The sweet spot block is a video

`06-sweet-spot__...jpg` is only the first frame. The real asset is the sibling
file `26_09_29 ONA bag animation SMALL.mp4` (3.2 MB), which was not embedded in
the SVG.

---

# Format decision: PNG, SVG or JPEG?

Answered per image type, not per file. Both claims below were tested against
Shopify's own CDN on 2026-10-20, not taken from memory.

## Shopify already does the hard part

The CDN content-negotiates. Same URL, different `Accept` header:

| Accept | served | bytes |
|---|---|---|
| `image/webp,*/*` | **image/webp** | 138,276 |
| `*/*` | image/png | 1,465,495 |

That is **91% smaller for free**, and `&width=` transforms still negotiate.
AVIF is *not* served — asking for it returns WebP.

**WebP keeps the alpha.** The same cut-out measured 5.3% transparent pixels and
an alpha range of 0-255 in both the PNG and the CDN's WebP. So a PNG master with
transparency reaches visitors as WebP-with-transparency automatically.

The conclusion: upload good masters and let the CDN do the rest. Do not
hand-generate WebP, do not ship AVIF, do not upload 8000px sources.

## The rule

| what it is | format | why |
|---|---|---|
| photographs (15 here) | **JPEG** master | SVG cannot represent a photo; PNG is ~10x larger for no gain. CDN serves WebP. |
| cut-outs on transparent backgrounds (3 bags) | **PNG** master | Alpha is genuinely needed — 5.2% transparent pixels each. CDN serves WebP with alpha intact. |
| logos, icons, badges, wordmarks (12 here) | **SVG** | They were vector in the design. Scale to any size, recolour with `currentColor`, ~9 KB each. |

## Before keeping a PNG, check the alpha is real

`07-about` arrived as a 0.93 MB PNG whose alpha was **0.2% non-opaque** — a soft
edge, not a cut-out. Flattened to JPEG it is 0.11 MB. An unused alpha channel is
pure weight; measure before assuming.

## vector/ — 12 assets, 109 KB total

These were vector all along and were being thrown away by raster-only
extraction.

| asset | size |
|---|---|
| `ona-logo-mark.svg` | 49x78 |
| `ona-coffee-wordmark.svg` | 245x24 |
| `badge-new-harvest-sale.svg` | 219x219 |
| `badge-ona-brew-club.svg` | 360x228 |
| `icon-benefit-freshly-roasted.svg` | 100x149 |
| `icon-benefit-new-releases.svg` | 111x120 |
| `icon-benefit-flexible-delivery.svg` | 180x98 |
| `press-broadsheet.svg` | 357x37 |
| `press-espresso-room.svg` | 242x55 |
| `press-logo-3.svg` | 166x59 |
| `icons-social.svg` | 131x24 |
| `icons-header-utilities.svg` | 91x24 |

Each carries only the `<defs>` it actually references — pruning dropped the set
from 180 KB to 109 KB — and all twelve were re-rendered after pruning to confirm
they still draw.

## Where each kind belongs

- **SVG -> the theme's `assets/`**, where Liquid can inline it with
  `{{ 'name.svg' | inline_asset_content }}`. That is how the theme already ships
  `icon-caret.svg` and `icon-plus.svg`: no extra request, and the artwork inherits
  CSS colour. Uploading SVG to Content > Files is restricted on some stores —
  worth confirming before relying on it, whereas `assets/` always works.
- **JPEG/PNG chosen in the theme editor -> Content > Files.** Section and block
  image pickers read from there, and that is what makes them swappable without a
  deploy.
- Do not put editor-selectable photography in `assets/`: it then needs a code
  change to swap.
