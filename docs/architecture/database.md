# Database And Migrations

Zeno House uses Supabase Postgres. Schema history lives in `supabase/migrations`.

## Migration Groups

| Area | Migrations |
| --- | --- |
| Buildings | `20260514000000_create_buildings.sql`, `20260514000001_fix_buildings_rls.sql`, `20260514000003_buildings_drop_total_rooms.sql`, `20260517000000_building_operational_config.sql`, `20260614000000_add_building_slugs.sql` |
| Rooms | `20260514000002_create_rooms.sql` |
| Tenants | `20260514000004_create_tenants.sql`, `20260530100000_tenant_enrichment.sql` |
| Deprecated room assignments | `20260514000005_create_room_assignments.sql`, `20260530000000_drop_room_assignments.sql` |
| Contracts | `20260515000000_create_contracts.sql`, `20260517000001_contract_commercial_terms.sql`, `20260531000000_contracts_backfill_building_id.sql`, `20260531000001_contracts_payment_day.sql`, `20260615000000_document_codes.sql` |
| Occupants and renewals | `20260517000002_occupants_and_meter_devices.sql`, `20260517000005_contract_renewals_table.sql`, `20260517000006_occupant_uniqueness.sql` |
| Contract payments | `20260517000003_contract_payments.sql`, `20260610000000_drop_contract_payments_tenant_id.sql` |
| Service catalog | `20260530200000_service_catalog.sql` through `20260530200005_drop_default_service_fees.sql` |
| Meter readings | `20260530300000_meter_readings.sql`, `20260530400000_simplify_meter_readings.sql` |
| Billing runtime | `20260611000000_billing_runtime.sql`, `20260611000001_billing_legacy_cleanup.sql` |
| Operations report | `20260702173259_add_operations_report.sql`, `20260704000000_expense_receipts_and_export_categories.sql`, `20260705000000_recurring_and_prepaid_expenses.sql` |
| Shared expenses and reserve fund | `20260705010000_shared_expenses_and_reserve_fund.sql` |

## Core Tables

Property and occupancy:

- `buildings`
- `rooms`
- `tenants`
- `contracts`
- `contract_occupants`
- `contract_payments`
- `contract_renewals`

Services:

- `service_catalog`
- `building_services`
- `contract_services`

Metering:

- `meter_readings`

Billing:

- `billing_periods`
- `invoices`
- `invoice_charges`
- `invoice_payments`
- `billing_utility_usages`
- `billing_audit_events`

## Identifier Strategy

Readable operational routes are supported by database identifiers:

- `buildings.slug`
- `contracts.contract_code`
- `invoices.invoice_code`

Route helpers still fall back to ids when readable identifiers are absent.

## Billing Runtime Model

`billing_periods` is unique by `(building_id, period_year, period_month)`.

`invoices` stores immutable issued snapshots:

- one active non-void invoice per `(billing_period_id, contract_id)`
- linked replacement flow through `supersedes_invoice_id` and `superseded_by_invoice_id`
- denormalized totals: subtotal, discount, surcharge, total, paid, balance

`invoice_charges` stores the line-item snapshot used to explain totals.

`invoice_payments` stores collection events.

`billing_utility_usages` stores manual usage overrides by period, room, and meter type.

`billing_audit_events` stores append-only operational audit events.

## Operations Report Model

`building_expenses` stores monthly operating expenses and now includes `receipt_url`, which is a private Supabase Storage object path, not a public URL. Accepted categories include electricity/water input, internet, cleaning, repair, admin fees, supplies, staff, rent adjustment, insurance, bank fees, fire-safety costs, and other. User-entered expense labels are stored in `note`; category remains the report grouping key.

`building_fixed_costs` stores recurring costs with effective period ranges. Fixed-cost management lives in building settings; the operations report reads applicable rows for the selected month. User-entered fixed-cost labels are stored in `note`.

`recurring_expenses` stores building-scoped reminder templates with frequency, anchor day, estimated amount, active flag, and `next_reminder_at`. Recording or dismissing a reminder advances `next_reminder_at`; recording returns a prefill for a normal `building_expenses` row.

`prepaid_expenses` stores building-scoped lump-sum costs spread across `total_months`. The service computes `end_date` and rounded `monthly_amount`; the final covered month absorbs any rounding remainder so allocations sum to `total_amount`.

`shared_expenses` stores owner-scoped expense definitions that apply to multiple buildings. `shared_expense_buildings` stores membership. Allocation creates one normal `building_expenses` row per member building for the selected period and tags the row note with a shared-origin marker to guard duplicate allocations.

`reserve_funds` stores one fund per building. `reserve_fund_transactions` is the ledger; balance is derived from deposits minus withdrawals. `building_expenses.funded_by` marks direct versus reserve-funded expenses, and reserve-funded expense voids create a compensating deposit transaction.

`expense-receipts` is a private Storage bucket for receipt images. Server services enforce capability and building scope before upload, delete, or signed URL generation.

## RLS And Security Notes

- Public-schema tables should have RLS enabled.
- Authorization data comes from `auth.jwt() -> 'app_metadata' ->> 'role'`.
- Do not use user-editable metadata for authorization decisions.
- The app's business operations go through Nuxt server services and capability checks.
- RLS remains a safety net for direct authenticated access.

## Changing The Schema

When changing schema:

1. Check current migrations and the target table shape first.
2. Iterate against a database using SQL tooling.
3. Create a clean migration with Supabase CLI when the shape is settled.
4. Regenerate `app/types/database.types.ts` after applying schema changes.
5. Update mappers, validators, API docs, and tests in the same change.

Do not invent migration timestamps manually when using the Supabase CLI workflow. Use the CLI migration command for new migration files.
