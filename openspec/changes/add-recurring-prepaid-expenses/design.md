## Context

The operations report already aggregates issued billing revenue, one-off `building_expenses`, and effective-range `building_fixed_costs` per building/month. Two common cost shapes are still manual: recurring costs that repeat on a cadence, and prepaid lump sums that should be spread across the months they cover. Fixed costs already solve "same amount every month with history" (e.g., rent). Recurring is different: the amount is an estimate, the actual is recorded when the work happens, and the operator needs a reminder. Prepaid is different again: one payment, many months. This change adds both while keeping the report's revenue source and scope model unchanged.

## Goals / Non-Goals

**Goals:**

- Let operators define recurring cost templates and be reminded when each is due.
- Record a due recurring item as a normal building expense for the period, preserving the existing expense/void/report pipeline.
- Let operators enter a prepaid total that the system spreads evenly and contributes to each covered month automatically.
- Keep manager able to see and record recurring reminders, but not configure templates or prepaid.

**Non-Goals:**

- Price-version history or per-occurrence tables for recurring (the recorded expenses are the history).
- Bonus/free months, uneven schedules, or partial-month proration for prepaid.
- Auto-creating expenses without operator confirmation for recurring items.
- Push/email notifications outside the app.

## Decisions

### Recurring model (simplified)

`recurring_expenses`: `id`, `building_id`, `name`, `category` (expense category enum), `frequency` (`monthly` | `quarterly` | `biannual` | `yearly`), `anchor_day` (1–28), `estimated_amount`, `is_active`, `next_reminder_at` (date), `created_by`, timestamps. No versions table and no occurrences table.

Rationale: the actual `building_expenses` rows created from reminders already form the historical record and carry true amounts. When an estimate changes, the operator edits `estimated_amount`; historical months are unaffected because they were recorded as real expenses.

Alternatives considered:

- Full `versions` + `occurrences` tables (as originally proposed): rejected as over-modeled for the reminder+record workflow; adds tables that duplicate expense history.
- `custom` interval with unit/count: rejected; four fixed frequencies cover real cases and keep the form simple.

### Reminder scheduling

`next_reminder_at` is computed from `anchor_day` and `frequency`. "Due/upcoming" means `next_reminder_at <= today + 7 days`. Recording an item advances `next_reminder_at` by one frequency step; dismissing advances it without creating an expense. No background job in this change: `next_reminder_at` is stored and queried, and advanced on user action.

### Record-to-expense flow

Recording a due recurring item opens the existing `OperationsExpenseModal` prefilled with `category`, `estimated_amount`, and the current period. Submitting creates a normal `building_expenses` row (existing capability `building-expenses.write`) and advances the template's `next_reminder_at`. This reuses void, audit, receipt, and report behavior with no new expense pipeline.

### Prepaid model (simplified)

`prepaid_expenses`: `id`, `building_id`, `name`, `category`, `total_amount`, `total_months` (>= 1), `start_date`, `end_date` (computed = start + total_months), `monthly_amount` (computed = round(total/total_months)), `status` (`active` | `expired` | `cancelled`), `receipt_url`, `note`, `created_by`, timestamps. No bonus months.

Rounding: `monthly_amount` uses integer VND; any rounding remainder is absorbed in the final covered month so the sum equals `total_amount`.

### Report contribution

`OperationsReportService.getReport` gains a prepaid source: for the selected period it includes every active prepaid whose `[start, end)` window covers that month, contributing `monthly_amount` (or the final-month adjusted amount). The `OperationsReport` DTO gains `prepaidItems` (name + monthly amount) and prepaid total feeds `totalExpense`, `profitByRevenue`, and `profitByCash`. Prepaid is shown as its own section, separate from one-off expenses and fixed costs.

Alternatives considered:

- Materialize a `building_expenses` row per prepaid per month: rejected; it clutters the expense list and risks drift; on-the-fly aggregation keeps a single source of truth.

### Permissions

Add to owner (admin inherits): `recurring-expenses.read/write/delete`, `prepaid-expenses.read/write`. Manager gains `recurring-expenses.read` only, so they can see and record reminders but not configure templates or prepaid. Prepaid is owner-only because it is a longer-term financial commitment.

### Placement

Recurring and prepaid management live in `/buildings/[id]/settings` under "Chi phí vận hành". Due reminders are surfaced on the operations report page (and optionally a shell widget) so recording happens next to the monthly view.

## Risks / Trade-offs

- Without a scheduler, `next_reminder_at` only advances on user action, so a long-idle template can show as overdue -> acceptable for MVP; surface overdue clearly and advance on record/dismiss.
- Prepaid rounding could make month sums drift from the total -> absorb remainder in the final month and assert the invariant in tests.
- Recording twice for the same period could double-count -> after recording, advance `next_reminder_at` immediately and show the created expense so duplicates are obvious.
- Extending the report DTO touches a shared shape used by the page and export -> land the DTO change once and update page + export together.

## Migration Plan

1. Add migration for `recurring_expenses` and `prepaid_expenses` with indexes and RLS safety policies; regenerate types.
2. Add DTOs, constants, mappers, and Zod validators for both.
3. Add repositories and services with capability + scope checks; compute `next_reminder_at` and prepaid `monthly_amount`.
4. Add API routes: recurring CRUD + record/dismiss; prepaid CRUD.
5. Extend `OperationsReportService.getReport` and the `OperationsReport` DTO with the prepaid section.
6. Add settings management UI and the report reminder + prepaid section.
7. Update docs; run typecheck, focused tests, and `openspec validate --specs`.
