# Review of `ona_theme2026/main` — 16 October 2026

Victor, this is a check of your nine merged PRs (#169–#177) against the repository **and**
against theme `154676789439`, which is what `main` actually deploys to. Where your report and
the theme disagree, the theme wins — that is the point of the exercise.

Short version: **53 of the 55 theme files your merges touched arrived byte-identical. Two did
not, and nothing anywhere reported it.** Everything else below follows from that one fact.

- Repo at review: `main` = `77174e8`. Theme `154676789439`, Horizon 4.1.4, `updatedAt`
  `2026-10-15T23:56:40Z`.
- Method: md5 of every changed file on both sides; HTTP fetch of every affected page against
  that theme with `Shopify.theme.id` asserted; every link destination resolved.

---

## 1. The one thing to take from this review

**A clean merge is not a deployment.** The Shopify GitHub integration validates each file as it
writes it, and **a file that fails validation is silently dropped**. No error on the PR, no
failed check, nothing in the admin, nothing in the commit. Sibling files in the same commit sync
normally, so the merge looks complete from every angle except the storefront.

PR #175 is the proof. It changed three files. One synced, two did not:

| file | repo `main` | theme `154676789439` | theme `updatedAt` |
|---|---|---|---|
| `assets/legacy-page-layout.css` | `cd1475c0`, 8113 b | `cd1475c0`, 8113 b ✅ | 15:07:16Z — #175 |
| `sections/ona-training-form.liquid` | `eaf23019`, 3058 b | `e1051aec`, **1943 b** ❌ | 13:24:03Z — **#171** |
| `sections/ona-expericences-content.liquid` | `d18127ac`, 2229 b | `0fd2da63`, **1125 b** ❌ | 13:24:01Z — **#171** |

The two rejected files are still sitting at their #171 content, a day later. The cause:

```liquid
{% form 'contact', id: 'ona-training-' | append: section.id, class: '...' %}
```

`{% form %}`'s grammar is `{% form 'type', attribute: string %}`. It takes a literal or a
variable — **not a filter pipeline**. (`{% render %}` does take one, which is why only `form`
broke.) Assign first, pass the variable:

```liquid
{%- assign form_id = 'ona-training-' | append: section.id -%}
{% form 'contact', id: form_id, class: 'ona-legacy-contact-form' %}
```

**What this means for you:** after any merge that could ship, compare the checksum of each
changed file against the theme before you call it done. `docs/tools/compare-themes.sh` does the
sweep. The same failure is why the old `staging` theme is missing six templates — see §5.

---

## 2. Your list, item by item

> **Migración de páginas:** About, Wholesale, Barista Training, Bookings, Learn, Private Courses

**4 of 6.** All six templates exist and return 200. Four carry real content; two do not:

| page | sections | rendered body text | |
|---|---|---|---|
| `/pages/wholesale` | 25 | 12,774 chars | ✅ |
| `/pages/barista-courses` | 16 | 4,361 | ✅ |
| `/pages/canberra-bookings` | 4 | 2,437 | ✅ |
| `/pages/about` | 7 | 2,404 | ✅ |
| `/pages/private-courses-and-experiences` | 3 | 831 | ⚠️ heading + breadcrumbs + one block |
| `/pages/learn` | 2 | **267** | ❌ `ona-page-title` + two cards, nothing else |

Learn and Private Courses are placeholders, not migrations. The source content is in
`docs/legacy-page-templates/page.learn.json` and `page.private-courses-and-experiences.json`.

> **Responsive:** tipografías, paddings, espaciados, imágenes y distribución, desktop y mobile

The CSS exists and is correctly scoped — `legacy-page-layout.css` loads only for the six
migrated suffixes, `home-mobile-overflow.css` only on `index`. Both land on the theme.
**But it only reaches 34 of the 43 migrated sections, and the gaps are visible ones.** That is
its own document: `docs/archive/2026-10-go-live/responsive-mobile-review-2026-10-16.md`. Read it before the next pass.

> **Homepage:** enlaces de navegación y CTAs — Coffee Club, Barista Courses, About, Coffee Quiz

✅ Confirmed on the theme, all four destinations resolve 200: `/collections/coffee-subscriptions`,
`/pages/about`, `/pages/barista-courses`, `/collections/all-coffee`. (`/pages/coffee-club` is a
404 but nothing points at it.) This also settled the quiz's long-open `explore_link`.

One link you did not touch is still dead: `learn_with_ona` col2 points at
`/pages/brewing-guides`, which does not exist. Fixed in **#179** → `/blogs/brewguides`.
That card has now been wrong twice in different ways, so it is worth knowing why a check that
counts anchors will never catch it: **resolve every destination, don't just confirm the href is
non-empty.**

> **Cards de productos:** alineación de variantes y botones, actualización dinámica de precios

✅ `assets/product-card.js` on the theme is md5-identical to `main`. The `priceContainers[1] ??
priceContainers[0]` fix is live.

> **Mobile:** desbordamiento horizontal en el homepage

Shipped and on the theme. **Partially effective** — the rules are keyed to
`.ui-test-product-list`, which is a schema class belonging to `sections/product-list.liquid`
alone. Details and the risk in the responsive document, §3.

> **Header:** áreas clicables de los iconos

✅ `snippets/search.liquid` is md5-identical on the theme. The 21px-of-44px search target is
fixed.

> **Formularios:** formularios nativos de Shopify en Training y Private Experiences

❌ **Not deployed** — this is the #175 failure in §1. As of now, three pages print a raw app
shortcode as literal body text:

| page | shows | section |
|---|---|---|
| `/pages/barista-courses` | `{formbuilder:112210}` | `ona-training-form.liquid` |
| `/pages/private-courses-and-experiences` | `{formbuilder:50341}` | `ona-expericences-content.liquid` |
| `/pages/wholesale` | `{formbuilder:50188}` | `ona-gust-r.liquid` |

The third was never in scope for #175 and is visible in the page's text flow, between
"…care, service and support we bring to the table." and "Join our community". Fixed in **#178**.

> **UX:** enlaces y controles sin funcionalidad — CTA del quiz, botón de Awards

✅ Awards: zero occurrences of "load more" on the rendered About page. Quiz CTA: set and
resolving.

---

## 3. Still missing

**Two pages are placeholders** — Learn (267 chars) and Private Courses (831). See §2.

**Eight page suffixes are in use shop-wide with no template in this theme.** `templateSuffix` is
set on the Shopify page object and is **shop-wide**, so these affect both themes:

| suffix | state on theme `154676789439` |
|---|---|
| `faq` | renders, 172 chars — effectively blank |
| `faq-subscriptions` | 224 chars — effectively blank |
| `llms` | **4 chars** |
| `sustainability` | `/pages/womenincoffee` → 860 chars |
| `privacy` | 9,308 chars — acceptable via the default `page.json` fallback (body is rich text) |
| `text-template` | same fallback; `/pages/shipping-information` → 3,551 chars, acceptable |
| `html-sitemap` | `/pages/sitemap` 301s to `/` |
| `maintenance` | not exercised |

Archived source for six of them is in `docs/legacy-page-templates/`. The first four need
rebuilding; the two marked acceptable can ship as they are.

**`/pages/solar` 301s to `/` and is still linked from the About page.**

**Four product-suffix outcomes are unbuilt.** `templates/product.json` is the only product
template, so all 92 active products render it; the suffix census is `(none)` 36, `product-2` 26,
`product-3` 22, `Default product` 6, `filtersub` 2.

**Ten app embeds are disabled.** `config/settings_data.json` is 4,796 b with no `"blocks"` key.
Live has Judge.me, Qikify, EG Auto Add to Cart, Dotdigital, MinMaxify, Shopify Inbox, Powerful
Form Builder, **Appstle Subscriptions**, WOD Preorder Now and Shopify Forms. Audit per app —
`blocks/purchase-options.liquid` genuinely replaces Appstle's widget by reading Shopify's own
`selling_plan_groups`, so this is not a copy-the-list job. Appstle is what runs the subscription
products; publishing without deciding is the single largest silent-breakage risk left.

---

## 4. Three open PRs, and the order they go in

| PR | what | base | note |
|---|---|---|---|
| **#179** | theme-editor state + the dead Brewing Guides link + the In Sequence campaign metadata | `main` | **merge first** |
| **#178** | the three enquiry forms Shopify refused | `main` | any order after #179 |
| **#180** | training-banner preload breakpoint | `main` | independent |

**#179 must go first.** It is the only PR touching `templates/index.json` and
`templates/product.json`, and those two files carry six decisions that exist **only in the theme
editor** — any merge that writes them without #179 reverts all six:

- `floating_badge_r89NRP` is **disabled on the theme** (New Harvest, campaign over) and enabled
  in `main`. Merging `main` as-is switches the badge back on.
- `product_highlight_KkUAVM` now runs **In Sequence** on the theme (`in-sequence`,
  `Inseq3nce_top.png`, the four-processing-methods copy); `main` still has Raspberry Candy and
  Ugly Sweater copy.
- `product.json` carries the **Judge.me reviews widget** inside `product_tab_dFwTTp`, plus zoom
  off and three disabled sections. **That file is the only record of the Judge.me widget**;
  merging `main` deletes it.

#179 also makes **one deliberate storefront change**, flagged so you can veto it: the Special
Release eyebrow said `MILK-BASED` and the spec said "Winey, dark chocolate and dark fruit" while
displaying a filter coffee. Both were already wrong for the previous occupant too. They now read
`FILTER` and "Citrus, floral and fruity", taken from the product's own Shopify tags.

#159 is superseded and should be closed — it would disable `find_your_coffee` and
`product_highlight_KkUAVM`, both of which are now live.

**After #178 merges, one thing stays broken on `/pages/wholesale`:** `ona-gust-r` is marked
`.pop-up-form` but no CSS hides it and no JS opens it, so the form renders inline in the page
body and the "Get in touch" button does nothing. #178 replaces the shortcode with a working
form; it does not make the popup a popup. See the responsive document, §4.

---

## 5. Branches — `staging` is dead, use `staging-v2`

Theme `160919748799` (`ona_theme2026/staging`) last updated **2026-10-15T11:17:45Z**. Three
commits merged to `origin/staging` at 13:04Z and never arrived. Only `layout/theme.liquid` of
eight probed files exists on it; all six JSON templates are absent. The sync is broken, not slow.

The branch is equally stale. Measured today, **`staging` contains nothing that `main` lacks** —
52 files exist only on `main`, 2 differ, 0 exist only on `staging`, and in both differing files
`main` is the newer and more complete side. There was nothing to port.

So `staging` has been replaced by **`staging-v2`**, created at `77174e8` — identical to `main`
today. The flow from here:

```
branch from main  ──PR──▶  staging-v2  ──verify on the staging theme──▶  PR ──▶  main
                                                                                   │
                        staging-v2 fast-forwarded to main after each promotion ◀───┘
```

The rule the old branch broke: **`staging-v2` is never allowed to drift behind `main`.** Old
`staging` fell 9 commits behind, which is what made it unmergeable and eventually pointless.
Fast-forward it after every merge to `main`.

Until Felipe reconnects the staging theme in the Shopify admin, `staging-v2` has no preview, so
urgent fixes still go straight to `main` — that is why #178/#179/#180 are based there.

---

## 6. Please don't re-diagnose these

- **Do not delete theme `160815546559`.** It is the published theme and the named rollback, and
  it is the only place the In Sequence banner currently runs for customers.
- **Shopify limits, enforced silently:** 25 sections per JSON template, 50 blocks per section.
  `templates/index.json` is at **25/25**. #151 pushed it to 28 and the integration simply
  declined the file.
- **JSON templates never match by checksum.** They are stored minified and returned pretty.
  Parse and compare the trees.
- **Horizon 4.1.4 removed `ThemeEvents.variantUpdate`, `variantSelected` and `cartUpdate`.** Use
  `StandardEvents.productSelect` + `event.promise`.
- **`.wowo` / `data-wow-*` on the migrated markup is inert** — no WOW.js, no CSS. Elements are
  simply visible, which is the safe failure. Dead weight to clean up, not a bug to chase.
- Horizon 4.1.4 → 4.3.0 is deliberately last: 26 real conflicts across 8 files, 59 lines.

## 7. Only Felipe can do these (Shopify admin, not the repo)

1. Disconnect and reconnect the branch on the staging theme, or point it at `staging-v2`.
2. Enable the chosen app embeds (§3).
3. Make `unit` a required check on `main`.
4. Rename theme `160815546559` so its role is obvious.

## 8. Nobody can verify these from a terminal

Chrome here clamps resizing at about 1283px and the storefront blocks iframes via
`frame-ancestors`, so no real mobile viewport is reachable. Everything below needs a physical
device, and none of it has been confirmed:

the homepage hero · the PDP media gallery · the cart drawer · whether #177 actually removed the
overflow · the migrated pages at 375px and in the 750–989px tablet band · a real test purchase
confirmed in GA4 with revenue and session attribution intact.

The checklist for that pass is `docs/archive/2026-10-go-live/responsive-mobile-review-2026-10-16.md`.
