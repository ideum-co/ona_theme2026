# The component kit

Which components the pages get rebuilt **with**. This is the missing half of
stage 2 in [page-design-structure.md](page-design-structure.md): that document
says to replace legacy section internals with Horizon blocks and sets the rules;
this one names the parts and maps every legacy section onto one.

Written 2026-10-20 from the page reviews, measured against the live theme
(`ona_theme2026/main`, id 154676789439, Horizon 4.1.4).

## What the reviews actually found

The theme ships **45 `ona-*` sections**, and the first thing to say about them is
what is *not* true: none of them is dead. Every one is referenced by a template,
so there is nothing to delete today — a section goes only when the page that
uses it has been converted. Four are used by more than one template:
`ona-page-title` (faq, faq-subscriptions, learn), `ona-sr-heading` (bookings,
private-courses, wholesale), `ona-faq-lists` (bookings, wholesale) and
`ona-faq-layout` (faq, faq-subscriptions).

The problem is duplication, not disuse. The old theme had no block model, so each
layout variant became another section file, and the port carried all of them
across. Parse the schemas and ten of them are **byte-for-byte the same
component**:

| Identical schema | Copies | Which |
| --- | --- | --- |
| `id, image, title, subtitle, content, button_text, button_url` + one `block` | **10** | `ona-sourcing`, `ona-wholesale-sourcing-v2…v6`, `ona-traning-sourcing`, `-v2`, `-v3`, `-v4` |
| `id, title, content, slider_autoplay` + `slider`,`block` | 2 | `ona-supported`, `ona-traning-supported` |
| `image, title2` | 2 | `ona-inner-banner`, `ona-training-banner` |
| no schema at all | 2 | `ona-bookings-top`, `ona-training-iframe` |
| no settings + one `block` | 2 | `ona-brewguides-and-training`, `ona-sustainability-list` |

Beyond the exact matches are families that do one job through near-identical
settings — `ona-training-image-text`, `-text-two-images`, `-text-image-bg`,
`ona-wholesale-partnership`, `ona-expericences-content` and `ona-training` are
all a heading, some copy and a piece of media, four of them with a video variant
bolted on.

**The layout fragments collapse to about eight components**, and Horizon
already ships seven of the eight. A handful of sections are not layout at all,
and they are listed separately below rather than forced into the kit.

One section is mis-named and would be mis-mapped because of it.
`ona-wholesale-testimonial` reads like a sibling of `ona-cafe-testimonial` and
is not one: its four blocks are **YouTube episodes** — a thumbnail, a play
icon, an episode title and an embed URL — while the written café quotes all
live in `ona-cafe-testimonial`. Only the second is a `press-quotes`.

### The dominant shape is a composite, and it has a home

Five sections turn out to be the same thing, and it is not a carousel:

| Section | Persistent panel | Carousel | Other live blocks |
| --- | --- | --- | --- |
| `ona-supported` | title + copy | 3 slides | 4 accordion rows |
| `ona-traning-supported` | title + copy | 1 slide | 4 accordion rows |
| `ona-exclusive-access` | title + copy | 1 slide (1 disabled) | — |
| `ona-expressions` | title | 1 slide | 4 FAQ rows |
| `ona-wholesale-testimonial` | title, subtitle, copy, a Get In Touch link | 4 episodes | an episode selector |

Each renders a titled panel *beside* a slider, and three of them an accordion
as well. A bare `slideshow` is the wrong target for all five: it takes only
`_slide` blocks and offers arrows and dots, so the panel would have to go
inside a slide, where it would repeat or disappear as the slides change.

`sections/carousel.liquid` is the right one, and it is built for exactly this:
a static `group` header block — which accepts `@theme`, so `text`, `button`
and `accordion` all go in it — followed by a `_carousel-content` block of
`_card`s, each of which takes `image`, `video`, `text` or any theme block. The
panel, the accordion and the slides each land where they already are.

One residual, and it is the only thing in this document still undecided:
`ona-wholesale-testimonial`'s selector names its episodes ("Ep 2. Café support
through excellence program"), and `carousel`'s own controls are arrows and
dots. The videos, the copy and the Get In Touch button all map; the named
selector does not. **Decide that one with ONA** before converting wholesale —
accept dots, or keep the selector as a small block of its own.

### The media slot holds less than the sections do

`media-with-content` looked like the home for all six media/text variants. Its
media block, `_media-without-appearance`, takes **one** image or one
Shopify-hosted video — and four of the six need more than that:

| Section | Live media | Fits the slot? |
| --- | --- | --- |
| `ona-training-image-text` | one image | yes |
| `ona-expericences-content` | one image — but beside a live `{% form 'contact' %}`, see below | no |
| `ona-training` | `media_type: embed`, a youtu.be URL | no — external |
| `ona-wholesale-partnership` | `media_type: embed`, a YouTube watch URL | no — external |
| `ona-training-text-image-bg` | a pasted `<iframe>` of a YouTube embed, over a background image | no — external, and two layers |
| `ona-training-text-two-images` | `image` **and** `image2`, rendered together | no — two |

Those four go to component 1 instead: a `section` holding a row `group`, with a
`video` block (whose `video_url` accepts YouTube and Vimeo) or two `image`
blocks on one side and a column `group` of text on the other. Same layout, same
media, and it is still a merchant-editable block tree — which is stage 2's
actual test. Only `ona-training-image-text` is a plain `media-with-content`.

### Read the markup, not the schema

Three of the mappings in the first draft of this document were wrong in the
same way, and the way is worth naming because it will happen again. The table
was built by parsing `{% schema %}` blocks, and a schema describes settings,
not rendered structure. All of these are invisible to it:

- every `*-sourcing-v*` clone renders a trailing `.add-images-slider` of
  image/blockquote/citation blocks after the two-column row;
- `ona-wholesale-testimonial` renders the persistent panel and selector above;
- `ona-wholesale-brands` is a static grid, and the component that looked like
  its match animates.

The sourcing one resolves in the mapping's favour, but only by measurement:
across `page.wholesale.json` and `page.training.json` the ten clones have
**zero enabled blocks** between them — nine carry none at all, and
`ona-sourcing` carries four that are all `disabled: true`. So the live render
of all ten really is the two-column row, and `media-with-content` reproduces
it. What is at stake is stored content, not visible content: those four
disabled quotes, and the disabled blocks on `ona-faq-lists`, have to be
carried across or dropped on purpose — ONA's call, the same shape as the
disabled placeholder testimonials on the homepage.

So: before converting any section, read its Liquid. The schema tells you what
a merchant can set, not what the page draws.

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
| 1 | `section` + `group`/`text`/`image`/`video`/`button`/`spacer` | Horizon's generic container. Already the most-used thing in the theme: `text` ×78, `group` ×34, `button` ×14, `image` ×11. A `group` has `content_direction`, so a row of two blocks is a media/text layout; `image` carries a `link` and `video` carries a YouTube/Vimeo URL. | anything that is just stacked copy, `ona-wholesale-brands`, and the four media/text variants `media-with-content` cannot hold (below) |
| 2 | `media-with-content` | one fixed media slot + a content slot holding arbitrary theme blocks. Already on the homepage three times. | the **10** `*-sourcing-v*` clones, and `ona-training-image-text` |
| 3 | `hero` | full-bleed media with blocks over it: desktop and custom mobile media, overlay, `section_height`, `fetchpriority` on the image itself. Already on the homepage. | `ona-training-banner`, `ona-inner-banner` |
| 4 | `carousel` | the composite: a static `group` header taking `@theme` blocks, then `_carousel-content` holding `_card`s that take `image`, `video`, `text` or any theme block | the **5** panel-plus-slider sections in the table above |
| 5 | `press-quotes` | quote carousel: logo, quote, attribution, arrows when blocks outnumber columns | `ona-cafe-testimonial` (and already carrying its four quotes on the homepage, #246) |
| 6 | `ona-faq-layout` | already Horizon-native, styles itself, takes `_faq-category` blocks | `ona-faq-lists`, the FAQ half of `ona-expressions` |
| 7 | `ona-page-media-gallery` | already Horizon-native, styles itself | ad-hoc image grids |
| 8 | **a page-header section** — *to write* | eyebrow, heading, optional sub-copy, optional visually-hidden variant | `ona-page-title`, `ona-sr-heading` |

Two components that looked like matches are deliberately absent. **`slideshow`**
takes only `_slide` blocks, so it has no legacy target left once the composites
go to `carousel`. **`marquee`** animates unless the viewer asks for reduced
motion and its schema has no off switch, so it cannot stand in for a static
logo wall.

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
and `ona-page-title` and `ona-sr-heading` exist separately only because the old
theme needed both a visible page title and a visually-hidden H1. One section
with an `eyebrow`, a `heading`, an optional `subheading` and a `visually_hidden`
toggle covers both.

It does **not** cover `ona-training-banner`, which looks like a third heading
section and is not one: it is a full-bleed image hero with a back-link to
`/pages/learn` and a hand-written `<link rel="preload">` pair that #171, #172
and #180 spent three rounds getting right. Folding it into a text-only header
would delete the hero. It maps to `hero`, which carries desktop and mobile
media as settings and sets `fetchpriority` on the `<img>` itself — the preload
pair exists to do by hand what Horizon does natively, and converting retires it
rather than losing it. Same for `ona-inner-banner`, which has the same schema.

## What the kit does not cover

The kit is for **layout**. Some sections carry behaviour, and behaviour does
not collapse into a generic block. They are findable rather than
remembered — a section that contains a `{% form %}`, reads a metafield, or
loads its own script is doing something a `text` block cannot:

| Section | Behaviour | Target |
| --- | --- | --- |
| `ona-gust-r` (wholesale) | `{% form 'contact' %}`, 8 inputs | `section` + Horizon's `contact-form` block |
| `ona-training-form` (training) | `{% form 'contact' %}` | same |
| `ona-expericences-content` (private courses) | two columns: heading/image/lead/copy on the left, a working contact form on the right | `section` + two `group`s, the right one holding `contact-form` — **not** `media-with-content`, which has one media slot and one content slot |
| `ona-unique-coffees` (wholesale) | three named tabs that switch a three-image panel and its copy together, with `role="tabpanel"` and `aria-hidden` wiring | **nothing in Horizon does this.** `carousel` gives cards and dots, an `accordion` does not drive a separate panel. Keep the section, or write a tabs component — a decision, not a mapping |
| `ona-donation-counter` (homepage) | reads `shop.metafields.custom.donation_total` and renders it as flip-counter digits | keep: it has its own schema and stylesheet and no generic block reproduces it |
| `ona-bookings-top`, `ona-training-iframe` (bookings, training) | metafield-driven booking iframes | keep until the booking provider changes |

So the honest version of the collapse: the **layout** fragments go to eight
components. Six sections carry behaviour — three of them onto Horizon's
`contact-form`, three of them staying as they are — and `ona-unique-coffees`
is the one section on the wholesale page that stage 2 cannot convert without a
decision first.

## Page by page

Stage per page stays as [page-design-structure.md](page-design-structure.md)
sets it. This is what stage 2 means for each.

| Page | Sections now | After | The work |
| --- | --- | --- | --- |
| `/pages/wholesale` | 19 (all legacy) | ~10 | five `*-sourcing-v*` → `media-with-content`; `ona-cafe-testimonial` → `press-quotes`; `ona-supported`, `ona-exclusive-access`, `ona-expressions` → `carousel`; `ona-wholesale-testimonial` → `carousel` once the episode selector is decided; `ona-wholesale-brands` → `section` + linked `image` blocks, kept static; `ona-faq-lists` → `ona-faq-layout`; `ona-gust-r`'s native `/contact` form stays as is |
| `/pages/barista-courses` | 10 (all legacy) | ~6 | four `traning-sourcing-v*` → `media-with-content`; `ona-traning-supported` → `carousel`, panel and accordion in the header group; `ona-training-banner` → `hero`, keeping the image and the back-link to Learn |
| `/pages/about` | 7 (all legacy) | ~5 | media/text variants → `media-with-content`; gallery → `ona-page-media-gallery` |
| `/pages/learn` | 2 | 2 | `ona-page-title` → page-header; `ona-brewguides-and-training` → `section` + `_product-card`-style tiles |
| `/pages/faq`, `/pages/subscription-faq` | 2 each | 2 each | `ona-page-title` → page-header. `ona-faq-layout` already Horizon-native — leave it |
| `/pages/private-courses-and-experiences` | 3 | 3 | thin on content; layout swap only after the copy lands |
| `/pages/womenincoffee`, `/pages/recycled-boxes` | 2, 1 | — | same: content first |
| bookings ×3 | 4 each | 4 each | the iframe's framing only |

The homepage and the PDP are not in this table: both are already Horizon-native
apart from the eight inline-`<style>` blocks listed above.

Four sections are shared, so converting one page does not retire them:
`ona-page-title` has to go from faq, faq-subscriptions *and* learn before it can
be deleted, `ona-sr-heading` from bookings, private-courses and wholesale,
`ona-faq-lists` from bookings and wholesale. Convert all uses in one PR, or the
section stays and the page is the only thing that moved.

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

1. **Write `page-header`** and move `ona-page-title` and `ona-sr-heading` onto
   it. Smallest possible proof of the pattern, touches six pages, no layout
   risk.
2. **Wholesale** — the biggest page and the most duplication, so the
   `media-with-content` conversion is worth most there and the rest of the
   mapping is a repeat of it.
3. **Barista courses**, which is the same five conversions again.
4. **About**, then **learn**.
5. **Delete each section as its last use goes.** Nothing is unused today — all
   45 are referenced — so there is no up-front sweep to do. The four shared
   sections above are the only ones whose deletion needs more than one page
   converted.
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
