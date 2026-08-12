## Context

Contract `surcharge_amount` is a recurring commercial term and billing draft calculation emits it every overlapping month. Contract services are also recurring. Invoice adjustments exist only for corrections after issue and are intentionally absent from the regular workspace. The missing concept is an editable, auditable source row that belongs to one contract in one billing period and becomes an immutable invoice line at issue.

The implementation must preserve the existing Nuxt client → API → service → repository → Supabase flow, server-authoritative issue previews, atomic billing audit writes, building scope, and the current dark operational UI.

## Goals / Non-Goals

**Goals:**

- Persist multiple positive incidental charges for one contract and period without repeating them in another period.
- Make create, update, and delete idempotent/versioned, scope-safe, atomic with audit, and unavailable after the target invoice becomes effective or the period closes.
- Fold source rows into every authoritative draft path so preview hashes, issue, reissue, issue-and-pay, print, export, and reports agree.
- Give desktop and mobile operators a compact per-room workflow without adding another dense grid column.

**Non-Goals:**

- Negative incidental credits, reusable charge catalogs, recurring schedules, tenant self-service entry, or post-issue mutation.
- Replacing contract surcharge, contract services, or invoice-adjustment correction semantics.
- Applying migrations to a live Supabase project as part of repository implementation.

## Decisions

### Store period-scoped source rows separately

Create `billing_incidental_charges` with `billing_period_id`, `contract_id`, denormalized `room_id`, positive integer `amount`, trimmed `label`, nullable `note`, `operation_id`, creator, and timestamps. A separate table preserves source intent and lets drafts be recomputed; storing only invoice charges would be too late, while contract fields or services would repeat.

`operation_id` is globally unique and makes create retries return the original row. Updates and deletes require `expected_updated_at`. Multiple otherwise-identical rows are allowed because they can represent distinct real events.

### Use service-only transactional RPCs for writes

Create/update/delete execute through security-definer RPCs callable only by `service_role`. Each RPC locks the period and target invoice state, validates contract/building/room consistency, enforces closed-period and effective-invoice locks, writes the source row, and inserts the matching billing audit event in one transaction. Application services still enforce authentication, `billing.write`, and building scope before invoking the repository; database checks are defense in depth.

Direct table access remains RLS-protected and read-only to the server path. RPC functions explicitly set `search_path`, revoke `PUBLIC`, `anon`, and `authenticated`, and grant only `service_role`.

### Snapshot as a distinct `incidental` invoice charge

Extend `ChargeType` and the database charge-type check with `incidental`. Draft lines use `source_type='billing_incidental_charge'`, `source_id` equal to the source row, quantity `1`, and the amount as unit price and line total. Incidental lines participate in subtotal, not `surcharge_amount`, so recurring contract surcharge remains separately reported.

All draft calculators load charges by the current period and group by contract. Because issue preview hashes canonical draft lines, adding/editing/deleting a charge naturally invalidates a prior preview. Existing issue/reissue/issue-and-pay snapshot paths then persist the exact line without accepting client-supplied money.

### Keep UI local to the draft row

Add a **Thêm phát sinh** action in the row actions and mobile card. A focused modal owns create/edit fields and all validation/loading/error states. The existing room-detail drawer shows a **Khoản phát sinh kỳ này** section with edit/delete actions or a read-only locked explanation. Successful mutations reload the authoritative grid/overview rather than locally inventing totals.

### Preserve reporting semantics

Printed invoices show each incidental label as its own line. Excel and operations reports group `incidental` with the existing other/service amount while leaving contract `surcharge` unchanged. No historical invoice rows are rewritten.

## Risks / Trade-offs

- [Two persisted representations after issue: source row and invoice snapshot] → Treat invoice charges as the issued truth; lock the source while an effective invoice exists and keep source rows for audit/reissue inputs.
- [Concurrent edit or issue could race] → Lock period/invoice state in RPCs and require optimistic versions; issue preview hash detects draft changes before commit.
- [A void invoice permits draft edits that differ from the old invoice] → This is intentional; the replacement invoice snapshots a freshly reviewed draft.
- [Adding a new charge type touches exports and UI groupings] → Centralize charge labels/grouping and add regression tests for every exhaustive mapping.
- [Generated database types cannot be refreshed without configured cloud access] → Do not hand-edit them; keep repository row types local until the documented generation command can run against the configured project.

## Migration Plan

1. Apply the additive table, constraints, indexes, RLS, charge-type check update, and transactional RPC migration.
2. Regenerate Supabase database types through the configured cloud workflow; never edit the generated file manually.
3. Deploy server draft/API support before exposing the UI action.
4. Verify create/update/delete, preview invalidation, issue snapshot, print, export, RLS, and advisors in staging.
5. Roll back application code first if needed. The additive source table can remain dormant; rollback SQL drops only new RPCs/table/policies and restores the prior charge-type check after confirming no `incidental` invoice rows exist.

## Open Questions

None. Positive-only free-text charges, pre-issue editing, and placement in **Soạn kỳ** are approved defaults.
