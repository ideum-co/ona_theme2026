# Theme `160815546559` — the published theme's distinguishing files

> **Do not delete theme `160815546559`.** It was on the clean-up list as a
> leftover preview. It has been the **published** theme since
> 2026-10-14 22:00:42Z.
>
> Deleting it would not now destroy unique work — see the table below, which
> corrects an earlier claim in this file — but it would unpublish the
> storefront.

Pulled 2026-10-15. Theme `160815546559` is named "PREVIEW - product media fills
column (PR #46)", was created 2026-10-13 as a one-off preview for
`onacoffee_theme` PR #46, and is **not connected to any GitHub branch** — so
nothing pulls into it and no merge can update it.

**Only one of the files here is theme-only.** This directory was created on the
belief that two were; the table below, added after checking, shows that
`product.filtersub.json` and the media snippet are byte-identical to
`onacoffee_theme` and that `index.json` alone has no counterpart. The copies are
kept anyway — they are a cheap, dated snapshot of exactly what the storefront
served — but **do not treat this directory as a sole surviving copy.**

File by file it is byte-identical to the pre-cutover theme `160335790271`
across every template and across `config/settings_data.json`, except three
files — and **two of those three are in the `onacoffee_theme` repository,
byte for byte**:

| file | on this theme | in `onacoffee_theme` `origin/main` | theme-only? |
|---|---|---|---|
| `snippets/product-media-gallery-content.liquid` | `0f4cdc15f57172c6924072156c688ec5`, 36,795 b | **identical** | no |
| `templates/product.filtersub.json` | `dc8be58f3ddd176996e89782d005d61e`, 12,780 b | **identical** | no |
| `templates/index.json` | `3a34348d83ba0c51337436fdb357dc95`, 47,077 b (re-pulled 2026-10-15 after a further edit) | `c73c60f976ac6a3058ea1a027202291d`, 53,823 b — **stale**, see §"The homepage divergence is a live campaign" | **yes** |

So the live theme is, in substance, **`onacoffee_theme`'s `main` plus the theme
editor's own homepage settings**. Only `index.json` is genuinely unrecoverable
from a repository — and that phrase undersells it, so read the next section
before treating it as cosmetic.

## The homepage divergence is a live campaign, not a settings nicety

Re-audited 2026-10-15. Every file on this theme was written by the bulk copy at
01:45–01:47Z on 2026-10-13 **except four**, and the audit of all four is in
`docs/manual-theme-work-2026-10-15.md`. Three are accounted for in a repository.
The fourth is `templates/index.json`, last edited **2026-10-15T01:01:41Z**, and
the edit is the homepage's **In Sequence** banner:

| setting | before (what `onacoffee_theme` still holds) | live now |
|---|---|---|
| `disabled` | `true` — the slide was switched off | **absent → the slide is live** |
| `title2` | `Drop What You're Doing` | **`In Sequence`** |
| `content` | `Aftterpay day is here! Spend $125+ and receive a gift` | **`Experience Ethiopian coffee through processing methods`** |
| `button_link` | `shopify://collections/all` | **`shopify://products/in-sequence`** |
| `bg` / `bgmb` | `Afterpay_top_ban.png` / `Afterpayday_mob2.png` | **`Inseq3nce_top.png` / `Insekmob.png`** |
| `button_bg_colour` | `#f8bfd8` | **`#702429`** |

It is the **first section on the homepage** (`ona-banner-slider`, slide
`image_picker_WzjDbw`), it renders — verified in the served HTML, which carries
`Inseq3nce_top_1920x.png` and `<a href="/products/in-sequence" …>Shop Now</a>` —
and it exists in **no repository**:

- `onacoffee_theme` `origin/main` still has the **Afterpay** slide, **disabled**
- `ona_theme2026` has **no `ona-banner-slider` section at all**, and no
  reference to `in-sequence` or the `Inseq*` images anywhere in the tree

**So "port the page templates from `onacoffee_theme`" is right for pages and
wrong for `index.json`.** For the homepage, this directory's copy — refreshed
2026-10-15 and byte-verified against the theme — is the newest artifact that
exists. The pre-cutover theme `160335790271` carries the same banner but with
**older copy** (`explore Ethiopian coffee through four processing methods`),
which is the single leaf separating the two themes' homepages.

> **Correction.** An earlier version of this README, and §13 of the review, said
> that two files existed only on this theme and that `product.filtersub.json`
> was "not in either repository". **Both statements were wrong** — Codex raised
> the checksum inconsistency that led to checking, and `onacoffee_theme` holds
> both files unchanged. The practical consequence is smaller than it looked:
> port `filtersub` from `onacoffee_theme`, not from a theme export.

### What the checksums actually tell you

The two numbers in the table above are both honest, and the difference between
them is the useful part:

- `product.filtersub.json` and the media snippet have a theme `checksumMd5`
  that **equals `md5sum` of the copy here**. The Admin API returned exactly the
  bytes the theme stores, banner and indentation included.
- `index.json` does **not** match: **47,077 b** on the theme against
  **65,305 b** here. The theme stores it minified and the API pretty-printed it
  on the way out. (Both numbers moved when the file was re-pulled on 2026-10-15;
  the earlier 47,109 / 65,349 pair described the pre-In-Sequence snapshot.)

That is the same signal the GitHub integration gives: **a file whose checksum
matches the bytes you hold was written by a repository; one whose checksum does
not was written by the theme editor.** Here it correctly identifies
`index.json` as the editor's and the other two as the repo's.

Local hashes of the copies in this directory, for integrity checking:

| file | `md5sum` here | bytes |
|---|---|---|
| `product.filtersub.json` | `dc8be58f3ddd176996e89782d005d61e` | 12,780 |
| `index.json` | `5468f4dc16f6090da7ce6d48479fd50f` | 65,305 |

> Re-pulled 2026-10-15. **Re-run `md5sum` on this directory whenever
> `index.json` is refreshed** — an integrity table that still describes the
> previous snapshot rejects the archive it is meant to vouch for, which is worse
> than having no table.

## `product.filtersub.json` — why this one matters

It is the subscription PDP that carries a cross-sell row — **and the same file
is in `onacoffee_theme` on `origin/main`, byte for byte**, so port it from
there rather than from this archive:

```
main · profile(off) · sourcing(off) · image_slider(off) · origin(off)
brew_guide(off) · accordion · complementary · recommendations
```

The 6,596 b version on `160335790271` is the same list **without
`ona-product-complementary`**.

`docs/cross-sell-and-forward-compatibility.md` measures `filtersub` as the
store's **highest-attach page — 8.05%, 5.7× baseline** — and records that it had
no complementary entry at all while its metafields were already curated. That
gap is closed on the live theme today, by this file, and by nothing else:
the 2026 theme's single `templates/product.json` sets
`recommendation_type: "related"` and has no complementary section anywhere.

### It also settles a conflict recorded on PR #150

The migration map's §3.3 table listed live's `filtersub` as containing
*complementary*; `cross-sell-and-forward-compatibility.md` said it contained
none. Neither could be checked from git, so the cross-sell document was taken
as authoritative and the claim was removed from the table.

**Both were right about different themes.** `160335790271` — live until
2026-10-14 15:43Z — has 8 sections and no complementary, exactly as the
cross-sell document says. `160815546559` — live since 22:00:42Z — has 9 and
does. The section was added on the preview theme on 2026-10-13 (`updatedAt`
03:43:42Z). The cross-sell document's measurement stands; the map's table was
describing the newer artifact.

## What to do with these

Port `ona-product-complementary` into whatever the subscription PDP becomes.
Whether the 2026 theme keeps a dedicated `product.filtersub.json` or folds
subscriptions onto the shared PDP, the complementary row has to come with it —
that decision is open in the migration map, but the requirement is not.
