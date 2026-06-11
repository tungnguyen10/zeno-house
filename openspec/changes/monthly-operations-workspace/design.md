# Design

## Context

The cleanup change established that monthly billing belongs to a Building + Period workspace. The schema now has reliable source inputs:

- `buildings`: utility pricing config and operation schedule fields
- `contracts`: rent, building_id, room_id, tenant_id, occupant_count, discount, surcharge, payment_day
- `contract_occupants`: period-aware occupant rows with `billing_counted`
- `meter_readings`: monthly electricity/water readings keyed by room + meter type + period
- `contract_services`: enabled service charges cloned from building defaults into each contract
- `contract_payments`: contract-level deposit/prepaid/legacy records, not invoice settlement

The missing layer is runtime billing state: which month is being processed, what charge snapshot was issued, what has been paid, what remains due, and whether the period is closed.

Implementation sequencing constraint: `adopt-operational-design-system` should land before this change is implemented. Monthly billing must use the adopted primitive set and operational patterns rather than introducing billing-only raw controls, tables, alerts, or section wrappers.

## Information Architecture

```text
Navigation: Vận hành -> /billing

/billing
  ├─ Month focus
  │   ├─ default: current month
  │   ├─ previous/next month switch
  │   └─ building/status filters
  ├─ Work queue
  │   ├─ needs readings
  │   ├─ ready to review
  │   ├─ issued / collecting
  │   ├─ overdue / has debt
  │   └─ closed
  ├─ Billing period table
  │   ├─ building
  │   ├─ period
  │   ├─ status
  │   ├─ reading progress
  │   ├─ invoice count
  │   ├─ issued total
  │   ├─ paid total
  │   ├─ outstanding balance
  │   └─ open workspace
  └─ Open/create period action

/billing/:buildingId/:period
  └─ one period workspace
```

The manager's first job is not to choose a form; it is to know what needs attention. `/billing` should therefore behave like a monthly operations list and queue. The workspace remains the focused surface for doing the work of one building/month.

## UI Composition Contract

The billing UI must be composed from the operational design system:

- `/billing` entry:
  - `UiPageHeader` for page context and primary action
  - `UiToolbar` for building, month/year, status, debt, and search filters
  - `UiMetric` for current month totals and queue counts
  - `UiTable` for billing period rows
  - `UiStatusBadge` with `context="period"` for period statuses
  - `UiAlert`, `UiSkeleton`, and `UiEmptyState` for feedback states
- Workspace:
  - `UiPageHeader` for building + period context, status, and primary actions
  - `UiTabs` for Overview, Readings, Review Charges, Issue Invoices, Payments/Debt, Audit, and Close Period
  - `UiSection` for each step area without nested decorative cards
  - `UiMetric` for period totals
  - `UiTable` for readings, invoice previews, payments, debt, and audit events
  - compact `UiInput`, `UiSelect`, and `UiTextarea` for editable table cells and dense correction fields
  - searchable select primitive for high-cardinality choices such as room, tenant, contract, invoice, or building when a normal select is not efficient
  - `UiModal` or optional `UiDrawer` for correction, void/reissue, adjustment, and close-period confirmation surfaces
- Status semantics:
  - period statuses must pass `context="period"`
  - invoice statuses must pass `context="invoice"`
  - blocker/correction statuses must pass `context="correction"`

Raw `input`, `select`, `textarea`, `table`, and `button` markup should not be introduced in billing pages/components except inside `app/components/ui/` or a documented exception.

## User Flow

```text
/billing
  lists billing periods and highlights current work
       |
       v
/billing/:buildingId/:period
  ├─ Overview
  │   ├─ rooms/contracts covered
  │   ├─ missing readings
  │   ├─ draft total
  │   ├─ issued/paid/debt totals
  │   └─ period status
  ├─ Chỉ số & hoá đơn nháp
  │   ├─ one row per room/contract billing subject
  │   ├─ enter electricity/water readings inline
  │   ├─ preview utility charges, room/service totals, blockers, and warnings
  │   └─ expand row for full draft invoice line items and override actions
  ├─ Issue Invoices
  │   └─ persist invoice snapshots + charge lines
  ├─ Payments / Debt
  │   ├─ record invoice payments
  │   ├─ show paid/partial/unpaid/overdue
  │   └─ show outstanding debt by room/tenant
  └─ Close Period
      └─ lock changes after all review conditions pass
```

## Optimize Billing Draft Grid

`optimize-billing-draft-grid` is a finishing phase inside this change. It replaces the first-pass split between `BillingReadingsStep` and `BillingDraftReviewStep` with a single work grid that matches the manager's monthly operation: enter new readings and immediately see whether each room's draft bill is ready.

### UX model

The primary tab label should be `Chỉ số & hoá đơn nháp`.

Default grid columns on desktop:

- `TT`
- `Chi tiết`
- `Phòng`
- `Khách thuê`
- `Số điện mới`
- `Số nước mới`
- `Tiền điện`
- `Tiền nước`
- `Phòng/Dịch vụ`
- `Tổng nháp`
- `Trạng thái`
- `Thao tác`

Column behavior:

- `Phòng` includes room number and optional building/floor context.
- `Khách thuê` includes tenant name and compact phone/contract context where available.
- `Số điện mới` and `Số nước mới` are compact editable inputs only when the period is editable and the row requires or allows readings.
- `Tiền điện` and `Tiền nước` show previous value, current value, usage formula, rate, and computed amount when available.
- `Phòng/Dịch vụ` summarizes rent and service totals; full line items remain in the expanded row.
- `Tổng nháp` uses the server draft total when a contract draft exists.
- `Trạng thái` shows `Thiếu chỉ số`, `Có lỗi`, `Cần soát`, `Sẵn sàng`, `Đã phát hành`, `Đã thu một phần`, `Đã thu`, or `Không lập hoá đơn` as appropriate.
- `Thao tác` exposes row-level actions such as override, expand details, or open issued invoice/payment action when valid.

The grid should default to rows needing attention, with filters:

- `Cần xử lý`
- `Tất cả`
- `Phòng trống`
- `Có lỗi`
- `Đã sẵn sàng`

### Mobile behavior

Mobile should not render the full desktop table horizontally as the primary experience. It should collapse each room into a dense row/card using the same data:

```text
P01 · Võ Chí Linh                         Tổng nháp 1,965,000
Điện: Cũ 3669 -> Mới [3823]  154 x 3,500 = 539,000
Nước: Cũ 507  -> Mới [511]   4 x 14,000 = 56,000
Phòng/DV: 1,370,000                    [Chi tiết]
```

Mobile must preserve the least-action workflow: edit new readings, see utility amount, see blocker, save/recompute, and expand details without navigating away.

### Batch reading date

The tab should provide one batch reading date in the toolbar:

```text
Ngày đọc chỉ số: [YYYY-MM-DD] [Áp dụng cho dòng trống]
```

Default date rules:

- if existing readings are present, keep their saved reading dates;
- if the period is the current month, default empty rows to today;
- if the period is in the past, default empty rows to the last day of that period;
- row-level date override is advanced behavior and should be inside row details or an overflow action, not a visible column by default.

### Vacant room baseline

Rows with an active contract in the period are billing rows. Vacant rooms are optional baseline rows:

- they may accept electricity/water readings;
- they do not create draft invoices;
- they do not block invoice issue;
- they are hidden from the default `Cần xử lý` filter unless they have invalid data or the user chooses `Phòng trống`;
- they display `Không lập hoá đơn` or `Baseline` status.

Required reading progress should be computed from active billing contracts and pricing rules that require meter readings, not from `rooms.status = 'occupied'` alone.

### Override modal

Meter replacement/reset/correction should be handled from the row, not as a separate disconnected section. The override surface should use `UiModal` and show:

- room, tenant/contract context;
- meter type;
- previous source reading id/value;
- current reading id/value;
- old meter final value;
- new meter start value;
- billable usage;
- reason;
- note;
- save/cancel actions.

Saving an override refreshes the draft grid and the existing draft calculation.

### Read model

The grid should be powered by a read model composed at the API/service boundary, not by the component stitching raw readings and drafts itself.

Suggested response shape:

```ts
interface BillingDraftGridResponse {
  period: BillingPeriod
  batchReadingDate: string
  rows: BillingDraftGridRow[]
  totals: {
    requiredReadingCount: number
    completeReadingCount: number
    readyDraftCount: number
    blockedDraftCount: number
    draftTotal: number
  }
}

interface BillingDraftGridRow {
  key: string
  rowType: 'billable_contract' | 'vacant_baseline' | 'data_warning'
  roomId: string
  roomNumber: string | null
  floor: number | null
  contractId: string | null
  tenantId: string | null
  tenantName: string | null
  contractCode: string | null
  invoiceId: string | null
  invoiceStatus: InvoiceStatus | null
  editable: boolean
  status: 'missing_reading' | 'blocked' | 'warning' | 'ready' | 'issued' | 'partial' | 'paid' | 'baseline'
  electricity: BillingDraftGridUtilityCell | null
  water: BillingDraftGridUtilityCell | null
  rentAndServiceTotal: number
  draftTotal: number | null
  blockers: BillingDraftBlocker[]
  warnings: BillingDraftWarning[]
  lines: BillingDraftLine[]
}

interface BillingDraftGridUtilityCell {
  meterType: 'electricity' | 'water'
  required: boolean
  editable: boolean
  previousReadingId: string | null
  previousValue: number | null
  currentReadingId: string | null
  currentValue: number | null
  readingDate: string | null
  usage: number | null
  rate: number | null
  amount: number | null
  pricingType: string | null
  overrideId: string | null
  source: 'monthly' | 'handover_fallback' | 'override' | 'fixed' | 'per_person' | 'not_applicable'
  blockerCode: string | null
}
```

The endpoint may compose existing period, room, reading, utility override, and draft services. It should not introduce a new repository layer for this optimization.

### Edit gating

Rows are editable only when the period is not closed and the invoice has not been issued for that contract. Issued, collecting, partial, paid, and closed states should be read-only in the grid.

Rules:

- `draft/readings/review`: reading inputs are editable.
- `issued/collecting`: readings and draft lines are read-only; corrections must use void/reissue or adjustment flow.
- `closed`: all normal edits are disabled.
- vacant baseline rows are editable only while the period is not closed and no issued billing state depends on them.

### Recompute strategy

The UI should maintain local input state for unsaved reading values. `Lưu & tính lại` should:

1. upsert changed meter readings only;
2. save override changes when submitted through the override modal;
3. refresh the draft-grid endpoint;
4. refresh overview totals;
5. preserve current filter/expanded-row state when possible.

Draft totals shown after save should come from the server read model, not client-only formulas. Client-side usage/amount previews may be shown as immediate hints, but server refresh is the source of truth.

### Issue tab A/B decision

Two valid options exist:

- Option A: keep `Phát hành` as a separate tab. This is safer for v1 because it preserves an explicit final confirmation step after the grid is clean.
- Option B: merge issue CTA into the top of `Chỉ số & hoá đơn nháp` once every visible billable row is ready. This reduces one tab but risks hiding the final financial checkpoint.

Decision for this change: use Option A. Keep `Phát hành` as a separate tab, but make it read from the same draft-grid/draft source so it does not feel disconnected.

## Decisions

### D1 - Period is the workflow aggregate

`billing_periods` owns the operational status for one building/month. It is unique by `(building_id, period_year, period_month)`.

Status model:

- `draft`: created but not ready
- `readings`: readings are being entered
- `review`: charges are ready for review
- `issued`: invoices have been issued
- `collecting`: payments are being collected
- `closed`: period is locked

Implementation may advance status automatically for common transitions, but service methods must validate transitions.

### D1a - `/billing` is the period list and work queue

`/billing` should show the billing period list, not only a selector. It should default to the current month and expose filters for building, period, and status.

Recommended list groups:

- `Needs readings`: period has active contracts but incomplete required readings
- `Ready to review`: draft charge can be calculated with no blockers
- `Issued / collecting`: invoices exist and collection is ongoing
- `Has debt`: one or more invoices have `balance_amount > 0`
- `Closed`: period is locked

The list should support opening an existing period and creating/opening a missing period for a selected building + month.

The list UI should be dense and scannable. It should not use a card grid for period rows because managers need to compare many buildings by reading progress, invoice totals, paid totals, and debt.

### D2 - Draft calculation is recomputable, issued invoice is a snapshot

Before issue, charges are calculated from live contract, service, occupant, building, and meter reading data. After issue, `invoices` and `invoice_charges` become the source of truth for what was charged.

This avoids stale drafts while preserving auditability after invoice issue.

Snapshot expectation:

- `invoices` stores period/contract/room/tenant references and final amount totals
- `invoice_charges` stores the line-level source, quantity, unit price, amount, and enough metadata to reconstruct how that line was calculated
- utility charge metadata should include current/previous reading ids and values, billable usage, rate, pricing type, and whether the previous reading came from monthly, handover fallback, or a workspace usage override
- per-person water metadata should include billing occupant count and source/fallback used
- service charge metadata should include contract_service id, catalog id, quantity, and amount at issue time

After issue, later changes to contract rent, service price, occupant count, or meter readings must not mutate already issued invoice totals.

### D3 - One active invoice per contract per period

An invoice belongs to one `billing_period` and one `contract`. It also stores `room_id` and `tenant_id` as snapshot references for query speed and historical display.

Uniqueness: one non-void invoice per `(billing_period_id, contract_id)`. Voided invoices remain as immutable history and may be replaced by a linked reissued invoice.

### D4 - Charge calculation rules

For each active contract in the selected building/period:

- Rent: `contracts.monthly_rent`
- Discount: `contracts.discount_amount`, represented as negative line or invoice-level discount
- Surcharge: `contracts.surcharge_amount`
- Services: enabled `contract_services` as line items, `amount * quantity`
- Electricity:
  - `per_kwh`: `(current - previous) * buildings.default_electricity_rate`
  - `fixed`: `buildings.default_electricity_rate`
  - `tiered`: blocked with a warning; issue is not allowed until a tiered engine exists or pricing is changed
- Water:
  - `per_m3`: `(current - previous) * buildings.default_water_rate`
  - `per_person`: `billing occupant count * buildings.default_water_rate`
  - `fixed_per_room`: `buildings.default_water_rate`

`current` is the monthly reading for the target period. `previous` is previous month monthly reading, falling back to `handover_in` for first billing month, matching the existing meter reading API behavior.

For normal usage, billable consumption is:

```text
current_reading_value - previous_reading_value
```

For meter reset/replacement, the workspace must allow an explicit utility usage override for that room + meter type + period. This avoids reintroducing a full meter device lifecycle while still making the monthly bill correct.

Replacement example:

```text
Previous month final reading: 980
Old meter final at replacement: 1000
New meter starts at: 0
Current new meter reading: 20

Billable usage = (1000 - 980) + (20 - 0) = 40
```

The override must store enough data to explain the calculation:

- previous source reading id/value
- old meter final reading, when relevant
- new meter start reading, when relevant
- current reading id/value
- billable usage
- reason: `replacement`, `reset`, `correction`, or `manual_adjustment`
- note

When a valid override exists, draft charge and issued invoice must use `billable_usage` from the override instead of deriving usage directly from current minus previous.

Billing occupant count should be computed from `contract_occupants` rows active during the period and `billing_counted = true`. If no occupant rows exist, fallback to `contracts.occupant_count`.

### D5 - Missing or invalid inputs block issue

Issue must be blocked when:

- active contract lacks required billing references
- required utility pricing config is missing
- per-usage utility requires current or previous reading and either is missing
- current reading is lower than previous reading and there is no valid utility usage override
- building electricity pricing is `tiered`
- invoice for the same contract and period already exists unless the operation is an idempotent re-issue of a draft

### D6 - Payments belong to invoices

Monthly collection records go to `invoice_payments`, not `contract_payments`.

`contract_payments` remains for deposit/prepaid/legacy contract-level records. Existing `rent` rows remain readable but must not be treated as invoice settlement source.

### D6a - Corrections follow invoice state

Correction behavior must depend on invoice and period state:

```text
Before issue
  -> edit source data or utility usage override
  -> draft recalculates

Issued, no payment recorded
  -> void invoice
  -> reissue replacement invoice from corrected inputs

Issued, payment already recorded
  -> do not mutate old invoice totals
  -> add an adjustment line to current/future invoice
  -> keep original invoice and payment history intact

Closed period
  -> normal edits blocked
  -> admin may reopen explicitly, or create adjustment in a later open period
```

Rules:

- Directly editing issued invoice charge formulas is not allowed.
- Voiding an invoice requires reason, actor, and timestamp.
- A reissued invoice should link to the voided invoice it replaces.
- Adjustments use `invoice_charges.charge_type = 'adjustment'` and metadata must reference the original invoice/period/reason.
- Payment correction, if supported, must be audited and must update paid/balance/status transactionally.
- Once a period is closed, correction should prefer adjustment in a later period unless an admin explicitly reopens the period.

Correction surfaces must preserve source context. A user should see the original invoice/period/room/tenant and the reason field before confirming void, reissue, or adjustment. These surfaces should use the modal/drawer patterns from the design system.

### D7 - Period close locks mutable monthly actions

When a period is `closed`:

- readings for the period should no longer be edited from the workspace
- invoice charges should not be regenerated
- invoice payments should not be added/edited through the normal flow
- reopening, if implemented, must be an explicit privileged action

### D7a - Billing audit events preserve operational history

Billing-critical actions should append immutable audit events. This is separate from invoice snapshots:

- snapshots answer: "what numbers were billed?"
- audit events answer: "who did what, when, and what changed?"

Required audited actions:

- period opened
- period status changed
- readings saved from the billing workspace
- utility usage override created or updated
- draft reviewed or issue attempted with blockers
- invoices issued
- invoice payment recorded
- invoice payment corrected or removed, if supported
- invoice voided, if supported
- invoice reissued from a voided invoice
- adjustment charge created
- period closed
- period reopened, if supported

Audit events should store actor id, action, entity type/id, billing period id, before/after JSON when applicable, metadata JSON, and timestamp.

### D8 - Permissions

Add service-layer capabilities:

- `billing.read`
- `billing.write`
- `billing.close`

Recommended role behavior:

- `admin`: read/write/close
- `manager`: read/write, no close by default

If the business owner wants managers to close periods, that should be a conscious update before implementation.

### D8a - List visibility

Users with `billing.read` can view the billing period list and period summaries. Creating/opening a new period requires `billing.write`.

### D9 - RLS is a safety net, service permissions remain primary

The server already uses authenticated service methods and capability checks. New tables still require RLS because they live in `public`.

New RLS policies should use `TO authenticated` plus `auth.jwt() -> 'app_metadata' ->> 'role'`, avoiding deprecated `auth.role()` patterns for new objects.

## Supabase Manual SQL Plan

The implementation must prepare SQL for manual Supabase Dashboard SQL Editor execution. No SQL should be auto-applied during this proposal session.

### Operation 1 - Create `billing_periods`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `building_id uuid not null references public.buildings(id) on delete restrict`
- `period_year integer not null check (period_year between 2000 and 2100)`
- `period_month integer not null check (period_month between 1 and 12)`
- `status text not null default 'draft' check (status in ('draft','readings','review','issued','collecting','closed'))`
- `opened_by uuid references auth.users(id)`
- `issued_at timestamptz`
- `closed_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- `unique (building_id, period_year, period_month)`
- index `(building_id, period_year desc, period_month desc)`
- index `(status)`

Data impact: additive only.

Verification:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'billing_periods'
order by ordinal_position;
```

Rollback:

```sql
drop table if exists public.billing_periods cascade;
```

### Operation 2 - Create `invoices`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `billing_period_id uuid not null references public.billing_periods(id) on delete cascade`
- `contract_id uuid not null references public.contracts(id) on delete restrict`
- `room_id uuid not null references public.rooms(id) on delete restrict`
- `tenant_id uuid not null references public.tenants(id) on delete restrict`
- `status text not null default 'draft' check (status in ('draft','issued','partial','paid','overdue','void'))`
- `due_date date`
- `issued_at timestamptz`
- `paid_at timestamptz`
- `voided_at timestamptz`
- `voided_by uuid references auth.users(id)`
- `void_reason text`
- `superseded_by_invoice_id uuid references public.invoices(id) on delete set null`
- `supersedes_invoice_id uuid references public.invoices(id) on delete set null`
- `subtotal_amount numeric(12,0) not null default 0`
- `discount_amount numeric(12,0) not null default 0`
- `surcharge_amount numeric(12,0) not null default 0`
- `total_amount numeric(12,0) not null default 0`
- `paid_amount numeric(12,0) not null default 0`
- `balance_amount numeric(12,0) not null default 0`
- `notes text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- partial unique index on `(billing_period_id, contract_id)` where `status <> 'void'`
- check amounts are non-negative except no check needed for line-level negative adjustment if handled in charges
- check `void_reason` is present when status is `void`
- index `(billing_period_id, status)`
- index `(contract_id)`
- index `(tenant_id)`
- index `(balance_amount)` where `balance_amount > 0`
- index `(supersedes_invoice_id)`

Data impact: additive only.

Verification:

```sql
select constraint_name, constraint_type
from information_schema.table_constraints
where table_schema = 'public'
  and table_name = 'invoices';
```

Rollback:

```sql
drop table if exists public.invoices cascade;
```

### Operation 3 - Create `invoice_charges`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `invoice_id uuid not null references public.invoices(id) on delete cascade`
- `charge_type text not null check (charge_type in ('rent','electricity','water','service','discount','surcharge','adjustment'))`
- `label text not null`
- `source_type text`
- `source_id uuid`
- `quantity numeric(12,3) not null default 1`
- `unit_price numeric(12,0) not null default 0`
- `amount numeric(12,0) not null default 0`
- `metadata jsonb not null default '{}'::jsonb`
- `sort_order integer not null default 0`
- `created_at timestamptz not null default now()`

Constraints/indexes:

- index `(invoice_id, sort_order)`
- check `quantity >= 0`

Data impact: additive only.

Verification:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'invoice_charges'
order by ordinal_position;
```

Rollback:

```sql
drop table if exists public.invoice_charges cascade;
```

### Operation 4 - Create `invoice_payments`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `invoice_id uuid not null references public.invoices(id) on delete cascade`
- `amount numeric(12,0) not null check (amount > 0)`
- `paid_at date not null`
- `payment_method text`
- `note text`
- `recorded_by uuid references auth.users(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- index `(invoice_id, paid_at desc)`

Data impact: additive only.

Verification:

```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'invoice_payments';
```

Rollback:

```sql
drop table if exists public.invoice_payments cascade;
```

### Operation 5 - Create `billing_utility_usages`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `billing_period_id uuid not null references public.billing_periods(id) on delete cascade`
- `room_id uuid not null references public.rooms(id) on delete restrict`
- `meter_type text not null check (meter_type in ('electricity','water'))`
- `previous_reading_id uuid references public.meter_readings(id) on delete set null`
- `previous_reading_value numeric(12,3) not null check (previous_reading_value >= 0)`
- `current_reading_id uuid references public.meter_readings(id) on delete set null`
- `current_reading_value numeric(12,3) not null check (current_reading_value >= 0)`
- `old_meter_final_value numeric(12,3) check (old_meter_final_value >= 0)`
- `new_meter_start_value numeric(12,3) check (new_meter_start_value >= 0)`
- `billable_usage numeric(12,3) not null check (billable_usage >= 0)`
- `reason text not null default 'normal' check (reason in ('normal','replacement','reset','correction','manual_adjustment'))`
- `note text`
- `created_by uuid references auth.users(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- `unique (billing_period_id, room_id, meter_type)`
- index `(room_id, meter_type)`
- index `(billing_period_id)`

Data impact: additive only.

Verification:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'billing_utility_usages'
order by ordinal_position;
```

Rollback:

```sql
drop table if exists public.billing_utility_usages cascade;
```

### Operation 6 - Create `billing_audit_events`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `billing_period_id uuid references public.billing_periods(id) on delete cascade`
- `actor_id uuid references auth.users(id)`
- `action text not null`
- `entity_type text not null check (entity_type in ('billing_period','meter_reading','billing_utility_usage','invoice','invoice_charge','invoice_payment'))`
- `entity_id uuid`
- `before_data jsonb`
- `after_data jsonb`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Constraints/indexes:

- index `(billing_period_id, created_at desc)`
- index `(entity_type, entity_id, created_at desc)`
- index `(actor_id, created_at desc)`
- check `action <> ''`

Data impact: additive only.

Verification:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'billing_audit_events'
order by ordinal_position;
```

Rollback:

```sql
drop table if exists public.billing_audit_events cascade;
```

### Operation 7 - Triggers and RLS

Triggers:

- add `public.set_updated_at()` trigger to `billing_periods`
- add `public.set_updated_at()` trigger to `invoices`
- add `public.set_updated_at()` trigger to `invoice_payments`
- add `public.set_updated_at()` trigger to `billing_utility_usages`

RLS:

- enable RLS on all six new tables
- admin: all operations on all six tables
- manager: select/insert/update on `billing_periods`, `invoices`, `invoice_charges`, `invoice_payments`, `billing_utility_usages`
- manager: select/insert on `billing_audit_events`; audit updates/deletes should not be part of normal application behavior
- close/reopen remains enforced in service layer through `billing.close`

Post-apply verification:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('billing_periods', 'invoices', 'invoice_charges', 'invoice_payments', 'billing_utility_usages', 'billing_audit_events');
```

## Risks

- A full flow is larger than just draft charge calculation. Implementation should be phased inside the task list.
- `tiered` electricity exists in building config but has no tier schema. Blocking issue for tiered buildings is safer than silently misbilling.
- Payment totals must be kept consistent. The implementation should update invoice `paid_amount`, `balance_amount`, and `status` transactionally when payments change.
- Closing a period without a reopen strategy can trap mistakes. If reopen is deferred, close confirmation must be explicit and visible.
- Audit events can grow quickly. The first version should index by period/entity/actor and avoid storing oversized payloads.
