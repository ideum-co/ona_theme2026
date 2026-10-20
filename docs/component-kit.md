# The component kit

Which components the pages get rebuilt **with**. This is the missing half of
stage 2 in [page-design-structure.md](page-design-structure.md): that document
says to replace legacy section internals with Horizon blocks and sets the rules;
this one names the parts and maps every legacy section onto one.

Written 2026-10-20 from the page reviews, measured against the live theme
(`ona_theme2026/main`, id 154676789439, Horizon 4.1.4).

## What the reviews actually found

The theme ships **44 `ona-*` sections**. Thirty-five are used; **every one of
those is used exactly once**, on exactly one page. Nine are used nowhere at all.

That is the whole diagnosis. They are not components — they are one-off page
fragments. The old theme had no block model, so each layout variant became
another section file, and the port carried all of them across.

Read their schemas side by side and the duplication is literal:

| Identical schema | Copies | Which |
| --- | --- | --- |
| `id, image, title, subtitle, content, button_text` + one `block` | **10** | `ona-sourcing`, `ona-wholesale-sourcing-v2…v6`, `ona-traning-sourcing`, `-v2`, `-v3`, `-v4` |
| `id, title, content, slider_autoplay` + `slider`,`block` | 2 | `ona-supported`, `ona-traning-supported` |
| `id, title, …, content` + one `block` (quote carousel) | 2 | `ona-wholesale-testimonial`, `ona-cafe-testimonial` |
| `title2 / content / image` in some order | 6 | `ona-training-image-text`, `-text-two-images`, `-text-image-bg`, `ona-wholesale-partnership`, `ona-expericences-content`, `ona-training` |
| a heading and nothing else | 3 | `ona-page-title`, `ona-sr-heading`, `ona-training-banner` |

Ten copies of one component. Six of another. **Thirty-five sections collapse to
about eight real ones**, and Horizon already ships seven of the eight.

Alongside that, three kinds of drift the reviews measured across all 116
sections in `templates/*.json`:

- **38 blocks sit on `type_preset: "custom"`** — more than any real preset
  (`paragraph` 19, `rte` 17, `h2` 17, `h4` 14). Each one opts out of the type
  scale and restates a size; there are **11 distinct literal `font_size`
  values** in the templates.
- **19 distinct padding values** between sections: 0, 4, 8, 10, 12, 16, 20, 24,
  32, 40, 48, 60, 64, 72, 80, 96, 100, 120, 152. On the homepage every
  inter-section gap is 0 and all rhythm is internal padding, so these 19 values
  *are* the vertical rhythm.
- **8 `custom_liquid` blocks carry an inline `<style>`** — `collection.json` ×3,
  `index.json` ×1, `product.json` ×4. Two of the four in `product.json` are
  superseded by #243.

## The kit

Eight components. Seven are Horizon's own or already Horizon-native here; one
has to be written.

| # | Component | What it is | Replaces |
| --- | --- | --- | --- |
| 1 | `section` + `group`/`text`/`image`/`button`/`spacer` | Horizon's generic container. Already the most-used thing in the theme: `text` ×78, `group` ×34, `button` ×14, `image` ×11. | anything that is just stacked copy |
| 2 | `media-with-content` | media slot + content slot holding arbitrary theme blocks. Already on the homepage three times. | the **10** `*-sourcing-v*` clones and the **6** media/text variants |
| 3 | `press-quotes` | quote carousel: logo, quote, attribution, arrows when blocks outnumber columns | `ona-wholesale-testimonial`, `ona-cafe-testimonial` |
| 4 | `ona-faq-layout` | already Horizon-native, styles itself, takes `_faq-category` blocks | `ona-faq-lists`, the FAQ half of `ona-expressions` |
| 5 | `ona-page-media-gallery` | already Horizon-native, styles itself | ad-hoc image grids |
| 6 | `slideshow` | Horizon's `_slide` carousel | the `slider` blocks in `ona-supported`, `ona-exclusive-access`, `ona-expressions` |
| 7 | `marquee` | takes `text`, `icon`, `logo`, `_divider`; currently unused | `ona-wholesale-brands` (a logo wall) |
| 8 | **a page-header section** — *to write* | eyebrow, heading, optional sub-copy, optional visually-hidden variant | `ona-page-title`, `ona-sr-heading`, `ona-training-banner` |

Nothing else should be added. A ninth component needs an argument, not a page.

### Why `media-with-content` carries the weight

Every `*-sourcing-v*` section hard-codes image-left-or-right, a heading, copy
and a button. `media-with-content` is that, as settings:
`media_position`, `media_width_ratio`, `content_distribution`,
`mobile_content_first`, plus a content slot. The homepage's `find_ona` already
proves the shape:

```
find_ona :: media-with-content
  media   :: _media-without-appearance
  content :: _content-without-appearance
    group :: group
      heading / subheading / text (text blocks, with spacers between)
    button :: button
```

Ten sections become ten instances of one section, and a merchant can edit all
of them in the theme editor — which is stage 2's own test, and which a ported
`ona-*` section fails.

### The one to write

`sections/page-header.liquid`. Not a port: Horizon has no page-title section,
and three different legacy ones exist because the old theme needed three. One
section with an `eyebrow`, a `heading`, optional `subheading`, and a
`visually_hidden` toggle covers all three, including `ona-sr-heading`'s job of
giving a page an H1 that does not show.

## Page by page

Stage per page stays as [page-design-structure.md](page-design-structure.md)
sets it. This is what stage 2 means for each.

| Page | Sections now | After | The work |
| --- | --- | --- | --- |
| `/pages/wholesale` | 19 (all legacy) | ~10 | five `*-sourcing-v*` → `media-with-content`; testimonials → `press-quotes`; `ona-wholesale-brands` → `marquee`; `ona-faq-lists` → `ona-faq-layout`; `ona-gust-r`'s native `/contact` form stays as is |
| `/pages/barista-courses` | 10 (all legacy) | ~6 | four `traning-sourcing-v*` → `media-with-content`; `ona-traning-supported` → `slideshow`; banner → page-header |
| `/pages/about` | 7 (all legacy) | ~5 | media/text variants → `media-with-content`; gallery → `ona-page-media-gallery` |
| `/pages/learn` | 2 | 2 | `ona-page-title` → page-header; `ona-brewguides-and-training` → `section` + `_product-card`-style tiles |
| `/pages/faq`, `/pages/subscription-faq` | 2 each | 2 each | `ona-page-title` → page-header. `ona-faq-layout` already Horizon-native — leave it |
| `/pages/private-courses-and-experiences` | 3 | 3 | thin on content; layout swap only after the copy lands |
| `/pages/womenincoffee`, `/pages/recycled-boxes` | 2, 1 | — | same: content first |
| bookings ×3 | 4 each | 4 each | the iframe's framing only |

The homepage and the PDP are not in this table: both are already Horizon-native
apart from the eight inline-`<style>` blocks listed above.

**`templates/index.json` is at 25 of Shopify's 25 sections.** A 26th makes the
GitHub integration refuse the whole file rather than drop the extra section —
`tests/shop-owned-templates.test.mjs` guards this. Eleven of the 25 are
disabled, so retiring one is how the homepage gets room again.

## The tokens that make it one design

Swapping sections is not enough on its own; two pages built from the same
component still diverge if each restates its own sizes.

1. **Type comes from the preset, not a literal.** `type_preset` is one of
   `h1…h6`, `paragraph`, `rte`. `custom` is for a genuine one-off and currently
   covers 38 blocks — that number should fall, not grow. No `font_size` in a
   template.
2. **Spacing comes from a short scale.** Pick one from the 19 values in use —
   the obvious ladder is **0 / 16 / 32 / 48 / 64 / 96 / 120** — and move every
   section's `padding-block-*` onto it. With no gaps between sections, this
   scale *is* the page rhythm.
3. **Colour comes from the palette.** `{{ settings.color_palette.* }}`, never a
   hex, so a section follows a palette change. Adjacent sections alternate
   ground and ink rather than repeating — the homepage has no dividers, so a
   colour change is the only boundary a reader gets.
4. **CSS lives in `{% stylesheet %}`.** Never an inline `<style>` in a
   `custom_liquid` block. On the PDP this is also a correctness rule: #236
   prunes an empty tab by `panel.textContent.trim() === ''`, and a `<style>`
   element's text defeats it.

## Order of work

Each step is shippable and reversible on its own, and none of them needs the
next one to have happened.

1. **Write `page-header`** and move the three heading sections onto it. Smallest
   possible proof of the pattern, touches five pages, no layout risk.
2. **Wholesale** — the biggest page and the most duplication, so the
   `media-with-content` conversion is worth most there and the rest of the
   mapping is a repeat of it.
3. **Barista courses**, which is the same five conversions again.
4. **About**, then **learn**.
5. **Delete what is then unused** — on current usage that is 9 sections
   immediately, and around 26 more once 1–4 land.
6. **Tokens**: the 38 `custom` presets and the 19 padding values, once the
   sections they live in have stopped moving. Doing this first means doing it
   twice.
7. **The 8 inline `<style>` blocks**, independent of all of the above.

Steps 1–4 are also when the thin pages get flagged for content: a page with 852
characters cannot be fixed by swapping its sections.

## Rules

These extend the rules in
[page-design-structure.md](page-design-structure.md#rules); they do not replace
them.

1. **A new section needs an argument, not a page.** If a page needs a layout the
   kit does not have, the first question is whether an existing component takes
   a setting instead. Ten sourcing sections exist because nobody asked it.
2. **One component, many instances.** Two sections with the same schema and
   different CSS is the defect this document exists to remove.
3. **If a legacy section is already Horizon-native, leave it.**
   `ona-faq-layout` and `ona-page-media-gallery` have a `{% schema %}` and a
   `{% stylesheet %}` and style themselves completely. They are the target
   shape, not work to do.
4. **Delete on the way out, not later.** A section that nothing references is
   indistinguishable from one the next person is about to need. Remove it in
   the same PR that removes its last use.
