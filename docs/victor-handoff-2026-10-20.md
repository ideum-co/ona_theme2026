# For Victor — 2026-10-20

Everything here is in your lane: the home page, the header, and the quiz. I have
stayed out of all of it. My work is on `/pages` and `/blogs` — see
`docs/legacy-sections-unstyled-2026-10-20.md`.

Source for items 1 and 2 is the XD prototype:
<https://xd.adobe.com/view/1d6791a5-7387-49ad-8fb3-34c22e30efd1-4834/>

---

## What that prototype actually contains

11 screens, one flow, link updated 6 Oct:

| screens | what |
|---|---|
| Web 1920 – 1 | the home page |
| Web 1920 – 2, 3 | **mega-menu open states** |
| Web 1920 – 4 … 11 | **the 8-screen Coffee Quiz flow** |

Worth saying plainly, because it shaped the plan: there is **no design in here
for wholesale, brew guides, barista courses, or any other `/pages`**. If a
second prototype covers the inner pages, it would change what we do next —
please share it.

---

## 1. The mega menu is built — compare its contents against the comps

Screens 2 and 3 show a full-width maroon panel: a nav column (Shop, Learn,
Locations, About, Wholesale, Subscriptions), social icons, and three featured
product tiles with price — Ugly Sweater, Raspberry Candy, Paragon Filter.

The desktop mega menu is **already built**, and has been since #89 and #97 in
August: `snippets/header-drawer.liquid` renders `header-megamenu` into the same
`<details>` as the drawer, and `header-megamenu.liquid` swaps the two at
`min-width: 750px` — drawer below it, full-width panel above. An earlier draft of
this handoff said the drawer opened at every width; that was simply wrong, and
Codex caught it on PR #203. So the question is not whether the panel exists but
whether its **content** matches screens 2 and 3 — worth a look, not a rebuild.

## 2. The Coffee Quiz flow has 8 comps, the theme has one modal

`sections/coffee-quiz.liquid` renders a `<details>`-style modal that is
correctly `hidden` until opened, and the custom element upgrades cleanly. What
it does **not** obviously match is the eight designed screens — each a full
maroon question panel ("What are you looking for?", "How adventurous are you?",
and so on) with the recommended-coffee results beneath.

Worth walking the built flow against screens 4–11 before go-live.

## 3. "Add to cart" wraps to two lines on product cards

Measured after your #200 (`anchor the purchase block to align the CTAs`):

- card bottoms now **align correctly** — your fix works
- the button is **139px wide** and the label still wraps to **2 lines**

Yours was vertical alignment; this is horizontal width. The button shares its
row with **Subscribe**. Live gives Add-to-cart the full card width (247px) and
it does not wrap.

Options: stack the two buttons, drop the cart icon, or shorten the label. Left
alone because it is a layout decision in a file you are actively working in.

## 4. Flagship photography

`locations-flagships` renders 16 images and leads with **ONA Dubai**. Live shows
the five Australian flagships across 43 images. The section works; which stores
and photos are configured is a content call.

---

## Assets you can now use

**20 photographs** are in Shopify Files, named `ona-home-*`, each with alt text,
cut from 41.2 MB to 4.33 MB. Pick them in the editor. The CDN serves WebP
automatically — including for the three transparent bag cut-outs, which keep
their alpha.

**10 vector marks** are in `assets/` — merged in #202. Logo, wordmark, the New Harvest
and Brew Club badges, the three Subscribe & Save benefit icons, and press logos
for Broadsheet, Espresso Room and Urban List. Inline them with
`{{ 'name.svg' | inline_asset_content }}` — the eight single-colour ones use
`currentColor`, so they take the colour of whatever section they sit in.

Full inventory and the format reasoning:
[`docs/home-assets-2026-10-20/MANIFEST.md`](home-assets-2026-10-20/MANIFEST.md)
(every extracted file, its source frame and why it is raster or vector) and
[`SHOPIFY-FILES.md`](home-assets-2026-10-20/SHOPIFY-FILES.md) (the uploaded CDN
URLs). These were only in my home directory until now, which meant the link
resolved to nothing for anyone else — Codex, #203.

---

## 5. Two findings in your video code (#195)

Codex raised these while reviewing a branch of mine that happened to carry your
`#195` in its diff. They are in your code, not mine, and both look real — so
rather than touch them I am passing them over.

**`assets/autoplay-video.js`** — when a hero has separate desktop and mobile
videos, both elements stay in the DOM and CSS hides one of them
(`.hero__media-wrapper--desktop` / `--mobile`). The `play()` nudge is
unconditional, so it also starts the hidden one: two background videos decoding
at once, on exactly the iOS devices the nudge exists for. Gating it on the
active wrapper would fix it — `VideoBackgroundComponent` already does this.

**`assets/video-background.js`** — if the viewport crosses 749px while an active
background video is still loading, `syncPlayback` pauses the now-hidden layer,
but its pending `canplay` listener survives. When loading finishes the callback
calls `play()` without rechecking `shouldPlay()`, so the hidden layer restarts
alongside the visible one. Either guard the retry with the layer predicate or
drop the listener when the layer goes inactive.

Neither is visible on screen — both cost battery and decode budget on mobile,
which is where the autoplay work was aimed in the first place.

## One coordination note

`templates/index.json` and `config/settings_data.json` both carried theme-editor
changes on the afternoon of 2026-10-19 that this repo does not have. Any merge
touching those two files wipes that work. Nothing I have open goes near them —
flagging it so a future PR does not.
