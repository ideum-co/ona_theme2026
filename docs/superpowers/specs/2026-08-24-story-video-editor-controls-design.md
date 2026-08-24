# Story with video editor controls — design

## Objective

Extend `sections/story-video.liquid` so merchants can style every visible text role independently and control the internal padding of the text and media containers on all four sides. The section must follow the native Horizon typography and spacing conventions already used by Product highlight.

## Scope

The change applies only to `Story with video` in `ona_theme2026`.

Text roles in scope:

- Heading.
- Body rich text.
- Button label.

Spacing regions in scope:

- Intro/text container.
- Media/video container.

Video source behavior, playback, poster, aspect ratio, maximum width, overhang, play control, logo rendering, colors, links, and outer section padding remain unchanged.

## Typography model

Each text role exposes an independent native preset selector:

- Default.
- Paragraph.
- Heading 1 through Heading 6.
- Custom.

When `Custom` is selected, expose the established Horizon controls:

- Font role.
- Font size.
- Line height.
- Letter spacing.
- Case.
- Wrap.

The existing heading semantic level selector remains separate from its visual preset. This preserves a valid page heading outline while allowing visual typography to change independently.

The body remains rich text and must use the `text-block` cascade so a selected preset also styles semantic headings contained inside the rich text. The button keeps button layout and interaction styling while receiving its own typography preset and Custom variables.

The section root publishes its configured text color through both the `color` property and the native `--color` token. This ensures paragraph, heading, rich-text, and Custom preset descendants use the selected section foreground without affecting the button's explicit color variables.

Existing heading and body sizing must remain visually backward compatible when the new role is set to Default. Any superseded size-only control remains available as a hidden saved-setting fallback rather than competing with the visible preset controls.

## Spacing model

Replace each single horizontal-padding editor control with independent physical editor controls that map to logical CSS:

- Top → block start.
- Bottom → block end.
- Left → inline start.
- Right → inline end.

This applies independently to the intro/text container and media/video container. New left/right defaults reproduce the existing `0px` internal padding. Existing saved `intro_padding_inline` and `media_padding_inline` values remain hidden legacy fallbacks when the newer side-specific values are absent.

Outer section padding and its existing responsive scaling stay unchanged. No new forced height, distribution, or viewport spacing is introduced.

## Architecture

- `sections/story-video.liquid` owns the schema, role classes, scoped variables, and container padding bindings.
- A focused typography helper snippet may be introduced for prefixed role settings if reusing the Product highlight helper would create inappropriate coupling. Its interface must accept settings, prefix, preset, and type without changing global tokens.
- Existing translation keys are reused for schema labels.
- CSS and variables remain scoped to `.story-video`.

## Compatibility and behavior

- Existing section instances render with their current appearance by default.
- Empty heading, body, or button values continue suppressing their markup.
- Settings remain independent per Story with video instance.
- Theme-editor bindings and section selection remain intact.
- Heading semantics, rich-text formatting, button link behavior, and video functionality are preserved.
- Mobile layout must not gain horizontal overflow or unintended empty space.

## Validation

Implementation must include:

- A failing-then-passing regression harness covering all three independent preset groups and their Custom fields.
- Checks that the body uses the native rich-text preset cascade.
- Checks that the section scopes `--color` to the selected text color.
- Checks for four independent padding bindings on both intro and media containers, including legacy horizontal fallbacks.
- Schema parsing or Shopify Theme Check validation for modified files.
- `git diff --check`.
- Independent code review before publication.

## Acceptance criteria

1. Heading, body, and button typography can be configured independently.
2. Every role supports Default, Paragraph, H1–H6, and Custom.
3. Custom exposes font, size, line height, letter spacing, case, and wrap.
4. Preset-controlled text uses the configured section text color; button colors remain independently configurable.
5. Intro and media padding can each be controlled on all four sides.
6. Existing saved horizontal padding continues to render when newer side settings are absent.
7. Current defaults and video behavior do not regress.
8. Automated validation passes for all modified files.
