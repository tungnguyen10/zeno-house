## Why

Operators repeatedly pay predictable costs: monthly staff salaries, quarterly elevator maintenance, yearly fire-safety renewal, and prepaid packages like an annual internet plan. Today every one of these must be re-entered by hand each month, which is error-prone and easy to forget, and prepaid lump sums distort a single month instead of spreading across the months they cover. This change adds recurring expense reminders and prepaid expense allocation so predictable costs are surfaced automatically and reflected correctly in the monthly operations report.

## What Changes

- Add recurring expense templates with a simple frequency (monthly, quarterly, biannual, yearly), an anchor day, an estimated amount, and a computed next reminder date.
- Surface due/upcoming recurring reminders and let an operator record one, which prefills and creates a normal building expense for that period.
- Add prepaid expenses that spread a total amount evenly across a number of months and automatically contribute a monthly allocation to the report during their active window.
- Aggregate prepaid monthly allocation into `OperationsReportService.getReport` and extend the report DTO with a prepaid section.
- Add management of recurring and prepaid records in `/buildings/[id]/settings` under "Chi phí vận hành".
- Add capabilities: recurring read/write/delete and prepaid read/write, with manager limited to recurring read (to see and record reminders).

## Capabilities

### New Capabilities

- `recurring-expenses`: Recurring expense templates, reminder scheduling, record-to-expense flow, permissions, and scope enforcement.
- `prepaid-expenses`: Prepaid expenses with even monthly allocation and automatic report contribution, permissions, and scope enforcement.

### Modified Capabilities

- `operations-report`: Include prepaid monthly allocation in report totals and add a prepaid breakdown section.

## Impact

- Database: new `recurring_expenses` and `prepaid_expenses` tables with indexes and RLS safety policies; regenerated database types.
- Server: new repositories, services, validators, mappers, and API routes; `OperationsReportService.getReport` extended to include prepaid allocation.
- Client: new composables and settings UI for recurring/prepaid; a reminder surface for due recurring items; a prepaid section on the report.
- Docs/specs: new recurring/prepaid capabilities; updates to operations-report, API, database, and auth-permissions docs.
