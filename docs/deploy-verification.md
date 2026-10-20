# After every deploy, check these

The GitHub → Shopify sync has silently dropped individual files **four times** on
2026-10-20 alone (#201, #204, #223, #227). Merged is not deployed. Worse, the
theme editor writes to the same files from the other side, so a push can also
*remove* work nobody in git knows about — that is how ten editor-made sections
were lost on 2026-10-14.

So this is not ceremony. Each row below is something that has already broken, or
would silently revert without anyone noticing.

## 0. Two checks that come before the list

**Did the file actually land?** Merge state tells you nothing. Ask the theme:

```
theme(id: "gid://shopify/OnlineStoreTheme/154676789439") {
  files(filenames: [...]) { nodes { filename size checksumMd5 updatedAt } }
}
```

`updatedAt` older than the merge means the sync dropped it. Re-push that file.

**Before editing a shop-owned file, is the repo still level with the theme?**
`templates/index.json`, `templates/product.json`, `templates/page.location.json`
and `config/settings_data.json` are edited in the admin. Compare `checksumMd5`
against the repo copy *first*; if they differ, pull the theme's copy and build
on that. Note the storage quirk: Shopify stores these minified but
`body.content` always returns them pretty, so compare against both forms —
minified with `/` escaped as `\/`.

## 1. Product pages

| What | Where | Passes when |
| --- | --- | --- |
| Brew Guide tab appears | `/products/aspen` | Tab present, intro + spec table, "Full brewing guide" links to `/blogs/brewguides/aspen` |
| Brew Guide tab **hides** | `/products/ona-coffee-canberra-mug` | No Brew Guide tab at all — not an empty one |
| Brew Guide with no article | `/products/drip-bag-filter-op1-q2` | Tab and specs show; no link (that product has no `select_artlice`) |
| Profile tab is its own copy | `/products/aspen` | Profile body ≠ the description in the details column, and reads as prose — raw `{"type":"root"` means the rich text lost its `metafield_tag` |
| Empty tabs pruned (#236) | any PDP | No tab opens a blank panel; tab strip numbering still selects the right panel |
| Coffee quiz still present | any PDP | The quiz section renders — it exists only in the theme's copy of `product.json` |
| Sticky Add to cart | any PDP, scroll past the real button | Appears. Do **not** "fix" this; it works |

## 2. Pages

| What | Where | Passes when |
| --- | --- | --- |
| Legacy pages get their stylesheet | `/pages/faq` | `.container` at left=118, width=1440 on a 1686px viewport — the same as the Horizon section beside it |
| Legacy type is on the token scale | `/pages/about` | H1 56 / H2 48 / H3 32 / body 14, matching the homepage |
| Venue tablist | `/pages/locations` | Venue names are buttons; picking one swaps the panel; arrow keys move |
| One slide at a time | `/pages/wholesale` | Testimonials and `supported` show one slide, not all stacked |
| Contact details | `/pages/contact` | Email, phone, address and hours all present; "get in touch" appears once |
| llms.txt | `/pages/llms` | Plain text, ~4KB, no product links |

## 3. Footer and global

| What | Where | Passes when |
| --- | --- | --- |
| Column proportions | any page | Four columns at 1fr / 1fr / 4fr / 3fr, not equal widths |
| Article hero crop | `/blogs/brewguides/bruma-colombia-washed` | Image is not cropped tighter than the collection cards |

## 4. What to do when something is missing

1. Check the file's `updatedAt` on the theme (section 0). A dropped file is the
   single most common cause and is not visible in git.
2. If the file did land, check whether the theme editor overwrote it — compare
   against the repo copy and look for sections the repo does not have.
3. Only then look for a bug in the change itself.

Never fix a sync drop by hand-editing the theme: that widens the gap between
git and the theme, which is the thing that caused the 2026-10-14 loss.
