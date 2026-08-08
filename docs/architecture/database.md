# Database And Migrations

Zeno House uses Supabase Postgres. Schema history lives in `supabase/migrations`.

## Migration Groups

| Area | Migrations |
| --- | --- |
| Buildings | `20260514000000_create_buildings.sql`, `20260514000001_fix_buildings_rls.sql`, `20260514000003_buildings_drop_total_rooms.sql`, `20260517000000_building_operational_config.sql`, `20260614000000_add_building_slugs.sql`, `20260708010000_add_building_operational_start_period.sql` |
| Rooms | `20260514000002_create_rooms.sql` |
| Tenants | `20260514000004_create_tenants.sql`, `20260530100000_tenant_enrichment.sql` |
| Tenant identity | `20260708020000_tenant_id_images.sql`, `20260716083605_add_tenant_identity_foundation.sql`, `20260717001405_tenant_self_identity_images.sql`, `20260722085743_tenant_roommate_portal_access.sql`, `20260729120000_harden_tenant_account_lifecycle.sql` |
| Tenant documents | `20260716233954_add_tenant_documents.sql` |
| Tenant support requests | `20260717171947_add_tenant_support_requests.sql`, `20260717221849_harden_support_request_attachment_scope.sql` |
| Deprecated room assignments | `20260514000005_create_room_assignments.sql`, `20260530000000_drop_room_assignments.sql` |
| Contracts | `20260515000000_create_contracts.sql`, `20260517000001_contract_commercial_terms.sql`, `20260531000000_contracts_backfill_building_id.sql`, `20260531000001_contracts_payment_day.sql`, `20260615000000_document_codes.sql` |
| Occupants and renewals | `20260517000002_occupants_and_meter_devices.sql`, `20260517000005_contract_renewals_table.sql`, `20260517000006_occupant_uniqueness.sql` |
| Contract payments | `20260517000003_contract_payments.sql`, `20260610000000_drop_contract_payments_tenant_id.sql` |
| Service catalog | `20260530200000_service_catalog.sql` through `20260530200005_drop_default_service_fees.sql`, `20260706010000_building_custom_service_catalog.sql` |
| Meter readings | `20260530300000_meter_readings.sql`, `20260530400000_simplify_meter_readings.sql` |
| Billing runtime | `20260611000000_billing_runtime.sql`, `20260611000001_billing_legacy_cleanup.sql`, `20260805184000_add_billing_incidental_charges.sql` |
| Invoice email delivery | `20260723103000_add_invoice_email_delivery.sql` |
| Operations report | `20260702173259_add_operations_report.sql`, `20260704000000_expense_receipts_and_export_categories.sql`, `20260705000000_recurring_and_prepaid_expenses.sql`, `20260707030000_operations_report_closure.sql`, `20260707031000_fix_operations_report_periods_shape.sql` |
| Shared expenses and reserve fund | `20260705010000_shared_expenses_and_reserve_fund.sql`, `20260707010000_reserve_fund_auto_accrual.sql`, `20260707020000_fix_reserve_fund_source_constraint.sql` |
| Pending account approval | `20260718155418_add_pending_account_approval.sql`, `20260719093000_fence_access_request_approval.sql`, `20260808034740_fix_provisioned_access_request_trigger.sql` |

## Core Tables

Property and occupancy:

- `buildings`
- `rooms`
- `tenants`
- `tenant_user_links`
- `support_requests`
- `access_requests`
- `contracts`
- `contract_occupants`
- `contract_payments`
- `contract_renewals`

`buildings` now includes `operational_start_year` and `operational_start_month` to declare each building's first operating month. The pair is nullable but must be provided together.

`tenant_user_links` maps one Supabase Auth user to one tenant record. Only an `active` link
establishes tenant self-scope; unique constraints on both ids enforce the one-to-one mapping.
The lifecycle hardening migration preserves ownership cascades on this table, while converting
historical actor columns such as `audit_events.actor_id`, `billing_audit_events.actor_id`, and
`invoice_payments.recorded_by` to nullable `ON DELETE SET NULL`. Historical attribution therefore
survives account revocation without blocking a hard Auth delete.

Tenant housing context is resolved dynamically without another link table. A current primary
contract wins; otherwise an active `contract_occupants` row grants shared room, contract, and
contract-invoice reads. Personal tenant rows, identity images, documents, and support-request
timelines remain scoped to the linked tenant record. Recording `move_out_date`, terminating the
contract, or reaching its end date removes shared access immediately.

`support_requests` stores tenant-authored issues with server-derived tenant, active-contract, and
building context. Status is limited to `new`, `in_progress`, or `resolved`; optional attachment
paths point into the tenant-prefixed area of the existing private `tenant-documents` bucket.
Tenant RLS is self-scoped through active `tenant_user_links`; owner/manager reads are scoped through
`user_building_assignments`, while admin reads are unscoped. Request creation accepts a current
primary tenant or active roommate and enforces the same title/description bounds as the server
validator.

`access_requests` stores one private lifecycle row per Supabase Auth user, including identity
snapshot, provider, status, decision role/scope, reviewer, rejection reason, and timestamps. A
deferred `auth.users` constraint trigger reads the final persisted Auth row at transaction end and
inserts only when the identity still has no `app_metadata.role`; this accounts for Supabase Admin
Auth applying custom metadata after the initial insert and keeps provisioned accounts out of the
queue. The corrective migration reconciles only untouched pending rows for role-bearing users,
appends `user.access_request.reconciled` with a system actor, and leaves all decided lifecycle rows
unchanged. RLS is enabled and all table privileges are revoked from `anon` and `authenticated`;
only service-role repositories may access it. The nullable
`created_audited_at` marker and its `audit_events` insert are written together by a row-locking
security-definer function, making the observed-creation audit atomic and idempotent.

Services:

- `service_catalog`
- `building_services`
- `contract_services`

`service_catalog.building_id` is nullable. `NULL` rows are global defaults; non-null rows are custom catalog items visible only for that building.

Metering:

- `meter_readings`

Billing:

- `billing_periods`
- `building_invoice_profiles`
- `invoices`
- `invoice_charges`
- `invoice_payments`
- `billing_utility_usages`
- `billing_incidental_charges`
- `billing_audit_events`
- `building_invoice_email_settings`
- `invoice_email_deliveries`
- `invoice_email_webhook_events`

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
- `invoice_profile_snapshot`: nullable, schema-versioned receiving-bank identity captured when the invoice is inserted

`building_invoice_profiles` stores one current receiving profile per building: normalized bank fields, transfer-content template, required QR path, optional logo path, audit actor, and one-time legacy-backfill marker. A `BEFORE INSERT` trigger snapshots the current profile for every invoice creation transaction; missing profiles do not block issuance. The first profile upsert backfills only non-void invoices with a null snapshot, and later edits preserve history.

The private `building-invoice-assets` Storage bucket accepts JPEG, PNG, and WebP objects up to 5 MB. Objects use unique append-only paths because issued snapshots may retain older versions. Browser clients receive only short-lived signed URLs after service-layer permission and building-scope checks.

`invoice_charges` stores the line-item snapshot used to explain totals.

`invoice_payments` stores collection events.

AI full-balance collection is committed by `record_ai_invoice_payments_with_audit`. This service-role-only `SECURITY INVOKER` RPC locks one period and a stable invoice order, validates all expected versions and balances before writing, records the complete batch atomically, and uses the action correlation ID to replay a previously committed result without duplicate payment or audit rows.

`billing_utility_usages` stores manual usage overrides by period, room, and meter type.

`billing_incidental_charges` stores positive one-off charges for exactly one billing period, contract, and room. It has an idempotent `operation_id`, optimistic `updated_at`, service-role-only reads/RPC writes, and atomic create/update/delete audit functions. Deletes remain hidden soft tombstones so retrying the original operation cannot recreate a removed charge. Source rows are editable only while the period is not closed and the contract has no non-void invoice in that period; a void invoice permits correction before reissue. A deferred commit guard compares current active sources with persisted invoice lines, preventing a concurrent source change from issuing stale data. Issuance snapshots each row as `invoice_charges.charge_type = 'incidental'`, so later periods do not inherit it.

`billing_audit_events` stores append-only operational audit events.

`building_invoice_email_settings` stores one default-off automatic-send setting per building.
`invoice_email_deliveries` is the durable outbox and delivery history: it snapshots the normalized
recipient, source, provider id, attempt/lease state, terminal timestamps, and safe provider error.
A partial unique index reuses only active queued/processing/accepted work for the same invoice and
recipient; a later explicit resend after a terminal outcome creates a new delivery.

The invoice `AFTER INSERT` trigger atomically enqueues or records a skipped delivery when building
auto-send is enabled, so period issue, issue-and-pay, and reissue share the same behavior. Missing
or malformed tenant email never aborts invoice issuance. `claim_invoice_email_deliveries` uses
`FOR UPDATE SKIP LOCKED`, batch 20, a ten-minute lease, and a six-attempt cap.
`apply_invoice_email_webhook_event` atomically deduplicates Svix ids, locks the matched delivery,
and applies event-time plus terminal precedence. All three tables deny browser roles and are
accessible only through service-role repositories/functions.

## Operations Report Model

`building_expenses` stores monthly operating expenses and now includes `receipt_url`, which is a private Supabase Storage object path, not a public URL. Accepted categories include electricity/water input, internet, cleaning, repair, admin fees, supplies, staff, rent adjustment, insurance, bank fees, fire-safety costs, and other. User-entered expense labels are stored in `note`; category remains the report grouping key.

`building_fixed_costs` stores recurring costs with effective period ranges. Fixed-cost management lives in building settings; the operations report reads applicable rows for the selected month. User-entered fixed-cost labels are stored in `note`.

`operations_report_periods` stores one optional lifecycle row per `(building_id, period_year, period_month)`. Missing rows are treated as open. Admin manual close/reopen and the internal month-end auto-close task update this table; closed periods lock report-affecting expense/config mutations until reopened. The active closure shape uses `status`, `close_source`, `closed_at/by`, and `reopened_at/by/reason`; migration `20260707031000_fix_operations_report_periods_shape.sql` reconciles older local databases that had an earlier `operations_report_periods` shape without `close_source` and reloads the PostgREST schema cache.

`recurring_expenses` stores building-scoped reminder templates with frequency, anchor day, estimated amount, active flag, and `next_reminder_at`. Recording or dismissing a reminder advances `next_reminder_at`; recording returns a prefill for a normal `building_expenses` row.

`prepaid_expenses` stores building-scoped lump-sum costs spread across `total_months`. The service computes `end_date` and rounded `monthly_amount`; the final covered month absorbs any rounding remainder so allocations sum to `total_amount`.

`shared_expenses` stores owner-scoped expense definitions that apply to multiple buildings. `shared_expense_buildings` stores membership. Allocation creates one normal `building_expenses` row per member building for the selected period and tags the row note with a shared-origin marker to guard duplicate allocations.

`building_reserve_fund_rates` stores period-based reserve rate history per building. `reserve_funds` stores one fund per building. `reserve_fund_transactions` is the ledger; active `monthly_accrual` rows increase the fund from non-negative operations profit at billing close, report close, auto-close, or admin refresh; active `expense_deduction` rows decrease it for reserve-funded expenses, and voided deductions no longer affect active balance. `building_expenses.funded_by` marks direct versus reserve-funded expenses. Reserve balances may be negative.

Operations-report close, operations-report auto-close, and admin reserve refresh never close billing periods. Billing period status changes only through billing flows.

`expense-receipts` is a private Storage bucket for receipt images. Server services enforce capability and building scope before upload, delete, or signed URL generation.

`tenant-documents` is a private Storage bucket for tenant-owned JPEG, PNG, WebP, and PDF files up
to 5 MB. Object paths start with the resolved tenant record id. Storage policies join that segment
to an active `tenant_user_links` row, while server APIs return only five-minute signed URLs.

`tenant-id-images` remains the canonical private bucket for both internal and tenant self-service
identity uploads. Admin/owner and tenant flows share `${tenant_id}/front/...` and
`${tenant_id}/back/...`; the existing tenant path columns identify the current object for each slot.
Tenant policies match only an active linked tenant id, and API responses expose signed URLs rather
than raw paths or public URLs.

## RLS And Security Notes

- Public-schema tables should have RLS enabled.
- Authorization data comes from `auth.jwt() -> 'app_metadata' ->> 'role'`.
- Do not use user-editable metadata for authorization decisions.
- The app's business operations go through Nuxt server services and capability checks.
- RLS remains a safety net for direct authenticated access.
- Tenant self-read policies on `tenant_user_links`, `tenants`, `contract_occupants`, `contracts`,
  and `invoices` resolve identity through `auth.uid()` and an active `tenant_user_links` row.
  Roommate branches additionally require a current active occupancy and contract.
- Manager safety-net reads of tenants, contracts, occupants, and invoices join
  `user_building_assignments`; direct browser writes to those business tables are revoked.

## Changing The Schema

When changing schema:

1. Check current migrations and the target table shape first.
2. Prepare reviewable SQL, including data impact, verification queries, and rollback notes.
3. Apply the SQL manually in Supabase Dashboard SQL Editor. Do not rely on `supabase db push`.
4. Regenerate `app/types/database.types.ts` from the configured Supabase cloud project after
   applying schema changes.
5. Update mappers, validators, API docs, and tests in the same change.

Do not invent migration timestamps manually when using the Supabase CLI workflow. Use the CLI
migration command for new migration files. Generating or applying schema changes must follow the
manual Dashboard change-control requirement above and does not require a local Postgres container.

For the incidental-charge migration, local Supabase CLI/runtime is not available in this repository checkout. Apply the migration in the configured cloud project, run Supabase database advisors, and then run the documented cloud type-generation command; do not hand-edit `app/types/database.types.ts` before that step.
