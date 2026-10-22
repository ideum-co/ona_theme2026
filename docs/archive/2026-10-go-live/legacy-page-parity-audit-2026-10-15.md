# ONA production ZIP — page parity (15 October 2026)

Source: `theme_export__onacoffee-com-au-ona-media-block-fix-press-quotes-hidden-202__15OCT2026-0152am.zip` (715 files).

The production archive contains 16 valid page JSON templates, referencing **51 distinct section types**.

## Pages missing a same-named template in `main`
- About: `page.about.json` (7 sections)
- Wholesale: `page.wholesale.json` (19 sections)
- Barista training: `page.training.json` (10 sections)
- Bookings: `page.bookings.json` (4 sections)
- Learn: `page.learn.json` (2 sections)
- Private experiences: `page.private-courses-and-experiences.json` (3 sections)
- FAQ: `page.faq.json` (2 sections)
- Subscription FAQ: `page.faq-subscriptions.json` (2 sections)
- Sustainability: `page.sustainability.json` (2 sections)
- Privacy: `page.privacy.json` (2 sections)
- Subscriptions: `page.subscriptions.json` (2 sections)
- Melbourne: `page.melbourne.json` (3 sections)
- HTML sitemap, text-template and legacy special templates also missing.

`page.contact.json` is present in both themes, but must be compared for content parity. The legacy `page.location.json` file is not valid JSON; `main` has both `page.location.json` and `page.locations.json`. Verify actual resource suffixes and live functionality.

## Critical findings
Several referenced old sections have no equivalents in the new theme, for example `ona-inner-banner`, `ona-wholesale-partnership`, `ona-training-banner`, `ona-bookings-top`, `ona-faq-layout`, `ona-contact-info`, `ona-brewguides-and-training`, `ona-expericences-content`.

**Do not simply copy the legacy page JSON templates.** The sections, snippets, assets, app blocks, image references, custom fields and interactions also need migrating or rebuilding. Doing otherwise would risk blank or broken pages.

## Implementation / acceptance plan
1. Port Wholesale, Training, About, Bookings, Learn, Private Experiences first (customer-facing pages reported blank).
2. Port FAQs, subscriptions, sustainability, privacy, sitemap and other pages with missing special templates.
3. Compare Contact and Locations/Location for section completeness and interactions.
4. Validate desktop/mobile layouts, navigation links, embedded forms, conditional rendering, copy, images and app dependencies. Test preview against production ZIP, not generic fallback.
5. Do **not** change Shopify page `templateSuffix` shop-wide solely to cover a missing theme file; this affects the current production theme too.
6. Keep editorial config `templates/index.json`, `templates/product.json`, `config/settings_data.json` untouched until current Shopify theme-editor state is reconciled.

This document records confirmed repository/source-template differences. It does not assert that migration or storefront QA is complete. `main` is the *launch-target theme*, not the currently published theme.
