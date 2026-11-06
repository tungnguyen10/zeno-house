---
type: Workflow
title: "Zeno House Agent Workflow: OKF + Superpowers"
status: stable
tags: [agent, workflow, engineering, okf, superpowers]
---

# Unified Agent Workflow

This repository uses **one documentation root:** `docs/**` is an OKF v0.2 bundle; **one engineering execution method:** Superpowers. `AGENTS.md` is the shared policy router for Claude Code, Copilot, Codex and other assistants, not another specification system.

## Truth and conflict rules

| Concern | Canonical home | Role |
| --- | --- | --- |
| Accepted requirements | `docs/capabilities/*.md` | Normative behavioral requirements and WHEN/THEN scenarios |
| Active feature/change | `docs/changes/<slug>/**` | Design decisions, delta requirements and a single task checklist |
| Architecture and features | `docs/architecture/**`, `docs/features/**` | Engineering/runtime guidance; link to capabilities for rules |
| User and operations guidance | `docs/user-guide/**`, `docs/development/**` | How-to and deployment/verification instructions |
| History | `docs/history/**` | Immutable provenance; never a second live spec |
| Actual behavior | Code, migrations, tests, real environment | Implementation evidence; may diverge from approved behavior |

A change design is NOT automatically accepted or shipped. When sources disagree, compare with implementation, identify which requirement was approved, preserve historical context and explicitly record the discrepancy; never silently elevate archived designs.

## Agent loop

1. **Intake/route** — Determine investigation, bug, feature or docs change. Read `AGENTS.md`, `docs/index.md`, and one relevant capability. Look for a matching active change in `docs/changes/index.md`. Inspect relevant code/tests and any DB migrations.
2. **Explore/design** — For substantive behavioral work use Superpowers brainstorming/design; document approved decisions as `docs/changes/<slug>/proposal.md` and `design.md`. Reuse existing changes instead of creating duplicates. Preserve alternative decisions and scope limits.
3. **Plan** — Use Superpowers writing-plans. Store the single test-first checklist in `docs/changes/<slug>/implementation-plan.md` (or existing `tasks.md` for migrated changes). Link to matching accepted capability and design. **No `docs/superpowers/specs` or `docs/superpowers/plans`.**
4. **Implement** — Use Superpowers test-driven-development and executing-plans/subagent-driven-development when available. Keep implementation in small reviewable steps; update the one checklist and capture test/SQL verification evidence.
5. **Verify** — Use code review and verification-before-completion; run scoped regression tests, `npm run knowledge:check`, lint, typecheck and tests. Verify permission boundaries, tenant scope, billing transactions and migration privileges. Cloud SQL execution and browser visual QA are separate explicit gates, not assumed from static tests.
6. **Accept/promote** — Once reviewed and verified, reconcile approved deltas into `docs/capabilities/*.md` and adjust `docs/architecture/**`, `docs/features/**` or user guidance. Archive completed change design/plan under `docs/history/**`, preserve provenance and remove any duplicated checklist. Keep a clear record of unverified deployment prerequisites.

### Small fixes

A narrow typo, comment or purely internal refactor can skip a full proposal when behavior and public contracts do not change. Still read the relevant requirement and verify. If behavior changes, update the canonical capability or active change in the same PR.

### P0 stabilization work already in the repository

- [Tenant authorization scope](./changes/tenant-authorization-scope/design.md) and [execution plan](./changes/tenant-authorization-scope/implementation-plan.md) — code is present, but cloud migration/type generation and visual QA require separate evidence.
- [Atomic contract renewal](./changes/atomic-contract-renewal/design.md) and [execution plan](./changes/atomic-contract-renewal/implementation-plan.md) — review implementation, tests and cloud rollout before marking fully complete.
- [Atomic billing close](./changes/atomic-billing-close/design.md) and [execution plan](./changes/atomic-billing-close/implementation-plan.md) — reconciliation and transactional locking require explicit verification against actual DB state.

Historical Superpowers documents are kept in `docs/history/superpowers/**` as OKF concepts. They are not parallel living specifications.

## Rules for authoring OKF documents

- `docs/index.md` is the bundle-root index and carries only `okf_version: \"0.2\"` frontmatter.
- Every non-index Markdown concept under `docs/**` must have YAML frontmatter including nonempty `type`; `status` is `draft`, `stable` or `deprecated`.
- Use standard Markdown links; add provenance `sources` for imports; do not invent `verified` events for docs not independently checked.
- One canonical approved requirement per capability, and one execution checklist per active change. Cross-link instead of duplicating whole requirements or technical plans.
- Before finishing, run `npm run knowledge:check`, then the relevant source tests and GitHub CI. No OpenSpec CLI or separate document framework.
