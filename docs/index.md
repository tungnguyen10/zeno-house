---
okf_version: "0.2"
---

# Zeno House Documentation — OKF Bundle

One documentation root, one specification source, one execution workflow. The repo is Nuxt 4 + TypeScript + Supabase.

## Agent entry points

- [Agent execution lifecycle](./workflow.md) — OKF for all knowledge/specs; Superpowers for brainstorming, planning, TDD and review.
- [Agent context map](./agent-context.md) — project architecture and focused routing.
- [Engineering documentation guide](./README.md) — reference and operational guides.

## Product truth

- [97 accepted capability specifications](./capabilities/index.md) — approved behavioral rules and scenarios.
- [Eight active change bundles](./changes/index.md) — proposals/designs plus a single implementation checklist per change, including three P0 Superpowers designs now in OKF.
- [87 archived changes](./history/index.md) — immutable legacy OpenSpec provenance.
- [39 historical Superpowers design/plan files](./history/superpowers/index.md) — deprecated historical evidence, no competing specifications.

## Current engineering documentation

- [Architecture](./architecture/rules.md), [API](./architecture/api.md), [database](./architecture/database.md), [auth and permissions](./architecture/auth-permissions.md).
- [Features](./features/contracts.md), [monthly billing](./features/billing.md), [tenant portal](./features/tenant-portal.md), [AI assistant](./features/ai-billing-assistant.md).
- [Testing](./development/testing.md), [SQL/cloud rollout](./development/local-setup.md), [user guide](./user-guide/README.md), [UI design system](./ui-patterns/design-system.md).

## Ownership

- **Requirement decision:** `docs/capabilities/**` only after acceptance.
- **Proposed behavior and executable checklist:** `docs/changes/<slug>/**`.
- **Engineering descriptions and user instructions:** existing `docs/**` feature/architecture/user guide folders, with OKF frontmatter.
- **History and provenance:** `docs/history/**`.
- **Agent instructions:** root `AGENTS.md` with thin tool-specific entrypoints; never create parallel specs in `docs/superpowers/**` or `knowledge/**`.
