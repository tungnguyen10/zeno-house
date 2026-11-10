---
type: Verification Record
title: "Event Audit Hardening — cleanup status and remaining execution scope"
status: draft
change_state: in-progress
tags: [change, audit, security, transactions, verification]
---

# Event Audit Hardening — checkpoint (2026-11-10)

## Decision: keep active; durability implementation incomplete

The canonical [tasks.md](./tasks.md) currently has **12/16 checked** and **4 unchecked** (3.1, 3.2, 3.3, 4.2). Do **not** archive or present the system as globally fail-closed.

### Implemented evidence reviewed

- `supabase/migrations/20260812150000_harden_event_audit.sql` introduces retained audit history, `audit_operations`, outbox/claim/complete functions and selected audited RPCs.
- `server/services/audit-operations.ts` and `server/repositories/audit-operations.ts` implement intent/complete, stale claim and unresolved outcome processing.
- `server/api/internal/audit/reconcile.post.ts` exposes the protected reconciliation endpoint.
- `server/utils/audit-mutation-registry.ts` declares a high-level audit strategy per mutating route group, covered by `tests/server/audit/mutation-registry.test.ts`.
- Targeted tests exist for migration contracts, audit operations, mutation registry, and redaction. Previous CI success is source evidence only; **cloud deployment and full per-route durability were not independently verified** in this cleanup.

### Material gap

`server/services/audit.ts` still documents and implements `AuditService.append()` as best-effort: exceptions are caught and logged instead of rejecting the preceding mutation. A registry entry labeled `outbox` is not proof that every individual write creates durable intent **before** external side effects. Treat the four open tasks as genuine correctness work.

## Remaining work by canonical task

| Task | Next implementation slice | Acceptance evidence required |
| --- | --- | --- |
| **3.1** failure injection | Test billing period transitions, payments, utility overrides, destructive building/room/tenant operations and permission changes | Induce audit persistence failure; each critical DB mutation either rolls back atomically or uses an approved compensating/durable strategy; no mutation reports success without its mandated record |
| **3.2** audited DB mutations | Inventory all remaining database-local post-commit `AuditService.append` paths and migrate critical ones to transactionally audited SQL/RPCs, with role/scope/grant checks | SQL transaction tests and repository/service tests prove mutation + audit commit together; grants are service-only where required, and previous fail-open paths are removed for the targeted operations |
| **3.3** contract side effects | Record room-occupancy side effects and successor-contract events within the same create/update/renew transaction, preserving correlation IDs | Contract creation, room move, end/renewal and 0/1/N roommate cases yield correctly scoped parent/child audits; forced failure rolls all changes back; retry creates no duplicate events |
| **4.2** cross-system durable intent | Route Auth user changes, Storage writes/deletes and externally backed mutations through pre-effect `AuditOperationService.begin` and idempotent completion/reconciliation | Simulate external timeout, duplicate delivery, partial success, retry and unknown outcome; preserve secret-free telemetry and lease safety, and never fabricate success when external state cannot be verified |

### Suggested execution order (not a second checklist)

1. **Audit A — 3.1 + 3.2**: write failing cases, add/adjust transactional RPCs, migrate core local DB callers; include cloud migration/grant verification.
2. **Audit B — 3.3**: correlated room + successor events in atomic contract flows, including renewal and checkout interactions.
3. **Audit C — 4.2**: Auth/Storage/provider intent → external effect → completion, safe retry/reconcile and unknown-outcome handling.
4. **Final gate**: re-run focused/full tests, lint, typecheck, `npm run knowledge:check`, migration/SQL checks and review restricted-role access, historical PII redaction, production rollout and monitoring.

This breakdown is planning guidance only. **`tasks.md` remains the single executable checklist**; do not maintain another parallel set of task completion checkboxes.

## Accepted-spec versus runtime distinction

The accepted [entity-audit-log](../../capabilities/entity-audit-log.md) and [audit-operation-outbox](../../capabilities/audit-operation-outbox.md) capabilities describe desired guarantees. Where a SHALL requirement exceeds verified coverage, record it as a requirements/runtime discrepancy rather than weakening accepted requirements or falsely marking implementation finished.

The cleanup itself neither ran a production migration nor exercised a live audit failure. Once all four tasks and the rollout gate are evidenced, reconcile capabilities, archive the original change materials to `docs/history/<date>-harden-event-audit/` and remove this bundle from the active index.
