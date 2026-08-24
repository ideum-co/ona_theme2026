# Story Video Gap and Section Width Design

## Scope

Correct the editor controls introduced for `Story with video` and extend the generic `Section` with the same optional content-width constraint already used by `Media with content`.

## Story with video

- Keep the existing intro and media padding controls, including the lateral padding requested in the previous change.
- Add one `Content gap` range setting for the intro stack.
- The setting applies uniformly between each rendered direct child of the intro: logo, heading, body, and button.
- Publish the value as `--story-video-content-gap` and consume it through the existing CSS grid `gap` property.
- Use a default that preserves the current `var(--gap-lg)` appearance for existing sections. The Liquid fallback remains `var(--gap-lg)` so legacy saved section data also keeps its current spacing.

## Generic Section

- Add `Limit content width` after the existing section width selector.
- Add a conditional `Max width` range using the established `Media with content` range: 800–1800px, 20px steps, 1280px default.
- Apply the cap to `.custom-section-content`, not the outer `.section`, so background media, overlay, and background color remain full width.
- Center the capped content with inline auto margins and keep the current layout, height, borders, and spacing behavior unchanged when the checkbox is disabled.

## Compatibility and testing

- Both features are opt-in or preserve their current defaults.
- Add static regression tests that parse the relevant Liquid files and assert the schema controls, conditional visibility, CSS-variable wiring, target selector, and full-width background boundary.
- Run the existing Story tests, the new Section tests, scoped Theme Check on changed Liquid files, and the full repository test suite available in `tests/`.
