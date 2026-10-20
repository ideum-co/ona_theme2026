# Shopify Files — uploaded 2026-10-20

20 home-page assets, store `ona-coffee`. All `READY`, no file errors.
Base: `https://cdn.shopify.com/s/files/1/0464/4824/6934/files/`

Pick these in the theme editor (Content > Files), or reference the URL directly.
Append `?width=NNN` for a resized copy — the CDN serves WebP automatically.
Use `?`, not `&`: these URLs carry no query string, so `&width=400` becomes part
of the filename and 404s (verified — `?width=400` returns 25,550 bytes, the
same URL with `&` returns HTTP 404). Use `&width=NNN` only on a URL that already
has a parameter such as `?v=...`.

| block | file | master |
|---|---|---|
| Hero | `ona-home-01-hero-coffee-cherries.jpg` | 1920x1080 |
| Hero | `ona-home-01-hero-santuario-sul.jpg` | 1636x1091 |
| Find your Coffee | `ona-home-02-coffee-quiz.jpg` | 2140x1717 |
| Coffee spotlight | `ona-home-03-spotlight-gallery.jpg` | 400x599 |
| Coffee spotlight | `ona-home-03-bag-fazenda-um-supreme.png` | 735x1200 (alpha) |
| Coffee spotlight | `ona-home-03-bag-ugly-sweater.png` | 735x1200 (alpha) |
| Coffee spotlight | `ona-home-03-bag-maple.png` | 735x1200 (alpha) |
| Special release | `ona-home-04-special-release-ugly-sweater.jpg` | 2042x1459 |
| Subscribe & Save | `ona-home-05-subscribe-unboxing.jpg` | 1600x2400 |
| The sweet spot | `ona-home-06-sweet-spot-raspberry-candy.jpg` | 1920x1080 |
| More than coffee | `ona-home-07-about-sasa-sestic.jpg` | 1500x1001 |
| Learn with ONA | `ona-home-08-learn-latte-art.jpg` | 1200x800 |
| Learn with ONA | `ona-home-08-learn-pour-over.jpg` | 1200x800 |
| Learn with ONA | `ona-home-08-learn-cupping-class.jpg` | 1200x800 |
| Find ONA | `ona-home-09-find-ona-cafe.jpg` | 1200x800 |
| Discover by category | `ona-home-10-category-latte.jpg` | 1200x1200 |
| Discover by category | `ona-home-10-category-espresso.jpg` | 800x1200 |
| Discover by category | `ona-home-10-category-pour-over.jpg` | 960x1200 |
| Discover by category | `ona-home-10-category-brew-gear.jpg` | 1020x1020 |
| Discover by category | `ona-home-10-category-merch.jpg` | 1080x1080 |

Every file carries alt text. The three bag PNGs keep their transparency and are
served as WebP-with-alpha by the CDN.

The 12 SVGs in `vector/` were **not** uploaded here. **Ten** of them belong in
the theme's `assets/`, where Liquid can inline them, and shipped in #202. The
other two are **source-only** — `icons-social.svg` and
`icons-header-utilities.svg` were deliberately left out because the theme
already has equivalent artwork (`blocks/_footer-social-icons.liquid` and the
`icon-header-*.svg` set), so do not go looking for them in `assets/` and do not
add them. See MANIFEST.md. (Codex, #203 — this had said all 12 were deployable,
which contradicts the handoff's count of ten.)
