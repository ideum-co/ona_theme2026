# Go-live: what the live theme does that `ona_theme2026` does not — and what to do after publishing

**Measured 2026-10-19 against the live store.** Every number here came from the
Admin API or from fetching the rendered page with `?preview_theme_id=`, not from
reading the repository.

| | theme | role |
|---|---|---|
| live today | `160815546559` "PREVIEW - product media fills column (PR #46)" | **MAIN**, Horizon 3.5.1 |
| going live | `154676789439` `ona_theme2026/main` | unpublished, Horizon 4.1.4, GitHub-connected to `main` |

Publishing swaps those two. Everything in §1 breaks the moment it happens and
cannot be fixed from this repository — all of it lives in the Shopify admin.

---

## 1. Blocking: the ten app embeds

`config/settings_data.json` on the live theme carries a `"blocks"` key with ten
app embeds, **all enabled**. The same file on `154676789439` is 4,796 bytes and
has **no `"blocks"` key at all** — and neither does the repository copy (6,124
bytes, also no blocks). So this is not a sync problem to fix in git; the embeds
have simply never been turned on for the 2026 theme.

App embeds are per-theme. Publishing does not carry them across.

| app | what breaks without it | block type on the live theme |
|---|---|---|
| **Judge.me Reviews** | every review on the site. `templates/product.json` already places the review widget block, so the PDP renders an empty review area | `judge-me-reviews/blocks/judgeme_core/61ccd3b1-a9f2-4160-9fe9-4fec8413e5d8` |
| **Appstle Subscriptions** | the subscription helper. The theme's own `blocks/purchase-options.liquid` replaces Appstle's *widget*, but the helper drives selling-plan behaviour and the customer portal — audit before assuming it is redundant | `appstle-subscription/blocks/appstle-subscription-helper/fe257d39-6f88-4f35-ab08-bd437e3aa94e` |
| **Powerful Form Builder** | the three enquiry forms this repo has now replaced natively — see §3. Still needed if any other page uses a `{formbuilder:N}` shortcode | `powerful-form-builder/blocks/app-embed/e4bcb1eb-35b2-42e6-bc37-bfe0e1542c9d` |
| **Shopify Forms** | newsletter / lead capture forms | `forms/blocks/forms/8744a304-fcb1-4347-b211-bb6b4759a76a` |
| **MinMaxify Order Limits** | order minimums and maximums stop being enforced at the cart | `minmaxify-order-limits/blocks/app-embed-block/3acfba32-89f3-4377-ae20-cbb9abc48475` |
| **EG Auto Add to Cart** | automatic cart additions (settings carry `"version": "v3"`) | `eg-auto-add-to-cart/blocks/app-embed/0f7d4f74-1e89-4820-aec4-6564d7e535d2` |
| **Qikify Upsell** | upsell / cross-sell surfaces | `qikify-upsell/blocks/app-embed/2e94b962-8172-4839-8ad9-7837eb8b017a` |
| **WOD Preorder Now** | pre-order buttons and their messaging | `wod-preorder-now/blocks/app-embed/fdf17d17-ef12-4a7b-8383-20cc1fc2a4b6` |
| **Shopify Inbox** | the chat widget (live settings: black button, bottom-right, lowest) | `inbox/blocks/chat/841fc607-4181-4ad1-842d-e24d7f8bad6b` |
| **Dotdigital** | chat (live setting `"region": "none"`) | `dotdigital/blocks/chat/c700cfad-505e-4909-b824-9f4209a2754e` |

### How to enable them

Admin → **Online Store → Themes →** `ona_theme2026/main` **→ Customise → App
embeds**, and switch each one on. Do this **before** publishing, on the
unpublished theme, so it can be previewed.

Do not hand-write the `"blocks"` key into `config/settings_data.json` in this
repository as the first move. Some apps re-provision their embed when it is
toggled through the admin, the numeric block keys are arbitrary, and
`settings_data.json` is shop-owned — a repo write races the editor. Enable them
in the admin, then reconcile the resulting file back into the repo in its own
commit so the list is recorded in version control.

**Audit each one as you go rather than enabling all ten reflexively.** Powerful
Form Builder is the clear candidate for retirement once §3 lands, and Dotdigital
and Shopify Inbox are two chat widgets on one site.

---

## 2. Blocking: the map on `/pages/locations`

The page uses template suffix **`location`** (singular → `templates/page.location.json`).
`templates/page.locations.json` is **not used by any page** and is dead weight.

**Nothing about Google changed. The key was never carried across.** The live
store finder is a different section — `sections/ona-store-finder.liquid`, class
prefix `.ona-sf__`, driven by `assets/ona-store-finder.js` — and its first line
is:

```liquid
assign google_key = section.settings.google_api_key | default: 'AIzaSy…pmJ7k'
```

A hardcoded fallback key. That is why the map has always worked on the live
theme even with the section setting empty. The 2026 rebuild
(`sections/locations-store-finder.liquid`, `.locations-store-finder__*`) reads
`section.settings.maps_api_key` with **no default**, and nobody has filled it
in, so the rendered config is `"mapsApiKey": ""` and the script posts
`no_map_key_status` instead of drawing a map. Same Google product, same account,
same API — just an empty setting.

> **Felipe sets the key; nobody else can.** Customise → the store finder section
> → **Maps API key**. The current value is visible in the page source of
> `/pages/locations` on the live theme, in the `window.__onaSf` script block.
> Restrict it to the `onacoffee.com.au` referrer in Google Cloud if it is not
> already.
>
> ⚠️ **Where that value lands is a trap.** `maps_api_key` is a *section setting*,
> so the editor writes it into `templates/page.location.json` — a file this
> repository tracks. The moment it is set in the admin, the theme's copy and the
> repo's copy diverge, and the next merge that touches that file wipes the key
> and the map goes dark again with no error. Two ways out, and it needs a
> decision: either commit the key to the repo as the live section does (it is
> already public in every page's source, so this leaks nothing new), or treat
> `templates/page.location.json` as reconcile-before-you-touch like the other
> shop-owned JSON in §5 of `docs/branching-and-release.md`.

**Map as the primary view — restored.** Production serves `data-view="map"` with
the Map toggle already active; the 2026 section was serving the list and leaving
the switch to the script. `templates/page.location.json` now sets
`default_view: "map"` and the section renders that view server-side.

Two defects had to be fixed first, both found by Codex on PR #191, because
without them a served map view is worse than no map view:

1. `setView('map')` reset to the list before awaiting the Maps API, so a served
   map view flipped map → list → map. The script now seeds `activeView` from the
   rendered `data-active-view` and only resets when it is not already the map.
2. The `max-width: 990px` rule hid `.locations-store-finder__list-panel` in map
   view. A visitor whose script never ran would have seen an empty grey box and
   no way to reach 250 locations. The list is no longer hidden at any width — on
   narrow screens the map stacks above it, which is what production does.

A test pins all of it together, because the served map view is only safe while
both fixes hold.

The data side is ready: 250 store locations, **all 250 with coordinates**.

> **Do not copy production's attribution CSS.** `sections/ona-store-finder.liquid`
> hides the Google logo and the "Report errors" link, with a comment in the file
> admitting `NOTE: violates Google Maps TOS`. Whatever is decided about that on
> the live theme, it should not be carried into the new one by default.

## 3. Blocking: the three enquiry forms (fixed here, must be verified)

On the go-live theme today, three pages render a literal app shortcode to
customers and have no working form:

| page | renders | native form present |
|---|---|---|
| `/pages/wholesale` | `{formbuilder:50188}` | no |
| `/pages/barista-courses` | `{formbuilder:112210}` | no |
| `/pages/private-courses-and-experiences` | `{formbuilder:50341}` | no |

The repository has had the fix since PR #178/#183 (merged 2026-10-16T10:21Z).
The theme's copies are still the 2026-10-15T13:24Z versions. **The GitHub
integration skipped these three files**, and does not revisit a file until its
content changes again.

This is *not* a Liquid validation failure. On 2026-10-19 the byte-identical repo
file was upserted to a scratch theme through the Admin API and accepted, checksum
`2a77a3f0e95a396fc6f7330cb54006d3` matching `md5sum` of the repo file exactly.
(PR #175's earlier copy *was* genuinely invalid — a filter pipeline inside the
form tag's argument list — which is where the "the integration drops invalid
Liquid" theory came from. It does not explain this one.)

This PR changes the content of all three files so the integration has something
to re-pull.

> **After merging, verify by checksum. A clean merge is not evidence.**
> ```graphql
> { theme(id: "gid://shopify/OnlineStoreTheme/154676789439") {
>     files(first: 5, filenames: [
>       "sections/ona-training-form.liquid",
>       "sections/ona-expericences-content.liquid",
>       "sections/ona-gust-r.liquid"
>     ]) { nodes { filename checksumMd5 size updatedAt } } } }
> ```
> Compare against `md5sum sections/ona-*.liquid`. If they still disagree after a
> few minutes, the remaining option is to disconnect and reconnect the branch in
> the admin — and to confirm the first sync by checksum, not by the theme
> appearing in the list.

---

## 4. Not blocking, but visible on day one

| | live theme | `ona_theme2026` | note |
|---|---|---|---|
| **favicon** | `shopify://shop_images/favicon.png` | **not set** | browsers fall back to the default Shopify mark. One setting in Customise → Logo and favicon |
| **page templates** | all 15 page suffixes have one | 8 of 15 | see §5 |
| **wholesale "Get in touch"** | opens the form popup | `href="javascript:void(0);"` with no JS behind it | the form itself now renders inline further down the page, so the page works — the button is just dead |
| **wholesale/bookings FAQ accordion** | opens | `sections/ona-faq-lists.liquid` uses `is-active` but ships no script, and no asset references `.add-faqs-section` | the panels cannot be opened |
| **coffee quiz** | — | one dead match: `"tag": "ugly-sweater"`, `"url": null`, `"available": false` | sends people to nothing |
| **typography** | Karla + Playfair Display via the font picker | font picker says Inter; `snippets/brand-fonts.liquid` redefines `--font-body--family` etc. to Karla + Silk Serif **later in the document**, so the brand faces win | verified on the rendered homepage. Cosmetic risk only: the admin font picker now lies, so set it to the brand faces to stop someone "fixing" it |

---

## 5. Page templates that do not exist on the 2026 theme

Nine pages fall through to the generic `page.json`:

| suffix | pages | verdict |
|---|---|---|
| `faq` | FAQ | needs rebuilding |
| `faq-subscriptions` | Coffee Subscription FAQ | needs rebuilding |
| `sustainability` | Solar, A whole new coffee world, Women In Coffee | needs rebuilding (3 pages) |
| `llms` | llms | needs rebuilding |
| `privacy` | Privacy | acceptable on the fallback — it is body copy |
| `text-template` | Shipping & Returns | acceptable on the fallback |
| `maintenance` | Maintenance | never exercised |

Archived source for the migrated six is in `docs/legacy-page-templates/`.
`templates/page.locations.json` is present but unused — no page carries that
suffix.

---

## 6. Order of operations

1. **Merge this PR**, then verify the three form files by checksum (§3). Nothing
   else should start until that is confirmed.
2. **Enable the app embeds** on the unpublished theme (§1), auditing each.
3. **Add the Maps API key** (§2a) — Felipe only.
4. **Set the favicon** (§4).
5. **Preview and walk**: the three form pages, `/pages/locations` (map first),
   a PDP (reviews, subscriptions, add to cart), the cart and checkout, the
   homepage.
6. **Name the rollback.** `160815546559` is what is live today and is the
   rollback. Do not delete it. Confirm which theme is `MAIN` immediately before
   publishing — it has changed twice without notice.
7. **Publish** — Admin only; the connector blocks `themePublish`.
8. **After publishing**, re-walk the same list against the live domain with no
   `preview_theme_id`, and re-check that `config/settings_data.json` still shows
   ten enabled embeds.

## 7. Housekeeping

Four diagnostic files — `sections/zz-probe-a.liquid`, `zz-probe-b.liquid`,
`zz-probe-c.liquid`, `zz-probe-exact.liquid` — were written to unpublished
throwaway theme **`160861159615`** ("PREVIEW - WFG counter (PR #149)") on
2026-10-19 to establish the §3 finding. `themeFilesDelete` is blocked by policy,
so they need removing in the admin, or simply delete that theme — it is
unpublished, is nobody's rollback, and its content is in this repository.
