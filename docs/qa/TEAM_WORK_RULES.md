# FinStack team work rules

## Shared baseline and priorities

Start task branches from `origin/feat/full-workflow-integration`. The integrated code baseline before this documentation commit is `25e2cf294e8286e61878578384122f6d43117c44`.

Read [FINSTACK_LIVE_QA_ISSUES.md](FINSTACK_LIVE_QA_ISSUES.md) and [FINSTACK_IMPLEMENTATION_ORDER.md](FINSTACK_IMPLEMENTATION_ORDER.md) before implementation. Preserve their issue priorities: tenant identity and authentication security first, then UI work in reviewable batches. Team members can investigate and prepare their assigned work independently while coordinating shared interfaces and integration order.

The integrated application is a development baseline, not a claim that all live workflows have passed. Record real browser/API/database results accurately; do not replace failed UI checks with API-only success claims.

## Mandatory visual reference for all five actors

The Expense Submitter UI is the mandatory visual reference for Configuration Manager, Expense Submitter, Manager, Finance Officer and Compliance Officer.

All five must use:

- The same design tokens and typography.
- The same navbar and sidebar placements.
- The same overall page structure.
- The same cards, buttons and tables.
- The same notification UI.
- The same profile and settings patterns.
- The same logout confirmation modal.
- The same confirmation dialogs and toasts.
- The same spacing and responsive behavior.

Only role-specific features and permissions should differ. Use genuinely shared React components and one shared design system; do not create independent actor design systems or competing copies of shared components.

## Nikhil

- Tenant identity and authentication security.
- Server-generated globally unique login IDs.
- Employee creation and bulk import.
- Configuration Manager UI and features.
- Registration and Platform Admin improvements.

## Aditya

- Shared FinStack React design system.
- Expense Submitter UI as reference.
- Shared navbar, sidebar, header, components.
- Shared logout and confirmation dialogs.
- Shared notification presentation.
- Manager UI restoration and improvements.

Compare Aditya's original Manager implementation at `a45fe395d162d3cbac402c9233da6021fb24c378` with the integrated Manager implementation before changing its visuals. Restore intended visuals within the shared Submitter-based design system without losing working backend integration, role guards, receipt access, Finance assignment, decision handling or reporting behavior. Do not replace the integrated shared application or persistent backend with older actor-branch versions.

## Vamshi

- Finance UI using shared design system.
- Compliance UI using shared design system.
- Queue and notification auto-refresh.
- Finance/Compliance workflow corrections.
- Internal payment processing UI accuracy.

Internal payment requests and pending processing records must not be presented as verified bank payment or completed settlement. Do not add real provider operations as part of UI corrections.

## Coordination

Aditya owns the shared UI foundation. Nikhil and Vamshi reuse it. Agree shared component APIs, design tokens and shared-file changes before overlapping implementations. Nikhil and Vamshi must not build competing shared components while preparing their role-specific work.

All working role functionality stays intact. Preserve tenant isolation, backend role enforcement and existing API contracts while consolidating presentation. Keep Platform Admin separate from the five-role tenant SPA.

Preserve each contributor's Git attribution. Add original integration fixes as new commits; do not rewrite teammate-authored history or replace imported work wholesale.

Use separate task branches and focused commits. Coordinate changes to shared authentication, routing, components and API contracts. Review and test integration against the current baseline before combining task branches; do not merge whole actor branches containing competing shared/backend code.

## Environment and publication safety

Never commit private environment configuration, database passwords, JWT signing secrets, access or activation tokens, test-account credential fixtures, QA receipt uploads, database backups or temporary runtime data. Use ignored, access-restricted local configuration and fictional test data.

Preserve the original FinStack worktree, original `finstack` database, retained QA schema and existing QA services. Do not assume a teammate's database or credentials are available from GitHub. Use independently isolated development databases and review migration targets before any database change; do not reset or migrate retained environments.

This documentation publishes requirements and assignments only. It does not authorize implementation, database changes, history rewriting or merging into `common-base` or `main`.
