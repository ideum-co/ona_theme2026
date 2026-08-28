# Dotdigital Subscriber Modal Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-08-28-locations-page-and-subscriber-modal-design.md`

**Goal:** Integrate the approved Dotdigital new-subscriber campaign globally through controlled theme settings, without duplicating its externally managed form or changing current Theme Editor instance data.

**Architecture:** A dedicated snippet builds the single Dotdigital loader URL from global settings. `theme.liquid` renders the snippet once near the end of the body; Liquid guards prevent output when disabled, unconfigured, or in design mode.

**Constraints:** Do not edit `config/settings_data.json`, do not change the Dotdigital chat app embed, and do not hardcode a second loader.

## Task 1: Define regression tests and global settings

**Files:**
- Create: `tests/dotdigital-subscriber-modal.test.mjs`
- Modify: `config/settings_schema.json`

1. Write failing tests for the enable control, campaign path, delay, and cookie-expiry settings.
2. Add these IDs with approved defaults: `dotdigital_subscriber_modal_enabled`, `dotdigital_subscriber_campaign` (`7M6W-AH9/welcomenewsletter`), `dotdigital_subscriber_delay` (`2`), and `dotdigital_subscriber_cookie_days` (`365`).
3. Use clear merchant-facing labels and bounded numeric ranges.
4. Parse the JSON in the test and run `node --test tests/dotdigital-subscriber-modal.test.mjs`.

## Task 2: Add the guarded loader once

**Files:**
- Create: `snippets/dotdigital-subscriber-modal.liquid`
- Modify: `layout/theme.liquid`
- Modify: `tests/dotdigital-subscriber-modal.test.mjs`

1. Add failing assertions that the snippet checks enablement, a nonblank campaign, and `request.design_mode == false`.
2. Build the external `popoverv3.js` URL in one place using escaped campaign data and the configurable delay/cookie values; retain `hide-after-submission=true` and the approved Dotdigital domain.
3. Render the snippet exactly once before `</body>`.
4. Assert there is only one `popoverv3.js` reference in theme-controlled source and no subscriber data is intercepted by local JavaScript.
5. Run the focused test and Theme Check on the changed Liquid files.

## Task 3: Full verification and safe handoff

1. Run the full repository test suite and `git diff --check`.
2. Confirm `git diff origin/main -- config/settings_data.json templates/index.json` is empty.
3. Preview outside design mode and confirm the approved campaign appears after the configured delay, dismisses correctly, and does not appear in Theme Editor.
4. Confirm the existing Dotdigital chat app embed still behaves independently.
5. Open a PR to `main` only after the locations plan and modal plan both pass their regression checks.

