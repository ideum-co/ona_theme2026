# Theme `160815546559` — the two files that exist only here

> **Do not delete theme `160815546559`.** It was on the clean-up list as a
> leftover preview. It has been the **published** theme since
> 2026-10-14 22:00:42Z.

Pulled 2026-10-15. Theme `160815546559` is named "PREVIEW - product media fills
column (PR #46)", was created 2026-10-13 as a one-off preview for
`onacoffee_theme` PR #46, and is **not connected to any GitHub branch** — so
nothing but the theme itself holds its state.

File by file it is byte-identical to the pre-cutover theme `160335790271`
across every template and across `config/settings_data.json`, except three
files. Two of them are archived here; the third, the PR #46 change to
`snippets/product-media-gallery-content.liquid`, is recoverable from
`onacoffee_theme` because that PR is merged.

| file | here | on `160335790271` |
|---|---|---|
| `product.filtersub.json` | `dc8be58f3ddd176996e89782d005d61e`, **12,780 b**, 9 sections | `3a78daf74e8e733cfb2a31ebae28f3c3`, 6,596 b, 8 sections |
| `index.json` | `fc0a8aa9fc0c4953dd830f99b2e56f91`, 47,109 b, 23 sections | `334174f366862c2ac74a396c30950f06`, 47,079 b |

(As in `../legacy-page-templates/`, the checksums are the theme's own, taken over
the minified bytes it stores. The Admin API returns the file pretty-printed with
a generated banner, so `md5sum` of the copy here will not match.)

## `product.filtersub.json` — why this one matters

It is the **only** copy of the subscription PDP that carries a cross-sell row:

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
