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
all a heading, some copy and a piece of media, three of them with a video
variant bolted on.

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

`media-with-content` looked like the home for all eight media/text variants.
Its media block, `_media-without-appearance`, takes **one** image or one
Shopify-hosted video — and five of the eight do not fit it:

| Section | Live media | Fits the slot? |
| --- | --- | --- |
| `ona-training-image-text` | one image | yes — but see the blocks note below |
| `ona-our-philosophy` (about) | one image | yes |
| `ona-careers` (about) | one image, over an `.animated-svg` blob | yes for the photo, no for the blob — see [Known gaps](#known-gaps) |
| `ona-expericences-content` | one image — but beside a live `{% form 'contact' %}`, see below | no |
| `ona-training` | `media_type: embed`, a youtu.be URL — **and nothing plays**, see below | no — external |
| `ona-wholesale-partnership` | `media_type: embed`, a YouTube watch URL — **and nothing plays**, see below | no — external |
| `ona-training-text-image-bg` | a pasted `<iframe>` in the text column, beside a plain `<img>` in the other — **not** a background image, and the `Watch videos` link above the embed is inert | no — external, and the embed sits beside the copy rather than in a media slot |
| `ona-training-text-two-images` | `image` **and** `image2`, rendered together | no — two |

Those five go to component 1 instead: a `section` holding a row `group`, with a
`video` block (whose `video_url` accepts YouTube and Vimeo) or two `image`
blocks on one side and a column `group` of text on the other. Same layout and
a merchant-editable block tree — which is stage 2's actual test. Same media for
three of the five; the two `media_type: embed` instances are a behaviour change,
below.

`ona-training-text-image-bg` needs a note of its own, because its name says
`BG` and there is no background. `sections/ona-training-text-image-bg.liquid:6-11`
renders the pasted `<iframe>` inside a `.data-video` div beneath a `Watch videos`
anchor whose `href` is `javascript:void(0);`, and the image is a separate column
at lines 13-15. The two sit side by side; nothing is layered over anything.

The anchor is also dead. `.training-bg`, `.video-link` and `.a-link` have no rule
in any stylesheet and no handler in any script, so the link does nothing and the
embed renders inline rather than behind it. Component 1 carries what is actually
there — a `video` block for the embed, an `image` block for the photo, both in
one row `group` — and the anchor is a removal, not behaviour to reproduce. It is
inert for the same reason as the `.play-video` anchors in five other sections,
which have CSS in `assets/legacy-page-layout.css` but no handler either; this one
has neither.

`media_type: embed` is the behaviour change, and it is not two sections. Every
non-Vimeo embed on `/pages/wholesale` renders nothing, and there are **eight of
them across five sections** — two set on the section, six set on blocks:

- `ona-wholesale-partnership` — 1, on the section: `youtube.com/watch?v=42flR1Iwun4`
- `ona-training` — 1, on the section: `youtu.be/dktspYuqEIg`
- `ona-wholesale-testimonial` — 4, on blocks: the four episode videos
- `ona-expressions` — 1, on a block: `youtu.be/nNF0FjGef7Q`
- `ona-exclusive-access` — 2, on blocks: 1 enabled, 1 disabled

All seven enabled instances carry `autoplay: true`. None plays. The five
sections share one branch, byte for byte —
`sections/ona-wholesale-partnership.liquid:20-23`,
`sections/ona-training.liquid:22-25`,
`sections/ona-wholesale-testimonial.liquid:31-34`,
`sections/ona-expressions.liquid:28-30` and
`sections/ona-exclusive-access.liquid:27-29` — which emits an `<iframe>` only
when the URL contains `vimeo` and otherwise falls to an empty
`<div id="{{ player_id }}">`. No script in the theme looks that id up;
`assets/media.js` is Horizon's own `deferred-media` component and binds to
`<deferred-media>`, not to these. The `.play-video` cover anchor above each one
is inert, and these five sections are exactly the five that render it. So what
the page shows is a cover image and a dead play button, eight times.

A `video` block takes the same YouTube URL and actually plays it. That is the
right end state and it is also not a like-for-like swap: it turns eight silent
covers into working video, with autoplay already set in the template. ONA has to
be told, and asked whether autoplay stays, before any of the five moves — see
[Known gaps](#known-gaps).

The first version of this note said two, because its probe read section-level
settings and never walked blocks. Six of the eight are on blocks.

Four of the five are media the slot cannot hold. `ona-expericences-content` is
the fifth for a different reason: its one image *does* fit the slot, but the
section is a two-column shell with a live `{% form 'contact' %}` beside it, so
the shell goes to component 1 and the form is a [Known gap](#known-gaps) —
the same split the behavioural table records.

Three fit the media slot plainly — `ona-training-image-text`,
`ona-our-philosophy` and `ona-careers` — and only **`ona-our-philosophy`** is
an unblocked `media-with-content`. The other two carry the `.animated-svg`
decorative layer (see [Known gaps](#known-gaps)). `ona-training-image-text` is
also not a settings-only swap: `templates/page.training.json` gives it three
enabled blocks, rendered by `sections/ona-training-image-text.liquid:16-21` as
a `<ul class="courses">` of Canberra / Sydney / Melbourne booking links. Those
convert cleanly to `button` blocks in the content slot — unlike `ona-training`,
whose three blocks are `faqs-toggle`s and earn their own gap row — but they
have to be carried, not dropped.

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

The sourcing one resolves **one** of its two questions in the mapping's
favour, and only by measurement: across `page.wholesale.json` and
`page.training.json` the ten clones have **zero enabled blocks** between them —
nine carry none at all, and `ona-sourcing` carries four that are all
`disabled: true`. So the trailing slider is not part of the live render, and
that objection to `media-with-content` falls away.

**The mapping is still blocked**, on the other question: all ten render an
`.animated-svg` blob that `media-with-content` drops (see
[Known gaps](#known-gaps)). Nothing in this paragraph makes the swap safe —
it only removes one of the two reasons it was not. What is at stake in *this*
paragraph is stored content, not visible content: those four
disabled quotes, and the disabled blocks on `ona-faq-lists`, have to be
carried across or dropped on purpose — ONA's call, the same shape as the
disabled placeholder testimonials on the homepage.

So: before converting any section, read its Liquid. The schema tells you what
a merchant can set, not what the page draws.

Alongside that, three kinds of drift, measured across all 153 sections in
`templates/*.json` and guarded by `tests/component-kit.test.mjs` so they do not
go stale again — they already did once, when #276 added three product
templates:

- **77 settings sit on `type_preset: "custom"`** — nearly three times the next
  most common preset (`paragraph` 28, `h2` 18, `rte` 18, `h4` 14, `h6` 14).
  Each one opts out of the type scale and restates a size; there are **11
  distinct literal `font_size` values** in the templates. They are not all
  blocks: **70 are block settings and 7 are section settings** —
  `product-highlight` and `club-invite` on the homepage, and `story-video` on
  the homepage plus all four product templates. A cleanup that walks only
  blocks misses those seven, which is also why the first count of this figure
  read 84: section and block settings both carry `type_preset`, and counting
  one population twice is as easy as counting the other not at all.
- **15 distinct padding values** between sections: 0, 8, 20, 24, 32, 40, 48,
  60, 64, 72, 80, 96, 100, 120, 152. On the homepage every inter-section gap is
  0 and all rhythm is internal padding, so these 15 values *are* the vertical
  rhythm. An earlier count said 19 by sweeping every setting whose name
  contains "padding"; that admitted button, badge and inline padding — 4, 10,
  12 and 16 — which are component-internal and not inter-section rhythm at all
  (Codex, #247). This counts `padding-block-start` and `padding-block-end` on
  top-level sections only.
- **20 `custom-liquid` blocks carry an inline `<style>`** — that is the block
  type (`blocks/custom-liquid.liquid`); `custom_liquid` is its setting key, and
  the style sits in that setting's value. `collection.json`
  ×3, `index.json` ×1, and ×4 in each of `product.json`,
  `product.equipment.json`, `product.merch.json` and `product.non-coffee.json`.
  Two of the four in `product.json` are superseded by #243. The three product
  variants #276 added each carry their own copy of the same four, so the 20
  occurrences are **eight distinct styled blocks**: four live in the product
  templates and are replicated across all four of them, `collection.json`
  contributes three more and `index.json` one. Fixing one of the product four
  fixes it in four places — the other seven are separate decisions, not
  copies (Codex, #247).

## The kit

Eight components. Seven are Horizon's own or already Horizon-native here; one
has to be written.

| # | Component | What it is | Replaces |
| --- | --- | --- | --- |
| 1 | `section` + `group`/`text`/`image`/`video`/`button`/`spacer` | Horizon's generic container. Already the most-used thing in the theme: `text` ×117, `group` ×40, `button` ×20, `image` ×14. A `group` has `content_direction`, so a row of two blocks is a media/text layout; `image` carries a `link` and `video` carries a YouTube/Vimeo URL. | anything that is just stacked copy, and the five media/text variants `media-with-content` cannot hold (below) |
| 2 | `media-with-content` | one fixed media slot + a content slot holding arbitrary theme blocks. Already on the homepage three times. | the **10** `*-sourcing-v*` clones, and `ona-training-image-text` — **all 11 blocked** on the decorative-layer decision: every one renders an `.animated-svg` blob this target drops (see [Known gaps](#known-gaps)). Nothing here is convertible until that is settled |
| 3 | `hero` | full-bleed media with blocks over it: desktop and custom mobile media, overlay, `section_height`, `fetchpriority` on the image itself. Already on the homepage. | `ona-training-banner`, `ona-inner-banner` |
| 4 | `carousel` | a static `group` header **above** a row of `_card`s. Both are direct children of `.section`, which puts them in the same grid column on separate rows — it is a header-over-cards layout, not a side-by-side one. | card rows. **Not** the five panel-plus-slider sections: their panel sits beside the slider |
| 5 | `press-quotes` | quote carousel: logo, quote, attribution, arrows when blocks outnumber columns | `ona-cafe-testimonial` — **blocked**: #246 has merged, so the café names are satisfied; what is left is the #253 carousel layout and a section-level image slot for the bus #278 added (see [Known gaps](#known-gaps)) |
| 6 | `ona-faq-layout` | already Horizon-native, styles itself, takes `_faq-category` blocks | the FAQ half of `ona-expressions` — **the rest of that section is blocked**, it is one of the five panel-plus-slider composites and its panel and slider have no target (see [Known gaps](#known-gaps)), so this converts half a section. **`ona-faq-lists` is blocked, per instance**: the live wholesale instance has every FAQ block disabled and renders trailing tips this target has no slot for, and bookings has not been checked (see [Known gaps](#known-gaps)) |
| 7 | `ona-page-media-gallery` | already Horizon-native, styles itself | ad-hoc image grids |
| 8 | **a page-header section** — *to write* | eyebrow, heading, optional sub-copy, optional visually-hidden variant | `ona-page-title`, `ona-sr-heading` |

Two components that looked like matches are deliberately absent. **`slideshow`**
takes only `_slide` blocks, and the only legacy sections it could have taken are
the five panel-plus-slider composites — for which it is the wrong target, because
the persistent panel would have to live inside a slide and would repeat or
disappear as the slides change. They do not go to `carousel` either: row 4 above
rules them out and they have **no verified target** at all (see
[Known gaps](#known-gaps)). `slideshow` is absent because nothing is left for it,
not because something better took its sections. **`marquee`** was rejected for animating where the logo wall
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

**This section explains why the shape fits; it does not say the swap is ready.**
Every one of these sections also renders an `.animated-svg` blob that
`media-with-content` drops, so none of them converts until the decorative layer
has a target — read this alongside [Known gaps](#known-gaps), not instead of it.

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

It has to carry their *fallback*, not just their settings.
`sections/ona-sr-heading.liquid:5` renders
`section.settings.text | default: page.title | default: shop.name`, and
`sections/ona-page-title.liquid:14` falls back to `page.title` when `title2` is
blank — and **four of the six instances leave the setting blank**: the
`ona-sr-heading`s on bookings, private courses and wholesale, and the
`ona-page-title` on Learn. Those four H1s are the page's own title today, read
at render time.

`templates/page.bookings.json` is what makes this a requirement rather than a
nicety. The `bookings` suffix is shop-wide and serves **three** separately
titled pages — Canberra, Sydney and Melbourne Barista Courses Bookings — so
there is no literal string that is correct on all three. `page-header`'s
heading must fall back to the resource title when its setting is blank, or
step 1 silently relabels two of those pages and strips the H1 the others
derive.

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
loads its own script is doing something a `text` block cannot. Those three
probes find **16** sections. The eight whose behaviour needs a decision of its
own are in the table; the paragraph after it says where the other eight are
already answered:

| Section | Behaviour | Target |
| --- | --- | --- |
| `ona-gust-r` (wholesale) | `{% form 'contact' %}` with a fixed subject and a business field, and `name`, `email` and `body` `required` with visible labels | **not** `contact-form` as it stands — it marks none of those `required`, hides its labels, adds a phone field, and reports only the email error with no live-region role — see [Known gaps](#known-gaps) |
| `ona-training-form` (training) | `{% form 'contact' %}` | same |
| `ona-expericences-content` (private courses) | two columns: heading/image/lead/copy on the left, a working contact form on the right, posting a fixed `contact[subject]` | the two-column shell is `section` + two `group`s — **not** `media-with-content`, which has one media slot and one content slot. The form itself is **not** stock `contact-form`: its `name`, `email` and `body` are `required` with visible labels, which `contact-form` is not, and it announces its success and every error in live regions where `contact-form` reports only the email field — see [Known gaps](#known-gaps) |
| `ona-unique-coffees` (wholesale) | three named tabs that switch a three-image panel and its copy together, with `role="tabpanel"` and `aria-hidden` wiring | **nothing in Horizon does this.** `carousel` gives cards and dots, an `accordion` does not drive a separate panel. Keep the section, or write a tabs component — a decision, not a mapping |
| `ona-donation-counter` (homepage) | reads `shop.metafields.custom.donation_total` and renders it as flip-counter digits | keep: it has its own schema and stylesheet and no generic block reproduces it |
| `ona-training-iframe` (training) | a metafield-driven booking iframe | keep until the booking provider changes |
| `ona-bookings-top` (bookings) | **no iframe at all** — a breadcrumb list, then a two-column heading and intro read from `page.metafields.accentuate.title_bookings` and `content_bookings` | needs its own target, not the iframe's deferral — see [Known gaps](#known-gaps) |
| `ona-campaign-banner` (homepage) | reads `shop.metafields.custom.donation_end_date` and renders the campaign line only when it has a value, next to its own scoped stylesheet | keep: it is the other half of the counter — both read metafields written by the same recompute job, and a `text` block cannot omit itself when the date is unset |

The other eight are answered without a row of their own.
`ona-page-media-gallery` reads a metafield and is already in [Known
gaps](#known-gaps), named in the `ona-awards` row. The remaining seven only
load a script, and a script is a mapping question rather than a keep — a
component brings its own behaviour with it, so a slider that loads
`ona-slider.js` needs a target, not an exemption. `ona-awards`,
`ona-faq-lists` and `ona-training` have Known gaps rows of their own, and
`ona-supported`, `ona-traning-supported`, `ona-expressions` and
`ona-wholesale-testimonial` are four of the five panel-plus-slider composites,
which carry one collective gap row.

So the honest version of the collapse: the **layout** fragments go to eight
components. Eight sections carry behaviour that needs a decision of its own:
three are `{% form 'contact' %}`
sections that **cannot** move to Horizon's `contact-form` as it stands — each
posts a fixed `contact[subject]`, and `ona-gust-r` a `contact[business]` too,
which the stock block has no setting for. A subject setting is necessary and
**not sufficient**: all three legacy forms mark `name`, `email` and `body`
`required` and label them visibly, while `blocks/contact-form.liquid` carries
no `required` attribute on any field, hides every label behind
`visually-hidden` in favour of placeholders, and adds a `tel` phone field. So
the swap would relax validation and change the rendered form even once the
subject is settable — three stay as they are, and
`ona-bookings-top` needs a target of its own. `ona-unique-coffees` is **not** the only wholesale section
stage 2 cannot convert without a decision first — the same is true of `ona-gust-r`
and the other two forms, the five panel-plus-slider composites, the five
silent-embed sections, the four anchor targets and every section carrying the
`.animated-svg` layer. The Known gaps table below is the list; this paragraph is
not a substitute for reading it. The **response states** differ too: the legacy forms use `role="status"` and `default_errors` in `role="alert"`; `contact-form` shows translated copy and only the email error in `autofocus` divs.

## Known gaps

Cases where the obvious target has been checked and does not work. Each one
needs a decision before the page it is on can reach stage 2.

| Section | Why no target fits |
| --- | --- |
| the five panel-plus-slider composites | `carousel` renders its header **above** the cards — `sections/carousel.liquid` emits the static group and `_carousel-content` as consecutive children, and `assets/base.css` puts every direct child of `.section` in grid column 2. The legacy layout is panel *beside* slider. No component in the theme does that; it needs a two-column wrapper or an extended component. |
| `ona-gust-r` | Two problems, and the fields are only the first. Horizon's `contact-form` block has name, email, phone and body; the live form also posts `contact[subject]` = "Wholesale partnership enquiry" and a `contact[business]` field, which is how enquiries are identified and routed, so swapping it would silently change what ONA receives. **The section is also not just a form, and the two parts are stacked, not side by side:** the form wrapper closes at `sections/ona-gust-r.liquid:55` and a sibling `<section>` opens at 57, so the YouTube promo (`42flR1Iwun4`) sits *below* the form, not beside it. The promo's own two columns are the video (60-71) and its copy plus a Get in touch CTA (73-81), and `assets/legacy-page-layout.css:157-160` deliberately presents the form as a centred 620px enquiry section — it is a modal shell (`.pop-up-form`) rendered inline with its close control hidden. So this is two compositions: the form, then a two-column media-and-text. Describing it as one two-column container would rearrange the page during a conversion that is supposed to be invisible. The promo half has a target as it stands, but not `media-with-content`: `blocks/_media-without-appearance.liquid` offers only Shopify's hosted `video` picker, so the YouTube URL has nowhere to go. Component 1's `video` block carries it -- `blocks/video.liquid:66-69` is a `video_url` setting labelled `video_external_url`. So the promo is a `section` holding a `video` block beside its copy and a `button`, and what blocks this section is the form's fields alone. (The CTA is already inert: `.wholesale-roaster-form-btn` appears only in the markup and in CSS, nothing in the theme binds it, and its href is `javascript:void(0);`.) **The field set and validation differ too**: this form marks `name`, `email` and `body` `required` with visible labels, while `blocks/contact-form.liquid` has no `required` attribute on any field, hides every label behind `visually-hidden` for placeholders, and adds a `tel` phone field. **The response states differ too**: the legacy forms announce an ONA-specific success line in `role="status"` and every validation error through `default_errors` in `role="alert"`, while `blocks/contact-form.liquid:34-55` renders a translated success string and **only the email error**, both in `autofocus` divs with no live-region role — so a missing name or message fails silently and a screen reader is moved rather than told. A subject setting alone does not make this a mapping. |
| `ona-awards` | `templates/page.about.json` gives it five slider images (`block1`) and twelve award-table rows (`block2`). `ona-page-media-gallery` reads `page.metafields.accentuate.image` and takes neither; `media-with-content` has one media slot. Nothing holds both — **independent of the decorative layer**, so step 2 does not release this one. |
| the Learn tiles (`ona-brewguides-and-training`) | a `group` with a `link` gives the tile its background, overlay and url, but `snippets/group.liquid:44-51` emits `<a class="group-block__link">` **empty**, before the content rather than around it, and neither the snippet nor the schema offers an `aria-label`. The legacy anchor wraps the heading and "Learn more", so the swap trades a named link for an unnamed one on a live page. `group` needs a label setting (or the anchor needs to wrap its children) before this is a mapping. |
| the four wholesale anchor targets — `ona-training`, `ona-supported`, `ona-exclusive-access`, `ona-unique-coffees` | the wholesale page navigates to itself. `ona-icon-and-content` links to `#complete-training`, `#supported`, `#exclusive-access` and `#unique-coffees`, and each is the `id` **setting** of exactly one of these four sections, emitted on its wrapper: `#complete-training` → `ona-training` (`sections/ona-training.liquid:2`), `#supported` → `ona-supported` (`sections/ona-supported.liquid:3`), `#exclusive-access` → `ona-exclusive-access` (`sections/ona-exclusive-access.liquid:1`), `#unique-coffees` → `ona-unique-coffees` (`sections/ona-unique-coffees.liquid:4`). The pairing matters: rewriting the contents list against the wrong owner is the failure this row exists to prevent, so the arrows above are the record, not the prose around them. **Solved** — `sections/section.liquid` now carries an optional `anchor` text setting (#284), emitted as the wrapper's `id` only when set, so a rebuilt section can keep the fragment its link already uses. Before that it had no anchor setting — its schema was layout, background, border and padding — and rendered only Shopify's generated `shopify-section-<key>` id, so whatever replaced any of these four silently broke a link on the same page. It was independent of each section's own gap: solving the video, the accordion, the tabs or the slider still left the anchor. **One condition survives:** the setting is on the *section*, so each of these four has to stay its own top-level `section` with its anchor set. Collapsing them into one `section` with four `group` blocks would reach only one of the four and break the other three; that needs an anchor on `group`, which does not exist. The pairs below stay the record of which link belongs to which section. |
| `ona-unique-coffees` | three named tabs switching a three-image panel and its copy together. `carousel` gives cards and dots; an accordion does not drive a separate panel. |
| every media/text section carrying `.animated-svg` — **15 of them** | the image is two layers, not one. `sections/ona-training-image-text.liquid:5-10` renders a blob behind the photo, and `assets/legacy-page-layout.css` absolutely positions it behind the image with `z-index: -1` (the `#MainContent :has(> .animated-svg):has(img)` pair — cited by selector because PR #249 inserts ~38 lines above it). `media-with-content`'s `_media-without-appearance` renders one image or one video, so that target removes the blob — visible, and stage 2 requires invisible. This is not one section: `grep -l animated-svg sections/*.liquid` returns 15, and **all ten** members of the largest duplication group are among them, so it applies to the kit's biggest mapping, not an edge case. **Solved for 14 of the 15** — `blocks/image.liquid` now takes an optional background shape, rendered by `snippets/decorative-shape.liquid` with the positioning and the intrinsic size the legacy markup already uses. **`ona-content` is the exception and stays blocked:** it is the only one of the 15 with no image at all — two text columns and the SVG, `<img>` count zero and no `image_picker` in its schema — so there is nothing for an image block to attach the shape to, `blocks/image.liquid:54-57` would draw a placeholder photo where there is none, and `assets/legacy-page-layout.css:69-70` gives that section's blob its own positioning and `opacity: .6` which no setting here reproduces. It needs a section- or group-level decorative layer, which this does not provide (Codex, #293). **Two things this row used to get wrong, and they matter to anyone converting one of the 15.** It is not one blob: there are **six** distinct shapes, and they are not one colour either — `#dfa46d` on all ten sourcing clones, `#BDD6E6` on `ona-content`, `ona-awards` and `ona-training-form`, `#D0994D` on `ona-careers` and `ona-training-image-text`. This row previously described a single mustard `#D0994D` blob, which is two of the fifteen. And nothing animates, despite the class name: `.start`, `.medium` and `.end` have no rule in any stylesheet and no script binds them, so the three paths paint in one colour and the page shows their union. **One condition survives:** the setting is on the public `image` block, not on `_media-without-appearance`, so a converted section goes to **component 1** — a `section` holding a `group` of `image` and `text` — rather than to `media-with-content`. Row 2 of the kit is wrong about those 11 until it is rewritten against this. `tests/decorative-shape.test.mjs` compares every viewBox, fill and path against the section it came from, so the shapes cannot drift from the sections they reproduce. |
| `ona-expericences-content` | the live form posts `contact[subject]` = "Private courses and experiences enquiry" (`sections/ona-expericences-content.liquid:50`). Horizon's `contact-form` block has no subject setting — its schema is width, colour, input style, border and padding — so the swap would silently merge these enquiries into the untagged pile. The same loss is already treated as blocking for `ona-gust-r`; it is blocking here too. **The field set and validation differ too**: this form marks `name`, `email` and `body` `required` with visible labels, while `blocks/contact-form.liquid` has no `required` attribute on any field, hides every label behind `visually-hidden` for placeholders, and adds a `tel` phone field. **The response states differ too**: the legacy forms announce an ONA-specific success line in `role="status"` and every validation error through `default_errors` in `role="alert"`, while `blocks/contact-form.liquid:34-55` renders a translated success string and **only the email error**, both in `autofocus` divs with no live-region role — so a missing name or message fails silently and a screen reader is moved rather than told. A subject setting alone does not make this a mapping. |
| `ona-training-form` | same loss again, third instance: `sections/ona-training-form.liquid:51` posts `contact[subject]` = "Barista training enquiry". This is **independent of the decorative layer**, so step 2 does not release this one even though the section carries a blob. All three `{% form 'contact' %}` sections in the theme post a fixed subject that `contact-form` cannot carry, so "move the forms to `contact-form`" is not a mapping any of them can take as it stands — the block needs a subject setting first. **The field set and validation differ too**: this form marks `name`, `email` and `body` `required` with visible labels, while `blocks/contact-form.liquid` has no `required` attribute on any field, hides every label behind `visually-hidden` for placeholders, and adds a `tel` phone field. **The response states differ too**: the legacy forms announce an ONA-specific success line in `role="status"` and every validation error through `default_errors` in `role="alert"`, while `blocks/contact-form.liquid:34-55` renders a translated success string and **only the email error**, both in `autofocus` divs with no live-region role — so a missing name or message fails silently and a screen reader is moved rather than told. A subject setting alone does not make this a mapping. |
| the five silent-embed sections — `ona-wholesale-partnership`, `ona-training`, `ona-wholesale-testimonial`, `ona-expressions`, `ona-exclusive-access` | every live non-Vimeo `media_type: embed` on the page renders **no video at all** — the branch emits an empty `<div>` and nothing in the theme drives it, so each one shows a cover image and an inert `.play-video` anchor. There are nine configured — two on sections and seven on blocks — one of the `ona-exclusive-access` blocks is disabled, so **eight are live**, and all eight carry `autoplay: true`. A `video` block plays the URL. The swap is therefore a visible behaviour change, not a reproduction, for every one of these five sections: it needs ONA's decision on whether the videos should start playing and whether autoplay stays. Three of the five are also panel-plus-slider composites with no verified target, so this is not the only thing blocking them — but it is the one that changes what a visitor sees. |
| `ona-training` (wholesale) | the text column is not ordinary text: `templates/page.wholesale.json` gives the live instance three enabled blocks, and `sections/ona-training.liquid:40-56` renders each as a `faqs-toggle` button with `aria-expanded`, followed by a "Get In Touch" link to a Monday form. **This row used to call that a no-target gap, measured against `media-with-content`, and that was the wrong target** — the mapping sends this section to component 1, and component 1 holds both: `sections/section.liquid` and `blocks/group.liquid` each accept `@theme`, `blocks/accordion.liquid` is public, has a preset and takes `_accordion-row` children, and `blocks/button.liquid` carries `label` and `link` for the CTA (Codex, #247). So the interaction and the link are a build, not a design problem. What is left blocking this section is the other two rows that name it: the embed renders no video today, and the anchor row above. |
| `ona-wholesale-brands` | #253 replaced the static logo grid with a marquee: a duplicated `aria-hidden inert` track, a `-webkit-mask-image` fade at both edges, a pause on hover and `:focus-within`, and a `prefers-reduced-motion` branch that turns the row into a plain `overflow-x: auto` strip. `section` + linked `image` blocks render none of that, and Horizon's `marquee` has no hover or focus pause (see the two absent components above). The mapping this row replaces — "`section` + linked `image` blocks, kept static" — was written against the pre-#253 section and would now be a visible regression. |
| `ona-faq-lists` (wholesale) | all six FAQ blocks on the live instance are **disabled**, but `title2` ("Need help?") and `tips` (the admin mailto) are populated, so what the page actually renders is the tips, not a FAQ list. `ona-faq-layout` has a left-column `body` and `_faq-category` blocks and no slot for trailing copy, so the replacement cannot be invisible here. #253 confirms the reading from the other side: it styles the call-out behind `:not(:has(.faqs-toggle))`, "a page with no FAQ rows (e.g. /pages/wholesale)", and centres the heading, constrains the paragraph to `48ch` and underlines the mailto. Whatever replaces the section has to carry that treatment, not just the text. The bookings instance has to be checked separately before the section is retired. |
| `ona-icon-and-content` (wholesale) | live and enabled, with five blocks of icon + title + `url`, and the urls are **in-page anchors** — `#complete-training`, `#unique-coffees`, `#supported`, `#exclusive-access` — so the section is the wholesale page's own contents list, not decoration. Horizon's `icon` block inside a `group` per cell is still the obvious candidate, and `blocks/icon.liquid` does carry `image_upload` and `link`. What has changed is the bar: #253 wraps each cell in `a.box.icon-box-anchor` and styles it as an equal-height outlined button with a hover and `:focus-visible` inversion, so a swap now has to reproduce a styled nav, not five plain anchors. Still a gap rather than a row, but for a sharper reason than before. **And it is one half of a pair:** the four anchors it points at are `id` settings on four other sections, which Horizon's `section` cannot reproduce — see the anchor row above, which has to be solved in the same PR as this one or the links break. |
| `ona-bread-crumbs` | live on `/pages/private-courses-and-experiences`, rendering linked ancestors and a dynamic `page.title`. The only other breadcrumb in the theme is the product-specific one, so there is no generic target: keep the section, or write a page-breadcrumb component. |
| `ona-careers` (about) | live and enabled as the last section on `templates/page.about.json`, and one of the 15 `.animated-svg` sections: `sections/ona-careers.liquid:12-16` renders the same three-path mustard blob behind the photo, so it inherits the decorative-layer decision above. Its content side is heading + subtitle + rich text + a "VIEW LISTING" link, which a content slot of `text` and `button` blocks holds — but the `url` is a section setting, not a block, so the copy migration is real. Blocked on the blob, same as the sourcing clones. `assets/legacy-page-layout.css:61` also gives `.careers` `padding-block: var(--legacy-page-gap)` through the same `:is()` list as `.sustainability-top`, so the spacing caveat on the row below applies here too. |
| `ona-sustatnability` (about) | easy to miss because the name is a typo of its neighbour. Live and enabled as `sustainability_hero` with **blank settings and no blocks**, so it draws no content, but it still emits `.sustainability-top`, which `assets/legacy-page-layout.css:61` gives `padding-block: var(--legacy-page-gap)`. Deleting it silently closes that gap between About's sections; converting it carries an empty title/copy panel and image slider nobody is using. This needs an explicit decision — almost certainly delete and absorb the spacing into the neighbouring section — rather than falling off the end of the About row. |
| `ona-sustainability-list` | live and enabled on `templates/page.about.json` with two of its three blocks filled — Solar → `/pages/solar`, and the Women in coffee campaign → `/pages/womenincoffee`. Each block is image + title + rich text + url, rendered as independent cards, so `media-with-content`'s single media slot cannot hold the pair. A `section` of two `group`s, each with `image`, `text` and `button`, is the obvious shape, but two things have to survive the move and neither has been checked against the rendered page: the image is painted as a CSS `background-image` on a bare `div` rather than an `<img>`, so it carries no alt text and no responsive sources today, and the "Read More" label is hard-coded in the markup (`sections/ona-sustainability-list.liquid:9`) rather than being a block setting. |
| `ona-bookings-top` | not a booking iframe, despite sitting next to one. It renders a breadcrumb `<ul>` and then a two-column heading/intro pair out of `page.metafields.accentuate.*`. The breadcrumb has the same problem as `ona-bread-crumbs` — no generic target — and the two-column intro is a `section` of two `group`s, but the copy lives in metafields rather than block settings, so the move is a content migration as well as a layout one. The page-by-page note that bookings needs only iframe framing is incomplete until this is mapped. |
| `ona-content` (about) | live and enabled on `templates/page.about.json`. Heading and lead render as two **independent** text columns over an `.animated-svg` blob, so `media-with-content`'s one media slot plus one content slot collapses the pair into a single column. A `section` with two `group`s is the shape, but it inherits the decorative-layer problem above — `ona-content` is one of the 15 `.animated-svg` sections — so it needs the blob solved first. Unmapped in the kit until then, rather than silently treated as a media/text variant. |
| `ona-cafe-testimonial` | all four live blocks have both an `image` and a `title`, and the legacy section renders the title as a citation. The café-name dependency is now **satisfied**: #246 has merged, and `sections/press-quotes.liquid:56-57` renders `<figcaption class="press-quotes__source">{{ block.settings.source }}</figcaption>` unconditionally after the quote, so a block can carry a logo *and* a name. The in-file comment at `:50` records what it replaced. That was one of three dependencies; the other two still block. #253 did not touch the markup — the `<cite>` carrying `title` and `subtitle` is unchanged, so that dependency reads exactly as written — but it added a second one: `.cafe-reviews` now lays the blocks out as a three-up `scroll-snap` carousel that falls to two columns at 989px and one at 749px. `press-quotes` has to match that, and Victor's `.cafe-reviews` rules go dead the day the section does. **And #278 added a third dependency, the hardest of the three:** `bottom_image` is set on the wholesale instance to `shopify://shop_images/ONA_Bus.png`, and `sections/ona-cafe-testimonial.liquid:22-27` renders it as the ONA bus straddling the section boundary. `press-quotes` has no section-level image setting at all — its schema is columns, icons style, background, text colour and the two paddings — so the swap deletes the bus outright. The target needs a section-level image slot before this row is a mapping. |

## Page by page

Stage per page stays as [page-design-structure.md](page-design-structure.md)
sets it. This is what stage 2 *might* mean for each — candidates, subject to
the verification rule at the top and to the gaps above.

| Page | Sections now | Distinct types after | The work |
| --- | --- | --- | --- |
| `/pages/wholesale` | 19 (all legacy) | ~10 | **six** sourcing sections have **no verified target** — `ona-sourcing` plus the five `*-sourcing-v*` clones, every one carrying an `.animated-svg` layer that `media-with-content` drops (see Known gaps); together with barista-courses' four they are the ten of the kit's largest duplication group; `ona-cafe-testimonial` has no verified target — #278 put the ONA bus in it (see Known gaps); the four panel-plus-slider composites and `ona-unique-coffees` have no verified target (see Known gaps); `ona-wholesale-brands` lost its target to #253 (see Known gaps); `ona-faq-lists` and `ona-icon-and-content` have no verified target (see Known gaps); `ona-training`'s interaction and CTA **do** have one — component 1 holds them — and what blocks it is the silent embed and the anchor, both below (see Known gaps); **five sections carry a live `media_type: embed` that renders no video at all** — `ona-wholesale-partnership`, `ona-training`, `ona-wholesale-testimonial`, `ona-expressions` and `ona-exclusive-access`, eight instances between them, six of those on blocks — so moving any of them to a `video` block starts videos that do not play today, with `autoplay` already set — a decision for ONA before the swap, not a mapping (see Known gaps); and **four of the sections on this page own the anchors the page's own contents list points at** — `ona-training`, `ona-supported`, `ona-exclusive-access` and `ona-unique-coffees` — which Horizon's `section` has no setting to reproduce, so their replacements and `ona-icon-and-content` have to move together (see Known gaps); `ona-gust-r` stays until **both** remaining parts of its gap row are solved — the subject and business fields, the field set and validation (it marks `name`, `email` and `body` `required` with visible labels where `contact-form` marks none and adds a phone field), and the response states (it announces an ONA-specific success line in `role="status"` and every error through `default_errors` in `role="alert"`, where `contact-form` shows translated copy and **only the email error** in `autofocus` divs, so a missing name or message fails silently). The YouTube promo is **not** a third blocker: it is a separate section stacked below the form, not a column beside it, and it converts to a `section` holding a `video` block and a `button` (see Known gaps) |
| `/pages/barista-courses` | 10 (all legacy) | ~6 | **four** sourcing sections have **no verified target** — `ona-traning-sourcing` plus the three `traning-sourcing-v*` clones, same `.animated-svg` layer (see Known gaps); `ona-training-image-text` is blocked on the same layer and is the 11th of the kit's blocked set; `ona-traning-supported` has no verified target (see Known gaps); **`ona-training-form` is blocked for a second reason, not the blob**: `sections/ona-training-form.liquid:51` posts a fixed `contact[subject]` = "Barista training enquiry" that stock `contact-form` cannot carry, **and** its `name`, `email` and `body` are `required` with visible labels where `contact-form` marks none, **and** its success and error messaging differs — `role="status"` plus every error via `default_errors` in `role="alert"`, against `contact-form`'s translated copy and email-only error in `autofocus` divs, hides its labels and adds a phone field — so solving the decorative layer does not unblock this page, and neither does the subject setting on its own (see Known gaps); `ona-training-banner` → `hero`, keeping the image and the back-link to Learn |
| `/pages/about` | 7 (all legacy) | ~5 | `ona-inner-banner` → `hero`; `ona-our-philosophy` → `media-with-content`, the one clean conversion on this page; the other five have no verified target (see Known gaps) — `ona-awards`, `ona-content`, `ona-sustatnability`, `ona-sustainability-list` and `ona-careers`. Three of those five carry the `.animated-svg` layer and so wait on step 2: `ona-awards`, `ona-content` and `ona-careers`. `ona-sustainability-list` and `ona-sustatnability` do not — they are blocked for their own reasons, which their gap rows give |
| `/pages/learn` | 2 | 2 | `ona-page-title` → page-header; `ona-brewguides-and-training` → `section` + a row `group` holding **one `group` per tile**. A `group` carries `background_image` for the `.img-bg` layer, `toggle_overlay` for the `.a-box`, an arbitrary `link` url for the tile's anchor, and `@theme` children for the heading and the "Learn more" line. **One thing it does not reproduce, and it is the anchor:** the legacy tile wraps the heading and "Learn more" *inside* the anchor (`sections/ona-brewguides-and-training.liquid:7-13`), which is where the link gets its accessible name, while `snippets/group.liquid:44-51` emits the anchor **empty** and as a sibling of the content. The group schema has no label setting and the snippet emits no `aria-label`, so each tile would be an unnamed link to a screen reader — see [Known gaps](#known-gaps). **Not** `_product-card`: its two tiles link to a page (`shopify://pages/barista-courses`) and a blog (`/blogs/brewguides`), while `blocks/_product-card.liquid:6` takes only `closest.product` and `snippets/product-card.liquid:85` hard-wires `href` to `product.url`; on a page template there is no product, so the card enters its onboarding state and emits **no link at all**. **Not** `_card` either, though it has the right settings: the leading underscore marks a private type that "Add block" does not offer (`blocks/product-tab.liquid:7-8` states the convention), and the only parent that admits `_card` is `_carousel-content`, so the tree would be unbuildable outside a carousel — and merchant-editable in the theme editor is stage 2's actual test |
| `/pages/faq`, `/pages/subscription-faq` | 2 each | 2 each | `ona-page-title` → page-header. `ona-faq-layout` already Horizon-native — leave it |
| `/pages/private-courses-and-experiences` | 3 | 3 | thin on content; layout swap only after the copy lands. Two of its three sections have no target anyway: `ona-expericences-content`'s form and `ona-bread-crumbs` (see Known gaps) |
| `/pages/womenincoffee`, `/pages/recycled-boxes` | 2, 1 | — | same: content first |
| bookings ×3 | 4 each | 4 each | **not** iframe framing only: `ona-training-iframe` is the iframe, but `ona-bookings-top` is a breadcrumb plus a metafield-backed two-column intro and has no target yet (see Known gaps); **`ona-faq-lists` is live here too and unverified** — the kit blocks it per instance and this instance is the one never checked: `title2` is "FAQ's", `tips` is empty and one metafield-repeater block is *enabled*, the opposite of wholesale, so the wholesale finding does not settle it either way (see Known gaps) |

**"Distinct types after" counts component types, not section instances.** Ten
sourcing clones becoming ten `media-with-content` instances is nine fewer
section *files* to maintain and the same number of sections on the page, so
none of these conversions reduces usage against Shopify's 25-section limit.
Only an explicit merge or deletion does that, and this table proposes none.

The homepage and the PDP are not in this table: both are already Horizon-native
apart from the 20 inline-`<style>` blocks listed above — one on the homepage and
the rest across `collection.json` and the four product templates.

Four sections are shared, so converting one page does not retire them:
`ona-page-title` has to go from faq, faq-subscriptions *and* learn before it can
be deleted, `ona-sr-heading` from bookings, private-courses and wholesale,
`ona-faq-lists` from bookings and wholesale, and `ona-faq-layout` from faq and
faq-subscriptions. Convert all uses in one PR, or the section stays and the
page is the only thing that moved.

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
   covers 77 settings — 70 on blocks and 7 on sections, so a cleanup that walks
   only blocks stops seven short. That number should fall, not grow. No
   `font_size` in a template.
2. **Spacing comes from a short scale.** Pick one from the 15 values in use —
   the obvious ladder is **0 / 24 / 48 / 72 / 96 / 120** — and move every
   section's `padding-block-*` onto it. With no gaps between sections, this
   scale *is* the page rhythm.
3. **Colour comes from the palette.** `{{ settings.color_palette.* }}`, never a
   hex, so a section follows a palette change. Adjacent sections alternate
   ground and ink rather than repeating — the homepage has no dividers, so a
   colour change is the only boundary a reader gets.
4. **CSS lives in `{% stylesheet %}`.** Never an inline `<style>` in a
   `custom-liquid` block. On the PDP this is also a correctness rule: #236
   prunes an empty tab by `panel.textContent.trim() === ''`, and a `<style>`
   element's text defeats it.

## Order of work

Each step is shippable and reversible on its own, and none of them needs the
next one to have happened.

1. **Write `page-header`** and move `ona-page-title` and `ona-sr-heading` onto
   it. Smallest possible proof of the pattern, touches six templates and
   eight pages, no layout risk — provided the new section keeps the
   `page.title` fallback the two it replaces have today. Four of the six
   instances are blank and depend on it; do not convert them to literal text.
2. **Solve the decorative layer**, because steps 3 and 4 are blocked on it.
   All ten sourcing clones and `ona-training-image-text` render an
   `.animated-svg` blob that `media-with-content` drops — and so do
   `ona-content`, `ona-careers`, `ona-awards` and `ona-training-form`, each of
   which also has a gap row of its own, making 15 sections in all. Two of
   those four rows name a blocker **independent of the decorative layer**, so
   this step does not release them: `ona-awards` and `ona-training-form`.
   `ona-content` and `ona-careers` have gap rows that identify the shape and
   name the blob as the blocker, so this step *does* release them — do not go
   looking for a further decision on either. So every conversion
   those two steps were going to make is a visible regression until the blob
   has a target — either a component that carries a decorative layer, or the
   layer moving to CSS on the new section. This is a decision, not a
   conversion.
3. **Wholesale** — the biggest page and the most duplication, so the
   conversion is worth most there and the rest of the mapping is a repeat of
   it. Not startable before step 2.
4. **Barista courses**, the same conversions again, and the same
   prerequisite — **plus a second one that step 2 does not cover**.
   `ona-training-form` carries the blob *and* is blocked on its fixed
   `contact[subject]` ("Barista training enquiry",
   `sections/ona-training-form.liquid:51`), which stock `contact-form` cannot
   carry. Solving the decorative layer does not unblock this page; the subject
   setting has to exist first, or the conversion silently drops how those
   enquiries are routed. **The subject setting is not the whole of it**: the
   legacy form marks `name`, `email` and `body` `required` with visible labels
   and `contact-form` marks none of them, reports only the email error with no `role="status"` or `role="alert"`, hides its labels behind placeholders
   and adds a `tel` field, so this page needs the field set and validation
   settled as well — see [Known gaps](#known-gaps).
5. **About**, then **learn**. One section here is in the same shape as the
   form above — a blob carrier whose real blocker is something else, so step 2
   does not release it: `ona-awards`, which has five slider images *and* a
   twelve-row award table and no target holds both. `ona-content` and
   `ona-careers` are **not** in that category despite also carrying the blob:
   their gap rows identify the shape (two `group`s; `text` and `button`
   blocks, and `blocks/button.liquid` has the `link` the "VIEW LISTING" `url`
   needs) and say the blob is the blocker, so step 2 does release them.
   `ona-sustatnability` and `ona-sustainability-list` carry no blob at all and
   are blocked for their own reasons, which their gap rows give. Learn is two
   sections and is limited by content, not layout — but its tile mapping is
   blocked on its own gap row, the unnamed `group` link, which step 2 does not
   release either.
6. **Delete each section as its last use goes.** Nothing is unused today — all
   46 are referenced — so there is no up-front sweep to do. The four shared
   sections above are the only ones whose deletion needs more than one page
   converted.
7. **Tokens**: the 77 `custom` presets and the 15 padding values, once the
   sections they live in have stopped moving. Doing this first means doing it
   twice.
8. **The 20 inline `<style>` blocks**, independent of all of the above.

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
