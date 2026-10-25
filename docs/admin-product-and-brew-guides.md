# ONA product pages and Brew Guides: admin workflow

Last checked: 25 October 2026. The ONA Brew Guides app is installed on the ONA Coffee store. Its browse page currently shows **no guides created**, so treat existing product and article recipes as legacy content until each guide has been reviewed and saved in the app.

## Before editing a product

1. Open **Shopify admin → Products → the product**. Check its status, title, description, media, variants, prices, and assigned theme template. Product values belong on the product; the template controls the layout shared by products using it.
2. For a coffee, compare the current product page's **Brew Guide** tab with its linked full article before changing either. Copy the intended recipe values into a working note. The two surfaces have separate stored values and can disagree.
3. Preview the product on the draft `ona_theme2026/staging-v2` theme. A theme-editor change to a shared product template can affect many products. Route layout changes through a reviewed theme PR.

## Create or edit a reusable guide

1. On the product edit page, find the **Brew guide** app card. The app home (`Apps → ONA Brew Guides`) is a read-only list; editing starts on a product.
2. If the product has no linked app guide, fill in **Name**, **Format**, **Tastes like**, **Roast**, **Intro**, and the recipe's label/value rows. Use **Add row** for each parameter; remove unused rows. Name the guide so it can be found after that coffee rotates off the product.
3. Select **Save & push to product and article**. Saving the reusable guide alone is not the storefront update: this action also pushes the values into the fields the Horizon theme already renders.
4. Read **both** result banners. “Pushed to the product” confirms the product update. “Pushed to the linked Brew Guides article” confirms the full article update. A missing, broken, or failed article link can leave the product updated while the article remains old.
5. Preview the product's Brew Guide tab and open **Full brewing guide**. Compare every dose, yield, time, temperature, and other parameter to the approved recipe. Check mobile as well as desktop when the layout has changed.

The app does **not** create a Brew Guides article or its link. The product's existing `accentuate.select_artlice` value is the link to an article, in `brewguides/article-handle` form. When that link is absent, the app can still update the product and will show a warning for the article. Do not strip the `brewguides/` prefix.

## Rotate a product to another coffee

Use **Swap to a different guide** in the product's Brew guide card. Search by guide name, inspect the match, then select **Link this guide**. The app changes this product's guide reference and pushes the selected guide to the product and any linked article. The previous reusable guide stays in the library. Check the two result banners and preview both storefront surfaces afterward. Confirm that the product's article link points to the new coffee before swapping; the swap action does not change that article pointer.

## Current content check

On 25 October, Raspberry Candy's product tab showed **20.5 g dose, 39 g extraction, 26–32 seconds**, while its full article showed **20.5–21 g dose, 38–41 g yield, 25–30 seconds**. These are separate values, not a rendering bug. Have the coffee/content owner choose the correct recipe before the first app push; otherwise saving one side could silently replace the other. The app's empty browse list means this reconciliation has not yet been recorded as a reusable app guide.

## What the storefront reads

- The product Brew Guide tab reads product `custom.brew_guide_intro`, `custom.brew_spec_labels`, and `custom.brew_spec_values`. Its full-guide link resolves the existing `accentuate.select_artlice` pointer.
- The full Brew Guides article reads article `accentuate.content_brew_guide`, `accentuate.title_item`, and `accentuate.content_item` for its recipe.
- The app stores the reusable guide in the merchant-owned `ona_brew_guide` metaobject, links it through product `custom.brew_guide`, then pushes to the product and article fields above. Product and article push results are independent.

Source: `ona-brew-guide-admin/shared/models/brewGuide.ts`, `extensions/brew-guide-block/src/BrewGuideBlock.jsx`, and this theme's `blocks/product-brew-guide.liquid` and `sections/brewguide-article-info.liquid`.
