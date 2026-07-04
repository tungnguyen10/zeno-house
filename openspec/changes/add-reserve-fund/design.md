## Context

The operations report tracks per-building revenue and costs but has no concept of money set aside for future use. Operators keep a mental or spreadsheet reserve and dip into it for large repairs. Building expenses already exist with soft-void and audit behavior. This change adds a lightweight reserve fund per building with manual movements and links a withdrawal to the expense it pays, so a reserve-funded cost is recorded once as an expense and once as a fund movement, kept consistent.

## Goals / Non-Goals

**Goals:**

- Track a running reserve balance per building from manual deposits and withdrawals.
- Let an expense be paid from the reserve, creating the expense and a linked withdrawal together.
- Show the balance and recent transactions next to the monthly report.
- Restrict the feature to admin/owner.

**Non-Goals:**

- Automatic percentage allocation of revenue into the reserve (manual only in this change).
- Interest, multi-fund, or cross-building transfers.
- Manager access to fund balance or movements.
- Changing how profit is computed; the reserve is a cash pool, not an expense category.

## Decisions

### Data model

`reserve_funds`: `id`, `building_id` (unique), `created_at`. Balance is derived, not stored, to avoid drift. `reserve_fund_transactions`: `id`, `fund_id`, `type` (`deposit` | `withdrawal`), `amount` (> 0), `date`, `linked_expense_id` (nullable, for withdrawals), `note`, `created_by`, `created_at`. Balance = sum(deposits) − sum(withdrawals).

Alternatives considered:

- Store a mutable `balance` column: rejected because it can drift from the transaction ledger; deriving from transactions keeps a single source of truth. A cached balance can be added later if needed.

### Expense funding linkage

Add `funded_by` (`direct` | `reserve_fund`, default `direct`) to `building_expenses`. Paying from the reserve is a single service operation that creates the expense and a linked withdrawal atomically (both succeed or neither), setting `funded_by = reserve_fund` and `linked_expense_id`. If atomic multi-write is not available in one call, the service compensates on failure so no orphan expense or orphan transaction remains.

### Balance guard

Withdrawals (including reserve-funded expenses) require sufficient balance. The service re-checks the derived balance at write time and rejects a withdrawal that would take the balance negative.

### Reporting placement

The reserve is a cash pool, not a cost, so it does not change profit math. The report page shows a fund panel (current balance + recent transactions) and the expense form offers a "pay from reserve" toggle only when the building's balance is positive. Reserve-funded expenses still appear as normal expenses in the report with a marker.

### Permissions

Add `reserve-fund.read`, `reserve-fund.deposit`, and `reserve-fund.withdraw` to owner (admin inherits). Managers receive none, so they do not see the fund panel or the pay-from-reserve option.

## Risks / Trade-offs

- A reserve-funded expense involves two writes that must stay consistent -> perform them atomically or compensate on failure, and cover with tests.
- Deriving balance on every read could be costly at high transaction counts -> acceptable for expected volumes; index by `fund_id` and revisit a cached balance if needed.
- Voiding a reserve-funded expense leaves the withdrawal in place -> define that voiding such an expense also reverses or flags the linked withdrawal so the balance stays correct.
- Managers must never see fund data -> gate both API and UI on reserve capabilities, not just navigation.

## Migration Plan

1. Add migration for `reserve_funds`, `reserve_fund_transactions`, and the `funded_by` column on `building_expenses`, with indexes and RLS safety policies; regenerate types.
2. Add DTOs, mappers, and Zod validators.
3. Add repositories and services: derived balance, deposit, withdraw, and atomic pay-from-reserve with balance guard and void reversal.
4. Add API routes: get fund + transactions, deposit, withdraw; extend expense create to support reserve funding.
5. Add the report fund panel and the expense-form reserve toggle.
6. Update docs; run typecheck, focused tests, and `openspec validate --specs`.
