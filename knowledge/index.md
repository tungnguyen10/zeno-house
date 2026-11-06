---
okf_version: "0.2"
---

# Zeno House Knowledge

The central index for AI-assisted work in this Nuxt 4 + Vue + TypeScript application with Supabase Auth/Postgres. Use `AGENTS.md` to route work to Superpowers skills; use this knowledge base to understand requirements and planned behavior.

## Find information

- [97 accepted capability specifications](./capabilities/index.md) — normative WHEN/THEN business scenarios and architecture requirements.
- [Four active change bundles](./changes/index.md) — proposals, designs, tasks and pending deltas. Do not assume these are implemented or deployed.
- [86 archived changes](./history/index.md) — historical provenance and links to all 600 original archive files at the immutable baseline commit.
- [Unified development workflow](./workflow.md) — only OKF plus Superpowers; no OpenSpec CLI or extra specification workflow.
- [Developer architecture](../docs/architecture/rules.md), [permissions](../docs/architecture/auth-permissions.md), [billing](../docs/features/billing.md), [contracts](../docs/features/contracts.md), [project context](../docs/agent-context.md) — engineering reference and current operating guidance.

## Product domains

- Property lifecycle: [buildings](./capabilities/buildings-api.md), [rooms](./capabilities/rooms-api.md), [tenants](./capabilities/tenants-api.md).
- Occupancy and contracts: [contracts](./capabilities/contracts-api.md), [renewals](./capabilities/contract-renewal.md), [occupants](./capabilities/contract-occupants-api.md), [checkout](./capabilities/contract-checkout-settlement.md).
- Monthly operations: [billing](./capabilities/billing-api.md), [period close](./capabilities/billing-period-close.md), [meter readings](./capabilities/meter-readings-api.md), [reports](./capabilities/operations-report.md).
- Security: [user authentication](./capabilities/user-auth.md), [building scope](./capabilities/owner-scoped-access.md), [tenant identity](./capabilities/tenant-identity.md), [audit](./capabilities/entity-audit-log.md).

## Migration provenance

Imported from `main` commit `ae95811bbdc1932368b4e6b9ed3e9540399d26e6` on 2026-11-06. Source content was copied into OKF Markdown nodes, not reinterpreted as new requirements. Archived history is indexed using immutable links rather than duplicating obsolete specs into the current requirement set.
