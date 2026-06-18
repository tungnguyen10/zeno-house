## Context

Current billing writes are service-sequenced. Invoice issue creates invoice rows and charge rows, then advances period status and writes audit metadata. Bulk payment loops through invoice payments, updates invoice totals, and uses best-effort rollback if a later row fails. This is understandable for an MVP, but financial writes should become database-atomic.

Supabase/PostgREST does not automatically wrap multi-request service logic in one transaction. The likely hardening path is additive SQL RPC functions called by the server with service-role permissions.

## Goals / Non-Goals

**Goals:**
- Make invoice issue all-or-nothing.
- Make bulk payment all-or-nothing.
- Keep endpoint request/response shapes stable.
- Keep audit metadata consistent with committed financial writes.
- Document any required SQL as manual Supabase Dashboard SQL.

**Non-Goals:**
- No payment gateway integration.
- No accounting ledger/double-entry model.
- No UI redesign.
- No table rewrite unless required by the selected transaction pattern.

## Decisions

### D1 - Prefer Additive RPC For Atomic Financial Operations

Implement database functions for the multi-table write portions if service-only transaction support is unavailable. The server should still own permission checks, input validation, draft recomputation, and response enrichment. RPC functions should own the atomic insert/update/audit write sequence.

Alternative considered: keep best-effort rollback and add more tests. Rejected because rollback cannot guarantee consistency if a delete/update rollback also fails.

### D2 - Keep Domain Validation In TypeScript Where Practical

The server should continue validating user permissions, request shape, billing period state, blockers, overpayment, and reason policy before calling the transaction function. Database functions should re-check critical invariants that protect financial integrity.

### D3 - Audit Must Commit With The Financial Write

For issue and bulk payment, audit rows should be inserted in the same transaction as financial rows. If the transaction fails, no audit success event should remain. Failed attempts may continue to be audited outside the transaction when intentionally supported.

### D4 - Preserve API Contract

Existing endpoints should keep their paths and response shapes. Client code should not need behavior changes beyond better error messages if rollback failures disappear.

## Risks / Trade-offs

- [RPC functions duplicate some validation] -> Mitigation: keep database checks limited to invariants needed for integrity.
- [Manual SQL increases deployment care] -> Mitigation: include preflight, verification, and rollback notes in the migration.
- [Tests may need repository/RPC mocks] -> Mitigation: keep service tests focused on call behavior and add SQL text assertions where real DB tests are unavailable.
- [Transaction work can become too broad] -> Mitigation: limit this change to issue and bulk payment only.

## Migration Plan

1. Design SQL functions and payload shapes.
2. Add additive migration with verification and rollback notes.
3. Update repositories/services to call transaction functions after existing validation.
4. Add success and failure-path tests.
5. Run billing tests, SQL/RLS tests, lint, and typecheck.

Rollback: revert service calls to existing sequential paths and drop additive functions using the migration rollback notes. Existing tables and data should not require rollback.

## Open Questions

- Should issue transaction accept fully materialized draft lines from TypeScript or recompute more inside SQL?
- Should bulk payment audit include both one bulk event and per-payment events, or only the existing bulk event?
