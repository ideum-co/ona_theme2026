# Manual work on the published theme — audit, 2026-10-15

**Question asked:** the live theme has had hand work done on it — banners and
other small things. What exactly, and would publishing `ona_theme2026` lose it?

**Answer:** four files carry a hand edit. Three are already in a repository and
are safe. **One is not: the In Sequence homepage banner, which is running right
now and exists in no repository.** Publishing the 2026 theme as it stands
removes it, because that theme has no banner slider at all.

---

## Method — why this list is complete

Theme `160815546559` was created by a bulk copy, and every file it received in
that copy carries a timestamp between **2026-10-13T01:45:01Z and 01:47:11Z**.
So any file with a later `updatedAt` was written by hand afterwards. Every
directory in the theme was enumerated through the Admin API — `assets/`,
`blocks/`, `config/`, `layout/`, `locales/`, `sections/`, `snippets/`,
`templates/` — and the timestamps compared. Nothing was sampled.

This is a derived set, not a remembered one: the rule is "later than the copy
window", applied to the whole file list, so a hand edit cannot hide in a
directory nobody thought to look in. `sections/` and `layout/` came back
completely clean, which also rules out an edited header, footer or announcement
bar.

## The four files

| file | edited | what it is | in a repository? |
|---|---|---|---|
| `templates/index.json` | **2026-10-15T01:01:41Z** | **the In Sequence homepage banner** | ❌ **no — see below** |
| `assets/main.min.css` | 2026-10-13T04:00:06Z | the PR #46 PDP bag-area media CSS | ✅ `onacoffee_theme` `origin/main`, **byte-identical** (`4fd651d8…`, 467,098 b) |
| `templates/product.filtersub.json` | 2026-10-13T03:43:42Z | adds the `ona-product-complementary` section | ✅ `onacoffee_theme` `origin/main`, **byte-identical** (`dc8be58f…`, 12,780 b) |
| `snippets/product-media.liquid` | 2026-10-13T01:56:43Z | edited, then reverted | ✅ nothing to port — **byte-identical to the pre-cutover theme** (`a8a5c805…`, 7,186 b) |

Each "byte-identical" above is a checksum comparison, not an inspection. The
CSS was additionally downloaded from the CDN and its md5 checked against the
Admin API's reported checksum for both themes before diffing, so the diff below
is of verified bytes.

### `config/settings_data.json` is unchanged

`dc554228f3ea46bfbbdfc3dc8bd32c9c`, 22,183 b — identical to the pre-cutover
theme. The ten app embeds are intact on the live theme. (They are absent on the
*2026* theme; that is review finding §4, a separate matter.)

---

## The one at risk: the In Sequence banner

Homepage section `1625134640d9c801e4`, type **`ona-banner-slider`** — the
**first section on the page** — slide `image_picker_WzjDbw`.

| setting | `onacoffee_theme` `origin/main` | live now |
|---|---|---|
| `disabled` | `true` | **absent → live** |
| `title2` | `Drop What You're Doing` | **`In Sequence`** |
| `content` | `Aftterpay day is here! Spend $125+ and receive a gift` | **`Experience Ethiopian coffee through processing methods`** |
| `button_link` | `shopify://collections/all` | **`shopify://products/in-sequence`** |
| `bg` | `Afterpay_top_ban.png` | **`Inseq3nce_top.png`** |
| `bgmb` | `Afterpayday_mob2.png` | **`Insekmob.png`** |
| `button_bg_colour` | `#f8bfd8` | **`#702429`** |

Unchanged in that slide: `button_text` "Shop Now", `button_style` filled,
`button_size` medium, `button_text_colour` `#ffffff`, `button_text_size` 16,
`image` `Blank.png`.

**It renders.** Verified in the HTML the storefront served, not inferred from
the JSON: the page preloads `Inseq3nce_top_1920x.png` (desktop) and
`Insekmob_828x.png` (mobile) and emits
`<a href="/products/in-sequence" class="slider-button filled medium" style="… background-color: #702429 …">Shop Now</a>`.
The CTA has a destination — unlike the three dead CTAs in review §6.

The slider has **three active slides** in this order; the other two are
unchanged from the pre-cutover theme and are evergreen rather than campaign:

1. **In Sequence** → `/products/in-sequence` *(the one at risk)*
2. "We fuel your café vision with expertise and care" → `/pages/wholesale`
3. "Elevating your coffee experience, one cup at a time" → `/collections/all`

Three further slides in the same section are `disabled`.

### Where it exists, and where it does not

| artifact | state |
|---|---|
| live theme `160815546559` | **In Sequence, enabled, current copy** ← the only current one |
| pre-cutover theme `160335790271` | In Sequence, enabled, **older copy**: `explore Ethiopian coffee through four processing methods` |
| `onacoffee_theme` `origin/main` | **Afterpay slide, `disabled: true`** — stale |
| `ona_theme2026` (this repo) | **no `ona-banner-slider` section exists**; no `in-sequence` or `Inseq*` reference anywhere in the tree |
| `docs/live-theme-160815546559/index.json` | refreshed 2026-10-15, byte-verified against the theme |

Two consequences worth stating plainly:

- **The general rule "port from `onacoffee_theme`" does not hold for
  `index.json`.** It holds for the page templates — that was established on
  2026-10-15 and is why `docs/legacy-page-templates/README.md` sends porting
  there. For the homepage, `onacoffee_theme` is *behind the theme*, and
  following the rule blindly would restore an expired Afterpay promotion in a
  disabled state.
- **The single leaf separating the two live-candidate themes is this banner's
  subtitle.** A rollback from `160815546559` to `160335790271` keeps the banner
  but reverts the wording to `explore Ethiopian coffee through four processing
  methods`. That is the whole difference between the two homepages — confirmed
  by a full leaf-level diff: 23 sections each, identical order, one differing
  leaf.

### What has to happen before the 2026 theme is published

1. **Decide whether the campaign is still running.** It links a single product,
   so it will expire. If it is over, nothing needs porting and this becomes a
   note. Nobody should guess this from the theme — ask.
2. **If it is still running, it has to be rebuilt in Horizon.** This is not a
   settings copy: `ona-banner-slider` is a legacy section type that
   `ona_theme2026` does not define, so there is no block to paste settings into.
   The images are shop-level Files (`Inseq3nce_top.png`, `Insekmob.png`) and are
   already uploaded, so only the slide needs building.
   **Where it could go.** The 2026 homepage opens with `hero_ona` (type `hero`) —
   which is review finding §1, the flat grey block — followed by the WFG counter
   and a floating badge. There is no slider at the top to drop a slide into. The
   closest existing host is **`special_release`** (`media-with-content`, position
   5, currently **disabled**), which is shaped for exactly this: one image, a
   heading, a line of copy and a CTA. Enabling it costs nothing against the
   25-section cap, because it is already one of the 25. That is a suggestion for
   whoever builds it, not a decision — and it puts the campaign below the fold,
   which is a real difference from today's placement at the very top.

3. **Whoever publishes should re-read `templates/index.json`'s checksum
   immediately beforehand.** The editor has now moved this file on 10-13 and
   again on 10-15; the copy in this repo is a snapshot, and a snapshot of an
   actively-edited file goes stale without announcing it.

---

## What this audit does *not* cover

Shop-level configuration is not theme state and survives a theme swap, so it is
out of scope here and was not re-verified beyond the checks noted: navigation
menus, product and collection metafields, Shopify Files, and the shop
metafields. Of those, only the Water For Good values were read
(`custom.donation_total` = `11792.0`, written 2026-10-14T22:52:19Z — intact),
because the campaign surfaces depend on them. No promo-related shop metafield
exists in the `custom` namespace.

No announcement bar is configured: `sections/header-group.json` holds only
`ona-header` with its two menus, and it is untouched since the bulk copy.
