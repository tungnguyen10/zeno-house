## 1. Schema And Contracts

- [ ] 1.1 Add migration for `recurring_expenses` (building_id, name, category, frequency, anchor_day, estimated_amount, is_active, next_reminder_at, created_by, timestamps) with indexes and RLS safety policies
- [ ] 1.2 Add migration for `prepaid_expenses` (building_id, name, category, total_amount, total_months, start_date, end_date, monthly_amount, status, receipt_url, note, created_by, timestamps) with indexes and RLS safety policies
- [ ] 1.3 Regenerate/update database types
- [ ] 1.4 Add DTOs, constants (frequency + status enums with vi labels), mappers, and Zod validators for recurring and prepaid
- [ ] 1.5 Add capabilities: `recurring-expenses.read/write/delete`, `prepaid-expenses.read/write` to owner; add `recurring-expenses.read` to manager

## 2. Recurring Expenses — Server

- [ ] 2.1 Add repository for recurring CRUD, list-by-building, and list-upcoming (`next_reminder_at <= today + 7 days`)
- [ ] 2.2 Add service enforcing capability + scope; compute `next_reminder_at` from `frequency` + `anchor_day`
- [ ] 2.3 Add API routes: `GET/POST /api/recurring-expenses`, `PATCH/DELETE /api/recurring-expenses/[id]`
- [ ] 2.4 Add `POST /api/recurring-expenses/[id]/record` (advances reminder; returns prefill payload) and `POST /api/recurring-expenses/[id]/dismiss` (advances reminder only)
- [ ] 2.5 Add server tests for scheduling math per frequency, scope/permission, and record/dismiss advancement

## 3. Prepaid Expenses — Server

- [ ] 3.1 Add repository for prepaid CRUD, list-by-building, and list-active-in-period
- [ ] 3.2 Add service enforcing capability + scope; compute `end_date` and `monthly_amount` with final-month remainder absorption; auto-mark `expired` past `end_date`
- [ ] 3.3 Add API routes: `GET/POST /api/prepaid-expenses`, `PATCH/DELETE /api/prepaid-expenses/[id]`
- [ ] 3.4 Add server tests for allocation math, active-window selection, rounding invariant, and scope/permission

## 4. Report Integration

- [ ] 4.1 Extend `OperationsReport` DTO with a prepaid section (`prepaidItems` + prepaid total)
- [ ] 4.2 Extend `OperationsReportService.getReport` to include active prepaid monthly allocation in totals and breakdown
- [ ] 4.3 Update the operations export workbook to include the prepaid section
- [ ] 4.4 Update report-service tests to cover prepaid contribution to totals and profit

## 5. Client Implementation

- [ ] 5.1 Add `useRecurringExpenses` and `usePrepaidExpenses` composables
- [ ] 5.2 Add recurring management UI (list/create/edit/delete) in `/buildings/[id]/settings` gated by `recurring-expenses.write`
- [ ] 5.3 Add prepaid management UI with allocation preview (`~X đ/tháng`, end date, expiry badge) in settings gated by `prepaid-expenses.write`
- [ ] 5.4 Add a due/upcoming recurring reminders surface on the operations report page with "Ghi nhận" and "Bỏ qua" actions
- [ ] 5.5 Wire "Ghi nhận" to open `OperationsExpenseModal` prefilled (category, estimated amount, period) and advance the reminder on submit
- [ ] 5.6 Add a "Chi phí trả trước (phân bổ)" section to the report showing per-item monthly allocation

## 6. Documentation And Verification

- [ ] 6.1 Update operations-report, API, database, and auth-permissions docs
- [ ] 6.2 Run `npx openspec validate --specs`
- [ ] 6.3 Run focused tests and `npm run typecheck`
- [ ] 6.4 Manually smoke: create recurring, record a reminder into an expense, create prepaid, verify allocation appears in the report and export, verify manager can record but not configure
