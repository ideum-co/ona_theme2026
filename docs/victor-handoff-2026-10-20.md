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

## 1. The mega menu is designed but not built

Screens 2 and 3 show a full-width maroon panel: a nav column (Shop, Learn,
Locations, About, Wholesale, Subscriptions), social icons, and three featured
product tiles with price — Ugly Sweater, Raspberry Candy, Paragon Filter.

The theme currently opens a **hamburger drawer at every width**, including
desktop. The markup is already there (`header-megamenu__card-image` elements
exist in the DOM, correctly `loading="lazy"` while closed), so this may be
closer than it looks.

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

**10 vector marks** are in `assets/` (PR #202): logo, wordmark, the New Harvest
and Brew Club badges, the three Subscribe & Save benefit icons, and press logos
for Broadsheet, Espresso Room and Urban List. Inline them with
`{{ 'name.svg' | inline_asset_content }}` — the eight single-colour ones use
`currentColor`, so they take the colour of whatever section they sit in.

Full inventory and the format reasoning: `~/ona-home-assets-2026-10-20/`.

---

## One coordination note

`templates/index.json` and `config/settings_data.json` both carried theme-editor
changes on the afternoon of 2026-10-19 that this repo does not have. Any merge
touching those two files wipes that work. Nothing I have open goes near them —
flagging it so a future PR does not.
