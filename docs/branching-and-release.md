# Branching and release — how to change the theme without deploying

**Status: adopted 2026-10-15.** Supersedes the implicit "merge to `main`"
workflow for every change made from now on.

---

## 1. Why this exists

Theme **`154676789439` (`ona_theme2026/main`)** has been the **published**
theme since 2026-10-14 ~15:43Z, and it is connected to this repository's
`main` branch through the Shopify GitHub integration. That integration
**cannot be disconnected**.

So, today:

> **A merge to `main` is a deploy to onacoffee.com.au.** It lands in about five
> seconds, with no build step, no approval and no announcement.

This is not hypothetical. PR #164 merged at 2026-10-15 and was live on the
storefront before anyone looked at it. Nothing is wrong with that PR — the
point is that no one *chose* to deploy it.

`staging` exists so that merging and deploying become two different decisions.

> **Update, 2026-10-14 22:00:42Z — and this makes the case rather than weakening
> it.** A third publish put theme **`160815546559`** ("PREVIEW - product media
> fills column (PR #46)") live, so `154676789439` is unpublished again and a
> merge to `main` no longer reaches customers *today*. Two unannounced publishes
> in thirty hours is precisely the problem: the storefront changed twice without
> a decision either time. Keep working on `staging` — the moment
> `154676789439` is published again, `main` is production again, and nobody will
> send a reminder. See `docs/post-publish-review-2026-10-15.md` §13.

---

## 1a. What happened to the first `staging`, and the rule it broke

> **2026-10-16.** The original `staging` branch and its theme `160919748799` are
> both retired. They are left in place as evidence, not as somewhere to work.
>
> **The theme stopped syncing.** It last updated `2026-10-15T11:17:45Z`. Three
> commits merged into `origin/staging` at 13:04Z and never arrived. Of eight
> probed files only `layout/theme.liquid` exists on it; all six JSON templates
> are missing. This is the same silent validation drop described in
> `docs/victor-review-2026-10-16.md` §1 — a clean merge, no error anywhere, and
> a theme quietly a day behind its branch.
>
> **The branch fell behind and never came back.** §4 below already said *"`main`
> must never be ahead of `staging`."* Nine commits went straight to `main`
> between 13:05Z and 15:15Z on 2026-10-15 and nothing merged back. By the next
> morning `staging` held **nothing that `main` lacked** — 52 files existed only
> on `main`, 2 differed in `main`'s favour, 0 existed only on `staging`. There
> was nothing to port and no useful way to merge it.
>
> The replacement is **`staging-v2`**, created at `77174e8` — byte-identical to
> `main` on the day it was made. The names below all refer to it. The rule in §4
> step 5 is the one that failed, so treat it as the load-bearing one:
> **re-point `staging-v2` at `main` after every merge to `main`, including the
> hotfixes that bypass it.** A staging branch that is allowed to drift is worse
> than none, because it looks like a safety net until the day you need it.
>
> Earlier drafts said *fast-forward*, which cannot work: `main` requires linear
> history, so release PRs are squashed, and the squash gives `main` a commit
> that is not a descendant of anything on `staging-v2`. See §4 step 5 for the
> command that does work.

---

## 2. The branches

| branch | what it is | deploys to |
|---|---|---|
| `main` | the branch the 2026 theme tracks | theme `154676789439` — **unpublished again as of 2026-10-14 22:00:42Z**, so a merge currently reaches a theme no customer sees |
| `staging-v2` | the integration branch. Everything lands here first. | a staging theme — see §3 |
| `feat/*`, `fix/*`, `docs/*` | one change each | nothing |

Protection as configured:

- **`main`** — PR required, **0 approving reviews**, conversation resolution
  required, linear history, strict status checks with **no contexts attached**,
  admins included, no force-push, no deletion. Read against the API on
  2026-10-19. Two of those are weaker than they sound: a PR merges with no
  approval at all, and "strict status checks" with zero contexts enforces
  nothing — see §7. What actually blocks a merge today is **conversation
  resolution**.
- **`staging-v2`** — **no protection rules at all** (`GET …/protection` returns
  404). An earlier version of this section claimed linear history and no
  force-push; that was never true. The lack of protection is what makes the
  §4 step 5 reset possible, so do not add force-push protection here without
  replacing that step.
- **`staging`** (retired) — left in place as evidence. Do not branch from it,
  do not merge into it. See §1a.

---

## 3. One-time setup still outstanding: connect a staging theme

The branch exists. **The staging theme does not yet**, and it cannot be created
through the Admin API — connecting a theme to a GitHub branch is an Admin UI
action. Someone with Shopify admin access needs to do this once:

1. **Online Store → Themes → Add theme → Connect from GitHub**
2. Pick the `ideum-co/ona_theme2026` repository and the **`staging-v2`** branch.
3. Name the theme **`ona_theme2026/staging-v2`** so it is obvious in the list.
   Theme `160919748799` can be reconnected instead of making a new one, but
   disconnect it from the dead `staging` branch first and then confirm the sync
   by checksum — it failed silently once already (§1a).
4. **Leave it unpublished.** Never publish it.

After that the staging theme updates itself on every merge into `staging-v2`,
and its preview URL is a permanent, always-current review link. **Verify the
first sync by checksum rather than by the theme appearing in the list** — an
empty or partial first sync looks identical to a healthy one in the admin.

> **Do not reuse an existing preview theme for this.** A theme can be connected
> to only one branch, so the staging theme has to be a new one.
>
> ⚠️ **`160815546559` is NOT a clean-up candidate.** It was listed as one here
> in an earlier draft, which was wrong and dangerous: it has been the
> **published storefront** since 2026-10-14 22:00:42Z, and the release plan
> names it as the rollback for the next attempt at publishing
> `154676789439`. Deleting it would either take the store down or destroy the
> rollback. Leave it alone until another theme is live **and** a replacement
> rollback has been named.
>
> `160861159615` ("PREVIEW - WFG counter on 2026 theme (PR #149)") is safe to
> delete — it is unpublished, is not anyone's rollback, and its content is in
> this repository.

Until the staging theme exists, `staging-v2` is still useful — it keeps
unreleased work off production — but you will not get a preview from it.

---

## 4. The flow

```
feat/thing ──PR──▶ staging-v2 ──release PR──▶ main ──▶ LIVE
                      │
                      └─▶ ona_theme2026/staging-v2 (preview, unpublished)
```

1. Branch from **`staging-v2`**, not from `main`.
2. Open the PR **into `staging-v2`**. Review it, get Codex on it, merge it.
3. Check it on the staging theme's preview URL.
4. When a batch is ready to ship, open **one release PR from `staging-v2` into
   `main`**, titled `release: <date> — <summary>`, with the §6 checklist in the
   body. Merging that PR is the deploy. Never open it from `staging`; that
   branch is retired (§1a) and a release PR from it would ship nothing.
5. Re-point `staging-v2` at `main` afterwards — `main` must never be ahead of
   `staging-v2`. This is the step that killed the first staging branch (§1a);
   do it in the same sitting as the merge, not later.

   ```sh
   git fetch origin
   git branch -f staging-v2 origin/main
   git push --force-with-lease origin staging-v2
   ```

   It has to be a reset, not a fast-forward. `main` requires linear history, so
   the release PR is squashed, and the squashed commit is not a descendant of
   the branch it came from — a fast-forward is refused every time. The force
   push is safe here only because `staging-v2` carries no protection (§2) and
   holds nothing that is not already on `main` by this point; `--force-with-lease`
   is what catches the case where that stopped being true.

**Hotfixes.** A genuine production emergency may branch from `main` and PR
straight into `main`. Immediately afterwards, re-point `staging-v2` at `main`
with the step 5 command so the two do not drift. "This is small" is not an emergency, and nine
small ones in two hours is how the first staging branch died (§1a).

---

## 5. The rule that matters most: shop-owned JSON

Seven files on the live theme are written by the **theme editor**, not by this
repository:

- `templates/index.json`
- `templates/product.json`
- `templates/product.merch.json`
- `templates/page.location.json`
- `templates/page.faq.json`
- `templates/page.faq-subscriptions.json`
- `config/settings_data.json`

> **`templates/product.merch.json` joined this list on 2026-10-21**, when it
> was first committed at all. It had existed only on the live theme — never in
> this repository — since 2026-10-20, so for 21 products the template that
> renders their page was unversioned: no history, no review, and nothing to
> restore from if the editor broke it. It also showed what being unversioned
> costs. #257 moved the summary badges from two hard-coded settings to the
> `filters.brew_method` metafield and updated `templates/product.json`; this
> file could not be updated in the same PR because it was not here, so it kept
> `badge_1: "Staple Range"` and `badge_2: "Best with Milk"` as dead keys the
> block had stopped reading. They are removed in the commit that adds the file.

> The two FAQ templates joined this list on 2026-10-19, when they were ported
> from the live theme. Every question and answer lives in them, so an
> unreconciled merge does not cost a layout tweak — it costs the FAQ content
> itself. They carry the editor's auto-generated banner for the same reason the
> other four do.

> **`templates/page.location.json` no longer holds the Maps key.** It used to.
> The store finder's key was a *section* setting, so the theme editor wrote it
> into this template, and the GitHub integration overwrote the file on every
> merge that touched it. That cost the map twice on 2026-10-19 — silently, since
> `assets/locations-store-finder.js` falls back to the list and posts copy that
> reads like ordinary page text.
>
> The key now lives in the shop metafield **`custom.google_maps_api_key`**
> (Settings → Custom data → Shop → Google Maps API key). A shop metafield is
> store data: no merge, theme push or publish touches it, and nothing has to be
> re-pasted after a release. `sections/locations-store-finder.liquid` reads the
> metafield first and falls back to the section setting, so an older theme still
> works; `tests/locations-store-finder.test.mjs` holds every consumer to the
> resolved value, so one of them cannot drift back onto the wipeable setting.
>
> The section setting is kept only as that fallback and should stay empty. If
> someone does fill it, this file carries a credential again and the old hazard
> returns.
>
> Either way, the check after a release is the same:
>
> ```
> curl -sL "https://onacoffee.com.au/pages/locations?preview_theme_id=154676789439" \
>   | grep -o '"mapsApiKey": "[^"]*"'
> ```
>
> An empty value there means the map is off, whatever the admin looks like.

Staging does not protect these. A release PR that touches one of them
**overwrites whatever the editor has done on the live store since the repo last
caught up** — which is exactly how ten sections were destroyed on 2026-10-14.

Before any release PR that touches a `templates/*.json` or
`config/settings_data.json` file:

1. Read the live theme's checksum for that file:
   ```graphql
   { node(id: "gid://shopify/OnlineStoreTheme/154676789439") {
       ... on OnlineStoreTheme {
         files(first: 20, filenames: ["templates/*.json", "config/settings_data.json"]) {
           nodes { filename checksumMd5 size updatedAt } } } } }
   ```
2. Compare against `md5sum` of the repo file.
   - **Equal** → the integration owns it. Safe to change through a PR.
   - **Unequal** → the editor owns it. **Reconcile the theme's state into the
     repo first**, in its own commit, then make your change on top.
3. After merging, **read the checksum again**. An unchanged checksum does not
   mean "no-op" — it means the integration *refused the file*. Shopify declines
   any JSON template over **25 sections** or **50 blocks per section**, silently:
   no error, no commit status, nothing in the admin.

`tests/shop-owned-templates.test.mjs` enforces the two platform limits on the
repo side and carries this procedure in its header.

---

## 6. Release PR checklist

Paste into the body of every `staging-v2` → `main` PR:

```markdown
## Release checklist
- [ ] `node --test tests/*.test.mjs` passes locally (98+ pass, 0 fail) — leave
      the glob **unquoted** so the shell expands it; node's own `--test` glob
      handling is newer than the Node 20 line and a quoted pattern fails there
- [ ] `staging-v2` previewed on the staging theme, on desktop **and a real phone**
- [ ] No `templates/*.json` or `config/settings_data.json` touched
      — or, if touched: live checksum read, reconciled, recorded below
- [ ] Section count ≤ 25 and blocks ≤ 50 for every JSON template changed
- [ ] Rollback named — and check which theme is actually `MAIN` first; it has
      changed twice without notice. `160335790271` is the pre-cutover theme;
      `160815546559` is what is live as of 2026-10-14 22:00:42Z
- [ ] Deploying at a sensible hour (AEDT), not into a promo window
- [ ] If `templates/page.location.json` is in the diff: **re-enter the Google
      Maps API key in the theme editor immediately after merging**, then confirm
      with
      `curl -sL "https://onacoffee.com.au/pages/locations?preview_theme_id=<theme>" | grep -o '"mapsApiKey": "[^"]*"'`.
      The repo copy carries an empty key by design (§5), so the merge wipes the
      live one and nothing reports an error
- [ ] `staging-v2` re-pointed at `main` with the §4 step 5 command

**Checksums read before merge:**
| file | repo md5 | live md5 | equal? |
|---|---|---|---|

**After merge — confirm the pull landed:**
| file | checksum re-read at | matches repo? |
|---|---|---|
```

---

## 7. What this does not solve

- **Theme-editor edits still go straight to production.** Anyone in the Shopify
  admin can change the live store, and this workflow cannot stop them. The only
  defence is the reconcile-first rule in §5 and agreeing who edits the live
  theme and when.
- **CI runs, but nothing requires it.** `.github/workflows/tests.yml` now runs
  the suite on pushes and pull requests to `main`, `staging-v2` and `staging`
  — the repository had none before 2026-10-15. It is **not** a required status check,
  so `main`'s "strict status checks" setting still has no contexts to enforce
  and a red run does not block a merge. One settings change finishes it:
  Settings → Branches → `main` → Require status checks → add **`unit`**, and
  the same for `staging-v2`. Until then the first checklist item is still
  honour-system; it is just now honour-system with evidence next to it.
- **The page templates are in git; the Horizon implementations are not.** An
  earlier version of this bullet called the theme the system of record for them.
  That is false, and believing it makes recovery depend on keeping a Shopify
  theme alive. Every one of the 14 legacy page templates exists in
  **`onacoffee_theme` `origin/main`**, which is the preferred porting source, and
  a dated copy of each sits in `docs/legacy-page-templates/` with the two
  real differences recorded. What is genuinely absent from any repository is the
  *Horizon-compatible* rebuild of those pages — that work has not been done yet,
  which is a backlog item, not a storage problem. **App embeds are the real
  not-in-git item**: they live in `config/settings_data.json` on each theme and
  are listed in `docs/post-publish-review-2026-10-15.md` §4.
