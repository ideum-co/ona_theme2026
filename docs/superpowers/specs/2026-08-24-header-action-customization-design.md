# Header Action Customization Design

## Goal

Make the homepage header action group match the approved reference while exposing merchant controls for button typography, shared icon size, and colors in transparent and solid header states.

## Desktop action order

The right-side desktop action strip uses one fixed order:

1. Shop button
2. Subscribe button
3. Customer account icon
4. Search icon
5. Shopping bag icon
6. Menu icon

The order is not merchant-configurable. A fixed order avoids invalid combinations and exactly matches the approved design. Existing destinations and behavior remain unchanged: Shop links to `/collections/all`, Subscribe links to `/collections/coffee-subscriptions`, account uses Shopify customer accounts, search opens the existing search experience, bag preserves the existing cart link or drawer behavior, and menu preserves the existing drawer behavior.

## Icon assets

Use the three supplied source files:

- `/Users/usuario/Downloads/icon-user.svg`
- `/Users/usuario/Downloads/icon-search.svg`
- `/Users/usuario/Downloads/icon-bag.svg`

Create theme-owned, optimized SVG assets without Illustrator metadata or embedded styles. Preserve each `viewBox` and path geometry, replace fixed white fills with `currentColor`, and keep decorative SVG nodes hidden from assistive technology because their interactive parents already provide accessible names. The existing menu icon remains in use and receives the same shared size and state color as the supplied icons.

## Merchant controls

Add a clearly labelled Header actions settings group to `sections/header.liquid`:

- `Button text size`: one pixel range shared by Shop and Subscribe.
- `Icon size`: one pixel range shared by account, search, bag, and menu.
- Solid header button background.
- Solid header button text.
- Solid header icon color.
- Transparent header button background.
- Transparent header button text.
- Transparent header icon color.

Defaults preserve the current solid header palette and reproduce the approved homepage reference: dark burgundy buttons with light text and light icons over the transparent hero. Sticky mode and internal pages use the solid controls; the transparent controls apply only while the header is actually transparent. Existing section-level row background and text settings continue to control unrelated menu and localization content.

## Rendering and state flow

The header section publishes semantic CSS custom properties for both state palettes plus the two sizes. The active header state resolves these to a small set of effective action variables. Shop and Subscribe consume the effective button variables; account, search, bag, and menu consume the effective icon variable.

Search is rendered inside the desktop action sequence between account and bag instead of as a separate row item. The header row still owns the menu trigger and appends it after the action group, producing the required final position. Duplicate desktop search output must be prevented. Existing responsive visibility rules remain intact; this project does not redesign the mobile header.

## Compatibility and accessibility

- Preserve account, search, cart drawer/link, cart count, menu drawer, sticky header, and transparent header behavior.
- Preserve keyboard targets, accessible labels, focus behavior, and minimum touch target sizing.
- The visual icon size may change, but the clickable target must not shrink below the theme's existing minimum target.
- Saved headers created before these settings existed fall back to the documented defaults instead of emitting invalid CSS.

## Testing

Add focused static regression tests that verify:

- the exact desktop order from Shop through Menu;
- search appears once in the desktop action strip;
- the three optimized theme assets exist, retain their view boxes, use `currentColor`, and contain no Illustrator metadata or fixed white fill;
- schema definitions and defaults for both size controls and both state palettes;
- transparent and solid custom properties are wired to their correct header states;
- the existing account, cart, search, and menu interaction hooks remain present;
- icon sizing changes visual SVG dimensions without reducing interactive target dimensions.

Run the complete repository regression suite, `git diff --check`, and Theme Check with changed-file offenses distinguished from the repository baseline.
