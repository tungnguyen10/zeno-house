## Context

The database already stores a building `payment_due_day`, building `grace_period_days`, and a contract `payment_day`, but invoice issue accepts one client-selected date and defaults it in the browser. Overdue queries compare that invoice date directly, so the persisted configuration does not affect runtime billing.

The issue workflow is preview-hash-confirm and commits through atomic PostgreSQL functions. The design must keep that protocol, support different dates within one batch, preserve retry semantics, and avoid changing already-issued invoices when source configuration changes.

## Goals / Non-Goals

**Goals:**

- Make due-date calculation server-owned, deterministic, and shared by every invoice creation path.
- Preserve contract override, building fallback, and a four-day system fallback.
- Snapshot grace and an indexable overdue date on every invoice.
- Keep explicit batch override available without making it the default source.
- Preserve existing invoice behavior and data during migration.

**Non-Goals:**

- Per-invoice manual editing inside one preview batch.
- A new invoice status for the grace interval.
- Retroactively applying current building grace to existing invoices.
- A new theme, token set, or reusable UI primitive.

## Decisions

### Server-owned schedule resolver

A pure server module resolves a schedule from `calculationDate`, optional `dueDateOverride`, contract `paymentDueDay`, building `paymentDueDay`, and building `gracePeriodDays`. The precedence is override, contract, building, then four calendar days. A configured day means the next occurrence on or after the calculation date in `Asia/Ho_Chi_Minh`; days beyond a month's length clamp to its final day. Past overrides are rejected.

This is preferred to browser calculation because API, AI, and transactional flows must agree. It is preferred to a database-only resolver because preview documents and validation need the same typed domain result before commit.

### Immutable overdue schedule

Invoices store `grace_period_days` and a generated stored `overdue_date = due_date + grace_period_days`. Existing rows receive zero grace, preserving current behavior. Persisting both the policy input and its queryable result keeps reissue semantics explicit and avoids repeated date arithmetic in REST filters and reporting queries.

### Per-invoice atomic payload

Issue RPC draft items carry their own `due_date` and `grace_period_days`; the obsolete shared `p_due_date` argument is removed from the active function signature. Services resolve schedules before commit, and transaction functions persist only server-owned draft items. Reissue and correction reuse the replaced invoice schedule unless the caller explicitly supplies a new override.

### Preview hash and midnight behavior

The canonical snapshot includes `calculation_date`, override, source due-day values, resolved due/grace/overdue values, and existing financial/profile state. Confirm recomputes with the current Vietnam date. Crossing midnight or editing contract/building configuration invalidates the preview with the existing stale-preview conflict.

### Focused UI change

The issue modal starts in automatic mode and displays dates on each draft document. An explicit toggle reveals the existing `UiDatePicker` for one shared override. Detail surfaces show a grace message only when today is after `dueDate` and not after `overdueDate`. Existing hierarchy, dark operational tokens, primitives, and responsive modal behavior remain unchanged.

## Risks / Trade-offs

- [RPC signature replacement can strand older clients] → update every in-repo caller and drop only the obsolete exact signatures in the same migration.
- [Generated-column support can drift from checked-in types] → regenerate types through the project workflow and add schema/type assertions.
- [Preview crosses midnight] → intentionally return stale conflict so the operator reviews the newly calculated dates.
- [Day 29–31 is ambiguous in short months] → specify and test last-day clamping.
- [Legacy null due dates cannot produce an overdue date] → retain null and render “Chưa có hạn thanh toán” rather than inventing history.

## Migration Plan

1. Rename the contract column in place and add invoice grace plus generated overdue date; existing invoices default to zero grace.
2. Replace affected transaction function signatures and grants without weakening existing authorization.
3. Regenerate database types and deploy server/UI callers together with the migration.
4. Verify migration SQL, function grants, issue/replay behavior, overdue filters, and legacy rows before enabling production issuance.

Rollback requires restoring the former RPC signatures and application payloads. The contract rename can be reversed without data loss; invoice schedule columns should be retained during rollback so issued snapshots are not discarded.

## Open Questions

None.
