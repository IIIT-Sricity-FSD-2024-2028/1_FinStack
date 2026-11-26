# Unified Redux integration candidate and publication plan

This candidate is prepared locally without commits or remote writes. The validated workspace is immutable. Production application source, backend source, schemas, CSS and locked dependency versions must match it. Only Finance test coverage, documentation and integration reporting are changed here.

## Source and attribution anchors

Baseline main: `a41434c646d7a097a3c41730e4451db60ab24e60`.

| Merge order | Original PR | Original commits | Author / GitHub identity |
| --- | --- | --- | --- |
| 1 | #16 Finance FIN-81 | `8253b462829dfae4977b848399c7fe222badfcd1` | Hari6782 / h267vamsi@gmail.com |
| 2 | #15 Submitter FIN-83 | `896330f9c66fd0348eb6c088884d655987a00a7d` | Harshith1104 / venkataharshith2007@gmail.com |
| 3 | #17 Compliance FIN-84 | `853f8e6305e6d308d076411886cc9372b0cb9858` | Harshith1104 / venkataharshith2007@gmail.com |
| 4 | #18 Manager FIN-82 | `46738f2b3b8cb3de206bf4912ab027222fedc803`, then `bfcf50b82b81a28bf4571cc6c296c9915cc86fca` | aditya0020 / adityanalawade60@gmail.com |

All five commits have matching original author/committer identities and GitHub account associations; they are unsigned. The first three PRs each contain one commit; Manager contains two. As inspected read-only on 2026-11-26, all four remain open, non-draft, clean against the same main baseline, with zero submitted reviews and no check runs/status contexts. PR #18 requests Hari6782 and nikhilpolasa. The copied candidate HEAD remains the baseline; imported source does not establish PR ancestry.

## Complete reconciliation ledger

`PR_CHANGE_RECONCILIATION.json` accounts for all 96 original changed-file entries across the four PRs (33 + 23 + 25 + 15). Every entry records the original head, path, current disposition, classification, reason and any follow-up. Exact comparisons normalize only CRLF/LF.

- Necessary for the unified implementation: the common tested dependency graph, restored Finance regression fixture/function/runner, final architecture documentation, and adapted test contracts.
- Superseded by shared architecture: actor-created stores, nested Redux Providers, independent Finance/Manager API instances and middleware, feature-local session listeners, generic thunk dependencies, colliding endpoint names and duplicate refresh plumbing. Existing actor screens and behavioral contracts remain.
- Intentionally deferred: Finance sidebar shortening and Submitter eye-path fix, to preserve validated UI. The compatibility `SubmitterContext.jsx` is a Redux facade, not a restored Context cache.
- Requiring a separate approved change: PR #15's three backend auth files and four added backend test cases. The unchanged `/auth/me` projection does not populate the optional organization/department/manager fields; the frontend enhancement is incomplete. Preserve this explicit limitation until a backend change is approved.
- Dependency changes are deferred for separate approved security work: PRs #15/#17 Vite 7.3.7 and #17/#18 RTK 2.15.0 are not part of this candidate. The tested locked versions remain 7.3.6 and 2.14.0. Raw npm audit evidence and exact severity counts accompany the result report. Never repeat the original PRs' zero-vulnerability claim for this tree.
- Restored here: all three FIN-81 browser regression groups, paging fixture and FINSTACK_FINANCE_REDUX_ONLY runner option, plus the original Finance migration document updated for shared architecture. Their omission is no longer a deferred coverage/documentation gap.

## Finance browser verification

`tests/financeCompliance.browser.cjs` restores the original PR #16 assertions covering filter persistence across navigation and page reset; details reuse of workspace cache, external updates and refresh error/recovery; payment selections invalidated by external eligibility changes; and paginated notifications, filter reset and unread badge invalidation. The fixture returns the requested page/pageSize. Full run includes 59 named browser checks; FINSTACK_FINANCE_REDUX_ONLY=1 retains the dedicated original runner path. Current results, including failures if any, are recorded in INTEGRATION-RESULTS.json after execution. All APIs are fictional and intercepted; external requests are blocked.

## Publication manifest

The local `.candidate-evidence/publication-manifest.json` is the authoritative proposed file inventory. It lists canonical Git blob IDs, raw SHA-256, file modes and add/modify/unchanged/delete disposition against the baseline. It includes baseline tracked source/static assets and approved untracked source, tests, documentation and sanitized result reporting. No commit/index staging is required to compute it. Future publication must stage exactly the approved entries and removals and compare `git ls-tree -r` (path, mode and blob ID) against this manifest.

Exclude `.git`, `.candidate-evidence`, `.integration-inputs`, node_modules, .vite, dist, coverage, generated front-end/js/react/client assets, logs, screenshots, local configuration, private fixtures, databases, uploads and credentials. Existing versioned `.env.example` templates are public source, not live configuration. No local .env is published. The manifest excludes itself and local verification logs; use the manifest hash in publication review. Generated builds are regenerated for checks only. Keep full original baseline tracked assets that are not generated or secrets.

Verify equality over the entire declared source universe, including deletions and extra candidate paths; comparing only a few changed files is insufficient. Git blob equality is canonical under repository filters/line endings, raw SHA-256 records the Windows bytes. File modes come from the index for existing paths and explicit 100644 for new regular files. Symlinks, if any, require their link content and 120000 mode; do not follow them. After original PR histories are merged, remove their deliberately omitted files or changes according to this ledger so the final tree matches the candidate. Do not use a blind copy that leaves PR-only files behind.

## Authorized future GitHub sequence (not executed)

1. Obtain explicit authorization for branch creation, PR retargeting, any contributor-head conflict commits, PR merges and final publication. Recheck remote main/head SHAs, compare to the anchors above and confirm merge commits are enabled. Do all mutable work in a separate publishing checkout, never in the validated workspace or this frozen candidate.
2. Create an unused integration branch from the exact current main. Retarget the four original PRs to it. Preserve contributor branches and do not rewrite their commits. GitHub retargeting can change diff/review context; re-request reviews as appropriate.
3. Merge #16, #15, #17, #18 sequentially using GitHub merge commits, with a checked expected head SHA and no squash/rebase. Before each merge, re-read base/head, mergeability, applicable rules, check statuses, approval state and unresolved threads. Meet all requirements; do not use indirect merges to bypass them.
4. If conflicts require changes to a contributor head, STOP unless that additional change is expressly authorized. With authorization, merge the integration base into that PR head, resolve the actual conflict and commit only the genuine resolution without rewriting the original commits. Recheck approvals/checks on the new head; merge through GitHub. Never use an `ours` merge to manufacture ancestry or discard whole PRs.
5. After each merge verify GitHub `merged=true`, intended integration base, merge_commit_sha and parent ancestry. Use `git merge-base --is-ancestor <original-sha> <integration-tip>` for every original commit, including both Manager commits. Re-read GitHub's merge box; do not assume individual clean status predicts the cumulative integration.
6. Once all histories are included, apply this exact candidate source inventory as a genuine documented integration change. This replaces duplicate architectures and explicitly reverses deferred PR changes. The integration commit is authored by the person performing that work, with truthful message/body and links to original PRs and this ledger. Keep original commits' authors, emails, dates, messages and SHAs intact. Add coauthors only for real contributions, never artificial contribution counts or fabricated commits.
7. In that publishing checkout compare committed path/mode/blob inventory to the frozen manifest; verify zero omitted additions/deletions and backend/schema/CSS equality. Rerun frontend tests/typecheck/lint/build and all browser suites, backend unit suites, and any required CI. Live E2E is permitted only in a newly created authorized disposable database. Existing QA and production must never be connected or mutated.
8. Open the integration-to-main review with this ledger, exact results, security/profile limitations and manifest hash. Obtain required reviews. Recheck main has not advanced; if it has, reconcile intentionally and regenerate/revalidate rather than overwriting new work.
9. Merge the final integration PR using a merge commit as well. Verify original five commits remain ancestors of main and all four original PRs show Merged into the integration base. Do not squash, rebase, cherry-pick or rewrite history at this last step.

## Conflict expectations and gates

Read-only pairwise legacy merge-tree forecasts (no object writes): #16/#15 has no textual conflict; #16/#17 conflicts in package.json, package-lock.json, financeCompliance.browser.cjs, liveRefresh.test.js and sharedUi.test.js. #15/#17, #15/#18 and #16/#18 have package/lock conflicts. The sequential result can differ. Common Provider/store/API/session boundaries have semantic conflicts even where text auto-merges. Resolve against the validated architecture; do not accept one side wholesale. Intermediate integration states must not be deployed.

GitHub reported main and contributor branches unprotected, with no repository/inherited rulesets. The detailed protection endpoint returned 403 due to connector scope, and merge-method settings were not exposed. These settings must be confirmed before execution. Pending review requests are not approvals. Missing backend profile data and reported dependency vulnerabilities require explicit separate remediation decisions; bank settlement and external billing are not established by these browser tests.

No live E2E is rerun for this test/documentation-only candidate: application source is required to be byte-identical to the previously validated implementation. The earlier 30-check real-backend run remains historical evidence only, not a fresh candidate database run. Current tests use intercepted HTTP and backend unit mocks, and no database is accessed. The known baseline Submitter SVG warning remains. No commits, merges, retargets, contributor-branch changes or remote writes are part of candidate preparation.
