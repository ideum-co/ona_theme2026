# The component kit

Which components the pages get rebuilt **with**. This is the missing half of
stage 2 in [page-design-structure.md](page-design-structure.md): that document
says to replace legacy section internals with Horizon blocks and sets the rules;
this one names the parts and maps every legacy section onto one.

Written 2026-10-20 from the page reviews, measured against the live theme
(`ona_theme2026/main`, id 154676789439, Horizon 4.1.4).

## Verification status

Read this before using the mapping. This document has two halves and they are
not equally trustworthy.

**Measured and guarded by `tests/component-kit.test.mjs`:** the section
inventory (46 sections, all referenced), the duplication groups (parsed from
schemas), which components exist, which legacy sections style themselves,
which carry a form or a metafield, and that the sourcing clones have no
enabled blocks.

**Not verified:** *which component replaces which section*. Those rows were
derived from schemas and block trees, and a schema says nothing about what a
page draws or how it is laid out. Review of this document found the same
mistake fourteen times, including in fixes written to correct earlier
instances of it. The live counterexamples found so far are recorded in
[Known gaps](#known-gaps) below; that table grows every time someone checks a
row against the page rather than the schema.

So: treat every "Replaces" cell and every row of the page-by-page table as a
**candidate**, not a decision. Each conversion PR has to open the legacy
section's Liquid *and* the target's rendered output and confirm the swap is
invisible, before it changes anything.

## What the reviews actually found

The theme ships **46 `ona-*` sections**, and the first thing to say about them is
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

Grouped by the **whole** schema — settings, nested block settings and
constraints like `max_blocks` — with only the human-facing `name` ignored.
Every member is listed in full: the guard asserts membership, not just counts,
so an abbreviated cell would be a hole in it.

| Identical schema | Copies | Which |
| --- | --- | --- |
| `id, image, title, subtitle, content, button_text, button_url` + one `block` | **10** | `ona-sourcing`, `ona-traning-sourcing`, `ona-traning-sourcing-v2`, `ona-traning-sourcing-v3`, `ona-traning-sourcing-v4`, `ona-wholesale-sourcing-v2`, `ona-wholesale-sourcing-v3`, `ona-wholesale-sourcing-v4`, `ona-wholesale-sourcing-v5`, `ona-wholesale-sourcing-v6` |
| `id, title, content, slider_autoplay` + `slider`,`block` | 2 | `ona-supported`, `ona-traning-supported` |
| `image, title2` | 2 | `ona-inner-banner`, `ona-training-banner` |
| no schema at all | 2 | `ona-bookings-top`, `ona-training-iframe` |

`ona-brewguides-and-training` and `ona-sustainability-list` were listed here as
a fifth pair and are **not** one. Both have no section settings and one `block`,
which is as far as the first version of the guard looked; their block settings
differ (`ona-sustainability-list` has `content`, the other does not) and so do
their `max_blocks`, 3 against 2. Found by review, not by the guard — which is
why the guard now keys on the full schema and checks membership.

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

`sections/carousel.liquid` looked like the answer — it has a static `group`
header that accepts `@theme` blocks and a `_carousel-content` of `_card`s — and
it is not. Both are direct children of `.section`, which places them in the
same grid column on separate rows, so the header renders *above* the cards.
The legacy layout puts the panel *beside* the slider. The block tree fits; the
layout does not, and checking the block tree without checking the layout is
how this document got the mapping wrong twice in a row.

These five therefore have **no verified target**. See [Known gaps](#known-gaps).

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
- `ona-wholesale-brands` is no longer a static grid. #253 made it an animated
  marquee: a duplicated `aria-hidden inert` track so the loop is seamless and
  the logos are announced once, a pause on hover and focus, and a
  reduced-motion fallback that degrades to a swipeable strip. Its schema did
  not change, so the mapping is blind to every bit of that.

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

Alongside that, three kinds of drift, measured across all 150 sections in
`templates/*.json` and guarded by `tests/component-kit.test.mjs` so they do not
go stale again — they already did once, when #276 added three product
templates:

- **77 blocks sit on `type_preset: "custom"`** — nearly three times the next
  most common preset (`paragraph` 28, `rte` 22, `h2` 17, `h4` 14, `h6` 14).
  Each one opts out of the type scale and restates a size; there are **11
  distinct literal `font_size` values** in the templates.
- **19 distinct padding values** between sections: 0, 4, 8, 10, 12, 16, 20, 24,
  32, 40, 48, 60, 64, 72, 80, 96, 100, 120, 152. On the homepage every
  inter-section gap is 0 and all rhythm is internal padding, so these 19 values
  *are* the vertical rhythm.
- **20 `custom_liquid` blocks carry an inline `<style>`** — `collection.json`
  ×3, `index.json` ×1, and ×4 in each of `product.json`,
  `product.equipment.json`, `product.merch.json` and `product.non-coffee.json`.
  Two of the four in `product.json` are superseded by #243. The three product
  variants #276 added each carry their own copy of the same four, so this is
  one block duplicated four ways rather than twenty separate decisions — fix
  it once and the other three follow.

## The kit

Eight components. Seven are Horizon's own or already Horizon-native here; one
has to be written.

| # | Component | What it is | Replaces |
| --- | --- | --- | --- |
| 1 | `section` + `group`/`text`/`image`/`video`/`button`/`spacer` | Horizon's generic container. Already the most-used thing in the theme: `text` ×78, `group` ×34, `button` ×14, `image` ×11. A `group` has `content_direction`, so a row of two blocks is a media/text layout; `image` carries a `link` and `video` carries a YouTube/Vimeo URL. | anything that is just stacked copy, and the four media/text variants `media-with-content` cannot hold (below) |
| 2 | `media-with-content` | one fixed media slot + a content slot holding arbitrary theme blocks. Already on the homepage three times. | the **10** `*-sourcing-v*` clones, and `ona-training-image-text` |
| 3 | `hero` | full-bleed media with blocks over it: desktop and custom mobile media, overlay, `section_height`, `fetchpriority` on the image itself. Already on the homepage. | `ona-training-banner`, `ona-inner-banner` |
| 4 | `carousel` | a static `group` header **above** a row of `_card`s. Both are direct children of `.section`, which puts them in the same grid column on separate rows — it is a header-over-cards layout, not a side-by-side one. | card rows. **Not** the five panel-plus-slider sections: their panel sits beside the slider |
| 5 | `press-quotes` | quote carousel: logo, quote, attribution, arrows when blocks outnumber columns | `ona-cafe-testimonial` — **only once #246 is merged**, see below |
| 6 | `ona-faq-layout` | already Horizon-native, styles itself, takes `_faq-category` blocks | `ona-faq-lists`, the FAQ half of `ona-expressions` |
| 7 | `ona-page-media-gallery` | already Horizon-native, styles itself | ad-hoc image grids |
| 8 | **a page-header section** — *to write* | eyebrow, heading, optional sub-copy, optional visually-hidden variant | `ona-page-title`, `ona-sr-heading` |

Two components that looked like matches are deliberately absent. **`slideshow`**
takes only `_slide` blocks, so it has no legacy target left once the composites
go to `carousel`. **`marquee`** was rejected for animating where the logo wall
was static; #253 animated the logo wall, so that objection is gone. It stays
out for a different reason, measured on the files rather than assumed:
`sections/marquee.liquid` takes `logo` blocks, but `blocks/logo.liquid` renders
the *shop's* logo and has neither an image picker nor a link, so the five
linked partner logos the live instance carries (`templates/page.wholesale.json`
→ `wholesale_brands`: Nucleus, Sanremo, La Marzocco, Mahlkönig and Ubermilk,
all five enabled) would have to go in `icon` blocks instead — those do fit
(`image_upload` + `link`) — and neither `sections/marquee.liquid` nor
`blocks/_marquee.liquid` pauses on hover or focus, which #253's marquee does.
Promoting it means closing that gap and making the argument, not adding a row
here.

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
| `ona-gust-r` (wholesale) | `{% form 'contact' %}` with a fixed subject and a business field | **not** `contact-form` as it stands — see [Known gaps](#known-gaps) |
| `ona-training-form` (training) | `{% form 'contact' %}` | same |
| `ona-expericences-content` (private courses) | two columns: heading/image/lead/copy on the left, a working contact form on the right, posting a fixed `contact[subject]` | the two-column shell is `section` + two `group`s — **not** `media-with-content`, which has one media slot and one content slot. The form itself is **not** stock `contact-form`: see [Known gaps](#known-gaps) |
| `ona-unique-coffees` (wholesale) | three named tabs that switch a three-image panel and its copy together, with `role="tabpanel"` and `aria-hidden` wiring | **nothing in Horizon does this.** `carousel` gives cards and dots, an `accordion` does not drive a separate panel. Keep the section, or write a tabs component — a decision, not a mapping |
| `ona-donation-counter` (homepage) | reads `shop.metafields.custom.donation_total` and renders it as flip-counter digits | keep: it has its own schema and stylesheet and no generic block reproduces it |
| `ona-training-iframe` (training) | a metafield-driven booking iframe | keep until the booking provider changes |
| `ona-bookings-top` (bookings) | **no iframe at all** — a breadcrumb list, then a two-column heading and intro read from `page.metafields.accentuate.title_bookings` and `content_bookings` | needs its own target, not the iframe's deferral — see [Known gaps](#known-gaps) |
| `ona-campaign-banner` (homepage) | reads `shop.metafields.custom.donation_end_date` and renders the campaign line only when it has a value, next to its own scoped stylesheet | keep: it is the other half of the counter — both read metafields written by the same recompute job, and a `text` block cannot omit itself when the date is unset |

So the honest version of the collapse: the **layout** fragments go to eight
components. Seven sections carry behaviour — three of them onto Horizon's
`contact-form`, three of them staying as they are, and `ona-bookings-top`
needing a target of its own — and `ona-unique-coffees` is the one section on
the wholesale page that stage 2 cannot convert without a decision first.

## Known gaps

Cases where the obvious target has been checked and does not work. Each one
needs a decision before the page it is on can reach stage 2.

| Section | Why no target fits |
| --- | --- |
| the five panel-plus-slider composites | `carousel` renders its header **above** the cards — `sections/carousel.liquid` emits the static group and `_carousel-content` as consecutive children, and `assets/base.css` puts every direct child of `.section` in grid column 2. The legacy layout is panel *beside* slider. No component in the theme does that; it needs a two-column wrapper or an extended component. |
| `ona-gust-r` | Horizon's `contact-form` block has name, email, phone and body. The live form also posts `contact[subject]` = "Wholesale partnership enquiry" and a `contact[business]` field, which is how enquiries are identified and routed. Swapping it would silently change what ONA receives. |
| `ona-awards` | `templates/page.about.json` gives it five slider images (`block1`) and twelve award-table rows (`block2`). `ona-page-media-gallery` reads `page.metafields.accentuate.image` and takes neither; `media-with-content` has one media slot. Nothing holds both. |
| `ona-unique-coffees` | three named tabs switching a three-image panel and its copy together. `carousel` gives cards and dots; an accordion does not drive a separate panel. |
| every media/text section carrying `.animated-svg` — **15 of them** | the image is two layers, not one. `sections/ona-training-image-text.liquid:5-10` renders a three-path mustard (`#D0994D`) blob behind the photo, and `assets/legacy-page-layout.css` absolutely positions it behind the image with `z-index: -1` (the `#MainContent :has(> .animated-svg):has(img)` pair — cited by selector because PR #249 inserts ~38 lines above it). `media-with-content`'s `_media-without-appearance` renders one image or one video, so the swap removes the blob — visible, and stage 2 requires invisible. This is not one section: `grep -l animated-svg sections/*.liquid` returns 15, and **all ten** members of the largest duplication group are among them, so it applies to the kit's biggest mapping, not an edge case. Needs a target that carries a decorative layer, or the layer moves to CSS on the new section. |
| `ona-expericences-content` | the live form posts `contact[subject]` = "Private courses and experiences enquiry" (`sections/ona-expericences-content.liquid:50`). Horizon's `contact-form` block has no subject setting — its schema is width, colour, input style, border and padding — so the swap would silently merge these enquiries into the untagged pile. The same loss is already treated as blocking for `ona-gust-r`; it is blocking here too. |
| `ona-training-form` | same loss again, third instance: `sections/ona-training-form.liquid:51` posts `contact[subject]` = "Barista training enquiry". All three `{% form 'contact' %}` sections in the theme post a fixed subject that `contact-form` cannot carry, so "move the forms to `contact-form`" is not a mapping any of them can take as it stands — the block needs a subject setting first. |
| `ona-training` (wholesale) | the text column is not ordinary text. `templates/page.wholesale.json` gives the live instance three enabled blocks, and `sections/ona-training.liquid:40-56` renders each as a `faqs-toggle` button with `aria-expanded`, followed by a "Get In Touch" link to a Monday form. A `media-with-content` text slot drops both the interaction and the CTA; the blocks need an `accordion` and the link needs to survive. |
| `ona-wholesale-brands` | #253 replaced the static logo grid with a marquee: a duplicated `aria-hidden inert` track, a `-webkit-mask-image` fade at both edges, a pause on hover and `:focus-within`, and a `prefers-reduced-motion` branch that turns the row into a plain `overflow-x: auto` strip. `section` + linked `image` blocks render none of that, and Horizon's `marquee` has no hover or focus pause (see the two absent components above). The mapping this row replaces — "`section` + linked `image` blocks, kept static" — was written against the pre-#253 section and would now be a visible regression. |
| `ona-faq-lists` (wholesale) | all six FAQ blocks on the live instance are **disabled**, but `title2` ("Need help?") and `tips` (the admin mailto) are populated, so what the page actually renders is the tips, not a FAQ list. `ona-faq-layout` has a left-column `body` and `_faq-category` blocks and no slot for trailing copy, so the replacement cannot be invisible here. #253 confirms the reading from the other side: it styles the call-out behind `:not(:has(.faqs-toggle))`, "a page with no FAQ rows (e.g. /pages/wholesale)", and centres the heading, constrains the paragraph to `48ch` and underlines the mailto. Whatever replaces the section has to carry that treatment, not just the text. The bookings instance has to be checked separately before the section is retired. |
| `ona-icon-and-content` (wholesale) | live and enabled, with five blocks of icon + title + `url`, and the urls are **in-page anchors** — `#complete-training`, `#unique-coffees`, `#supported`, `#exclusive-access` — so the section is the wholesale page's own contents list, not decoration. Horizon's `icon` block inside a `group` per cell is still the obvious candidate, and `blocks/icon.liquid` does carry `image_upload` and `link`. What has changed is the bar: #253 wraps each cell in `a.box.icon-box-anchor` and styles it as an equal-height outlined button with a hover and `:focus-visible` inversion, so a swap now has to reproduce a styled nav, not five plain anchors. Still a gap rather than a row, but for a sharper reason than before. |
| `ona-bread-crumbs` | live on `/pages/private-courses-and-experiences`, rendering linked ancestors and a dynamic `page.title`. The only other breadcrumb in the theme is the product-specific one, so there is no generic target: keep the section, or write a page-breadcrumb component. |
| `ona-sustainability-list` | live and enabled on `templates/page.about.json` with two of its three blocks filled — Solar → `/pages/solar`, and the Women in coffee campaign → `/pages/womenincoffee`. Each block is image + title + rich text + url, rendered as independent cards, so `media-with-content`'s single media slot cannot hold the pair. A `section` of two `group`s, each with `image`, `text` and `button`, is the obvious shape, but two things have to survive the move and neither has been checked against the rendered page: the image is painted as a CSS `background-image` on a bare `div` rather than an `<img>`, so it carries no alt text and no responsive sources today, and the "Read More" label is hard-coded in the markup (`sections/ona-sustainability-list.liquid:9`) rather than being a block setting. |
| `ona-bookings-top` | not a booking iframe, despite sitting next to one. It renders a breadcrumb `<ul>` and then a two-column heading/intro pair out of `page.metafields.accentuate.*`. The breadcrumb has the same problem as `ona-bread-crumbs` — no generic target — and the two-column intro is a `section` of two `group`s, but the copy lives in metafields rather than block settings, so the move is a content migration as well as a layout one. The page-by-page note that bookings needs only iframe framing is incomplete until this is mapped. |
| `ona-content` (about) | live and enabled on `templates/page.about.json`. Heading and lead render as two **independent** text columns over an `.animated-svg` blob, so `media-with-content`'s one media slot plus one content slot collapses the pair into a single column. A `section` with two `group`s is the shape, but it inherits the decorative-layer problem above — `ona-content` is one of the 15 `.animated-svg` sections — so it needs the blob solved first. Unmapped in the kit until then, rather than silently treated as a media/text variant. |
| `ona-cafe-testimonial` — **until #246 merges** | all four live blocks have both an `image` and a `title`, and the legacy section renders the title as a citation. On `main` today, `sections/press-quotes.liquid:30` shows `source` only in an `elsif` after both logo fields, so a block with a logo cannot also show a name — migrating the four cafés would hide every café name. #246 replaces that branch with a trailing `<figcaption>`, which is what makes this mapping work; it is a dependency, not an assumption. #253 did not touch the markup — the `<cite>` carrying `title` and `subtitle` is unchanged, so that dependency reads exactly as written — but it added a second one: `.cafe-reviews` now lays the blocks out as a three-up `scroll-snap` carousel that falls to two columns at 989px and one at 749px. `press-quotes` has to match that, and Victor's `.cafe-reviews` rules go dead the day the section does. |

## Page by page

Stage per page stays as [page-design-structure.md](page-design-structure.md)
sets it. This is what stage 2 *might* mean for each — candidates, subject to
the verification rule at the top and to the gaps above.

| Page | Sections now | After | The work |
| --- | --- | --- | --- |
| `/pages/wholesale` | 19 (all legacy) | ~10 | five `*-sourcing-v*` → `media-with-content`; `ona-cafe-testimonial` → `press-quotes`; the four panel-plus-slider composites and `ona-unique-coffees` have no verified target (see Known gaps); `ona-wholesale-brands` lost its target to #253 (see Known gaps); `ona-faq-lists`, `ona-training` and `ona-icon-and-content` have no verified target (see Known gaps); `ona-gust-r` stays until its subject and business fields have a home |
| `/pages/barista-courses` | 10 (all legacy) | ~6 | four `traning-sourcing-v*` → `media-with-content`; `ona-traning-supported` has no verified target (see Known gaps); `ona-training-banner` → `hero`, keeping the image and the back-link to Learn |
| `/pages/about` | 7 (all legacy) | ~5 | media/text variants → `media-with-content`; `ona-awards` and `ona-sustainability-list` have no verified target (see Known gaps) |
| `/pages/learn` | 2 | 2 | `ona-page-title` → page-header; `ona-brewguides-and-training` → `section` + `_product-card`-style tiles |
| `/pages/faq`, `/pages/subscription-faq` | 2 each | 2 each | `ona-page-title` → page-header. `ona-faq-layout` already Horizon-native — leave it |
| `/pages/private-courses-and-experiences` | 3 | 3 | thin on content; layout swap only after the copy lands. Two of its three sections have no target anyway: `ona-expericences-content`'s form and `ona-bread-crumbs` (see Known gaps) |
| `/pages/womenincoffee`, `/pages/recycled-boxes` | 2, 1 | — | same: content first |
| bookings ×3 | 4 each | 4 each | the iframe's framing only |

The homepage and the PDP are not in this table: both are already Horizon-native
apart from the eight inline-`<style>` blocks listed above.

Four sections are shared, so converting one page does not retire them:
`ona-page-title` has to go from faq, faq-subscriptions *and* learn before it can
be deleted, `ona-sr-heading` from bookings, private-courses and wholesale,
`ona-faq-lists` from bookings and wholesale. Convert all uses in one PR, or the
section stays and the page is the only thing that moved.

**`templates/index.json` is at 24 of Shopify's 25 sections**, so there is
exactly one slot left. A 26th makes the GitHub integration refuse the whole
file rather than drop the extra section — `tests/shop-owned-templates.test.mjs`
guards the file's contents and `tests/component-kit.test.mjs` guards this
count. Nine of the 24 are disabled, so retiring one is how the homepage gets
more room than that single slot.

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
   46 are referenced — so there is no up-front sweep to do. The four shared
   sections above are the only ones whose deletion needs more than one page
   converted.
6. **Tokens**: the 77 `custom` presets and the 19 padding values, once the
   sections they live in have stopped moving. Doing this first means doing it
   twice.
7. **The 20 inline `<style>` blocks**, independent of all of the above.

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
