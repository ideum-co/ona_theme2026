# Archive — the October 2026 go-live

Point-in-time records of the cutover from the old ONA theme to
`ona_theme2026`. They are kept because they are the only account of what was
on the old theme and what was decided under time pressure, and they are
archived because **every one of them describes a state of the world that has
since changed.**

Read them as history. Do not take an instruction, a theme id or a "live"
label from anything in this folder.

## The one thing that goes wrong if you forget that

Several of these documents call theme **`160815546559`** the live store. That
was true: it was published on 2026-10-14 at 22:00:42Z, after a first cutover
to `154676789439` earlier the same afternoon was rolled back.

**It is no longer true.** Checked 2026-10-22:

| theme | role | what it is |
| --- | --- | --- |
| `154676789439` | **MAIN** | `ona_theme2026/main`, Horizon 4.1.4 — what `onacoffee.com.au` serves |
| `160815546559` | UNPUBLISHED | "PREVIEW - product media fills column (PR #46)", Horizon 3.5.1 |

Verify rather than trust either this table or the documents under it — roles
have swapped twice already:

```sh
# the API's answer
shopify theme list --json | jq '.[] | select(.role=="main")'
# the storefront's own answer, which cannot be stale
curl -s https://onacoffee.com.au | grep -o 'Shopify.theme = {[^}]*}'
```

A comparison run against `160815546559` today measures an unpublished preview
against production and will report the live site as the healthy side. That is
backwards: the 17 upscaled images on `/pages/wholesale` recorded in
`docs/legacy-sections-unstyled-2026-10-20.md` are on the theme that is now
production.

## What is in here

| Document | What it recorded | Why it is history |
| --- | --- | --- |
| `go-live-readiness-2026-10-14.md` | the readiness checklist | its own banner says the cutover happened before the plan was finished |
| `formswell-migration-map-2026-10-14.md` | the Formswell form inventory and decisions | same cutover banner |
| `index-json-parked-sections-2026-10-14.json` | homepage sections parked during the cutover | the parking was resolved |
| `release-test-plan-2026-10-15.md` | the test plan for the 10-15 release | that release happened |
| `pre-release-findings-2026-10-15b.md` | Felipe's five pre-release checks | answered before the release |
| `post-publish-review-2026-10-15.md` | the live storefront after publishing | its own banner says it was superseded at 22:00:42Z the same day |
| `manual-theme-work-2026-10-15.md` | hand edits on `160815546559` | an audit of a theme that is no longer published |
| `legacy-page-parity-audit-2026-10-15.md` | page parity against the production ZIP | the ZIP is a 10-15 export |
| `victor-review-2026-10-16.md` | review of Victor's PRs #169–#177 | all merged |
| `responsive-mobile-review-2026-10-16.md` | mobile review at `main` = `77174e8` | that commit is ~100 merges back |
| `go-live-parity-and-post-publish-2026-10-19.md` | the gap list before publishing `ona_theme2026` | it was published |
| `live-theme-160815546559/` | byte snapshots of the then-published theme's distinguishing files | that theme is unpublished |

## What deliberately stayed out of here

These are still current and live at `docs/`:

- `branching-and-release.md` — the release procedure in force
- `deploy-verification.md` — the checks to run after every merge
- `open-issues.md` — the live tracker, started 2026-10-20
- `component-kit.md`, `page-design-structure.md` — the stage-2 plan
- `legacy-sections-unstyled-2026-10-20.md`, `front-end-audit-2026-10-20.md`,
  `brew-guides-2026-10-20.md` — findings with work still open
- `legacy-page-templates/` — reference copies the migration still reads
