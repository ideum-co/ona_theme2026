# Legacy page templates — reference copies, not theme files

> ⚠️ **These are not part of the theme and must never be copied into
> `templates/` unchanged.** They are written for the *previous* theme's
> sections and settings schema. Copying one into `templates/` would ship
> section types this theme does not define.

## What these are

Verbatim copies, pulled 2026-10-15, of the JSON templates on theme
**`160335790271`** ("ONA - media block fix + press quotes hidden…") — the theme
that was published until 2026-10-14 ~15:43Z and is now the rollback.

## Read this before using them: `onacoffee_theme` is the better source

**These were archived on a mistaken premise.** The README said the content was
in no repository. Checked properly on 2026-10-15, against
`onacoffee_theme` `origin/main`:

| | |
|---|---|
| **12 of 14** | **identical in content** to `templates/<name>` in that repo — only JSON formatting differs, because the Admin API pretty-prints what the theme stores minified |
| `page.wholesale.json` | same 19 sections; **one** leaf differs — `wholesale_sourcing_v6.disabled` is `true` on the theme and **absent in the repo** |
| `product.filtersub.json` | the repo's copy is the **newer** one and has an `ona-product-complementary` section; this archived copy, taken from `160335790271`, does not |

**So port from `onacoffee_theme`, not from here** — it is a working theme
repository with history, not a flat snapshot.

What this directory is still good for is narrow and worth keeping: it is a
dated record of what theme `160335790271` actually held, and the two rows above
are the exact places that record differs from the repo. In particular, porting
`page.wholesale.json` straight from `onacoffee_theme` would **re-enable
`wholesale_sourcing_v6`**, which the editor had switched off.

`docs/post-publish-review-2026-10-15.md` §2 records the consequence: while the
2026 theme was published, eight pages rendered a heading and nothing else,
because their content lived in these templates.

> **Not the case right now.** Theme `160815546559` was published on
> 2026-10-14 at 22:00:42Z and it *has* these templates, so those pages render
> normally on the storefront today. The archive matters for the **next**
> attempt at publishing the 2026 theme: that is when these eight pages go
> blank again unless the templates have been ported first.

## Provenance

Pulled with:

```graphql
{ node(id: "gid://shopify/OnlineStoreTheme/160335790271") {
    ... on OnlineStoreTheme {
      files(first: 14, filenames: ["templates/page.about.json", ...]) {
        nodes { filename size checksumMd5
                body { ... on OnlineStoreThemeFileBodyText { content } } } } } } }
```

| file | sections | stored on theme | `checksumMd5` on the theme |
|---|---|---|---|
| `page.wholesale.json` | 19 | 28,724 b | `45e6dc5925b8de5d32dfd9fb980ca6f3` |
| `page.faq-subscriptions.json` | 2 | 11,968 b | `b84c7761949978aa6be999215f13cccf` |
| `page.faq.json` | 2 | 11,754 b | `19666a9215488f4873890dd75e730aee` |
| `page.training.json` | 10 | 9,861 b | `3b999d33f1efe3902ef927a96b53b0a9` |
| `product.filtersub.json` | 8 | 6,596 b | `3a78daf74e8e733cfb2a31ebae28f3c3` |
| `page.about.json` | 7 | 5,172 b | `3ba55e5a1ff24b5df2d4fa68fb096318` |
| `page.html-sitemap.json` | 3 | 4,405 b | `93cd3bc90b48edced0586754dac2cd3c` |
| `blog.brewguides.json` | 3 | 4,226 b | `200c5fea8c49aa80f6808795c0f4f3b3` |
| `page.private-courses-and-experiences.json` | 3 | 1,648 b | `a3402db15e384c1f57c9fb6c39e567cd` |
| `page.learn.json` | 2 | 991 b | `7abfeb18ba8af47669f363966467afb2` |
| `page.bookings.json` | 4 | 638 b | `c5e3fe741a429d7e04327fb7eda425b6` |
| `page.privacy.json` | 2 | 365 b | `05dbc9e37367255b7080127cefef9dc1` |
| `page.sustainability.json` | 2 | 268 b | `65f8a8f0021eb2b83b37188d33f7bbfb` |
| `page.text-template.json` | 2 | 240 b | `78ea1ddb39d7a1bdb15e35e40dd2796f` |

The "stored" column is the theme's own byte count, which is smaller than the
file here: the theme stores JSON minified, while the Admin API returns it
pretty-printed with a generated banner. So the `checksumMd5` above will **not**
match `md5sum` of the file in this directory — it is recorded to identify the
source revision, not to verify these copies.

## Which pages each one served

The "2026 theme" column is how each page rendered while `154676789439` was
published — the state the port has to fix. On the storefront today, served by
`160815546559`, they all render.

| suffix | pages | on the 2026 theme |
|---|---|---|
| `wholesale` | Wholesale Coffee | **blank** |
| `training` | Barista Courses | **blank** |
| `about` | About | **blank** |
| `learn` | Learn | **blank** |
| `bookings` | Canberra / Sydney / Melbourne bookings | **blank** |
| `private-courses-and-experiences` | Private courses and experiences | **blank** |
| `faq` | FAQ | heading only |
| `faq-subscriptions` | Coffee Subscription FAQ | heading only |
| `privacy` | Privacy | renders — content is in the page body |
| `sustainability` | Solar, A whole new coffee world, Women In Coffee | renders — page body |
| `text-template` | Shipping & Returns | renders — page body |
| `html-sitemap` | Sitemap | page 301s to `/` |

`blog.brewguides.json` and `product.filtersub.json` are included because they
are the other two bespoke templates with real layout work in them; both
currently fall back to a generic template that does render.

## How to use one

Read it for **content and intent** — the copy, the image handles, the section
order, the metafield references — then rebuild the page against this theme's
Horizon sections and commit the result as `templates/page.<suffix>.json`.

Adding the template file is the correct fix. **Do not re-point the page's
`templateSuffix` instead**: a suffix lives on the page resource, not on the
theme, so changing it moves the page on the *published* theme immediately and
would also break it on the rollback.
