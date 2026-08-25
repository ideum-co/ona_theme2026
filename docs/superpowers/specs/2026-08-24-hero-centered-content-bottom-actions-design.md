# Hero Centered Content and Bottom Actions Design

## Objective

Keep the main homepage Hero heading and description centered horizontally and vertically while positioning their existing button `Group` at the horizontal center near the bottom of the Hero.

## Scope

- Add an opt-in behavior to `sections/hero.liquid`; existing Hero sections and presets remain unchanged unless enabled.
- Enable the behavior for the homepage section `hero_ona` in `templates/index.json`.
- Reset the homepage button Group's existing `padding-block-start` from 100px to 0 so the configured bottom spacing measures the actual buttons rather than the Group's former layout workaround.
- Keep the existing Heading, Text, Group, and Button blocks editable and in their current Shopify block hierarchy.
- Do not change button labels, links, colors, sizes, ordering, or the Header.

## Theme Editor Controls

Add these Hero section settings:

1. `pin_button_group_to_bottom`, a checkbox labeled “Pin button group to bottom”, disabled by default.
2. `button_group_bottom_spacing`, a range labeled “Button group bottom spacing”, from 0px to 200px in 4px increments, with a 60px default. It is visible only when pinning is enabled.

The same bottom spacing applies on desktop and mobile.

## Rendering and Selection

When pinning is enabled, the Hero receives a modifier class and publishes the configured spacing as a section-scoped CSS variable.

The pinned target is a top-level `.group-block` inside `.hero__content-wrapper` whose `.group-block-content` contains a Button block. Nested groups and groups without buttons are not selected. This structural selector avoids coupling the layout to the current generated block ID `group_L3tYP4`.

If no qualifying button Group exists, the Hero content remains centered and no element is pinned.

## Layout

With pinning enabled:

- `.hero__content-wrapper` fills the Hero content area and centers its non-pinned direct children in both axes.
- The qualifying button Group is positioned absolutely at `inset-inline-start: 50%`, translated by `-50%` on the inline axis, and placed at the configured bottom spacing.
- The Group, not its individual buttons, is positioned. Its internal direction, gap, wrapping, and button widths continue to come from the Group and Button block settings.
- The pinned Group remains above the media/overlay and keeps interactive pointer events.
- Center content and the bottom Group share the existing section horizontal padding so they do not touch viewport edges.

## Responsive and Editor Behavior

- Desktop and mobile use the same configurable bottom offset.
- Existing `vertical_on_mobile` behavior inside the Group remains intact.
- Shopify design-mode selection remains functional because no block markup or `shopify_attributes` are replaced.
- The Hero’s existing content animation continues to animate the text and buttons; positioning belongs to the Group wrapper and does not alter the Button transforms.

## Verification

Add a static regression test that verifies:

- Both section settings and their defaults/range exist.
- The Hero publishes the modifier class and bottom-spacing CSS variable.
- The selector targets only a direct button-containing Group.
- Center content fills and centers in both axes.
- The Group is bottom-centered using the configured variable.
- The homepage Hero enables the setting with a 60px value.

Run the complete Node regression suite, `git diff --check`, and scoped Shopify Theme Check before delivery.
