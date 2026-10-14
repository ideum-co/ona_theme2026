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

---

## 2. The branches

| branch | what it is | deploys to |
|---|---|---|
| `main` | **production.** Whatever is here is what customers see. | theme `154676789439`, the live store |
| `staging` | the integration branch. Everything lands here first. | a staging theme — see §3 |
| `feat/*`, `fix/*`, `docs/*` | one change each | nothing |

Protection as configured:

- **`main`** — PR required, linear history, conversation resolution required,
  strict status checks, admins included, no force-push, no deletion.
- **`staging`** — linear history, no force-push, no deletion. Deliberately
  lighter: staging should be easy to land on.

---

## 3. One-time setup still outstanding: connect a staging theme

The branch exists. **The staging theme does not yet**, and it cannot be created
through the Admin API — connecting a theme to a GitHub branch is an Admin UI
action. Someone with Shopify admin access needs to do this once:

1. **Online Store → Themes → Add theme → Connect from GitHub**
2. Pick the `ideum-co/ona_theme2026` repository and the **`staging`** branch.
3. Name the theme **`ona_theme2026/staging`** so it is obvious in the list.
4. **Leave it unpublished.** Never publish it.

After that the staging theme updates itself on every merge into `staging`, and
its preview URL is a permanent, always-current review link.

> **Do not reuse an existing preview theme for this.** A theme can be connected
> to only one branch, and the ad-hoc preview themes
> (`160815546559`, `160861159615`) should be deleted once this is in place.

Until the staging theme exists, `staging` is still useful — it keeps unreleased
work off production — but you will not get a preview from it.

---

## 4. The flow

```
feat/thing ──PR──▶ staging ──release PR──▶ main ──▶ LIVE
                      │
                      └─▶ ona_theme2026/staging (preview, unpublished)
```

1. Branch from **`staging`**, not from `main`.
2. Open the PR **into `staging`**. Review it, get Codex on it, merge it.
3. Check it on the staging theme's preview URL.
4. When a batch is ready to ship, open **one release PR from `staging` into
   `main`**, titled `release: <date> — <summary>`, with the §6 checklist in the
   body. Merging that PR is the deploy.
5. Keep `staging` in sync afterwards — `main` must never be ahead of `staging`.

**Hotfixes.** A genuine production emergency may branch from `main` and PR
straight into `main`. Immediately afterwards, merge `main` back into `staging`
so the two do not drift. "This is small" is not an emergency.

---

## 5. The rule that matters most: shop-owned JSON

Three files on the live theme are written by the **theme editor**, not by this
repository:

- `templates/index.json`
- `templates/product.json`
- `config/settings_data.json`

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

Paste into the body of every `staging` → `main` PR:

```markdown
## Release checklist
- [ ] `node --test "tests/*.test.mjs"` passes locally (98+ pass, 0 fail)
- [ ] `staging` previewed on the staging theme, on desktop **and a real phone**
- [ ] No `templates/*.json` or `config/settings_data.json` touched
      — or, if touched: live checksum read, reconciled, recorded below
- [ ] Section count ≤ 25 and blocks ≤ 50 for every JSON template changed
- [ ] Rollback named: theme `160335790271` is the pre-cutover storefront
- [ ] Deploying at a sensible hour (AEDT), not into a promo window

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
- **There is no CI.** This repository has no `.github/workflows`, so nothing
  runs `node --test "tests/*.test.mjs"` automatically; `main`'s "strict status
  checks" setting has no contexts to enforce. Adding a workflow that runs the
  tests on PRs into `staging` and `main` would make the first checklist item
  real instead of honour-system. Worth doing.
- **Page templates and app embeds are not in git.** Both are listed in
  `docs/post-publish-review-2026-10-15.md`; the theme is the system of record
  for them until they are ported.
