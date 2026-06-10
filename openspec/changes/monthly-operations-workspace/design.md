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
  ├─ Readings
  │   └─ reuse bulk meter reading input for this building + period
  ├─ Review Charges
  │   ├─ one draft invoice per active contract
  │   ├─ line items by rent/utilities/services/discount/surcharge
  │   └─ blockers/warnings before issue
  ├─ Issue Invoices
  │   └─ persist invoice snapshots + charge lines
  ├─ Payments / Debt
  │   ├─ record invoice payments
  │   ├─ show paid/partial/unpaid/overdue
  │   └─ show outstanding debt by room/tenant
  └─ Close Period
      └─ lock changes after all review conditions pass
```

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

### D2 - Draft calculation is recomputable, issued invoice is a snapshot

Before issue, charges are calculated from live contract, service, occupant, building, and meter reading data. After issue, `invoices` and `invoice_charges` become the source of truth for what was charged.

This avoids stale drafts while preserving auditability after invoice issue.

### D3 - One invoice per contract per period

An invoice belongs to one `billing_period` and one `contract`. It also stores `room_id` and `tenant_id` as snapshot references for query speed and historical display.

Uniqueness: `(billing_period_id, contract_id)`.

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

Billing occupant count should be computed from `contract_occupants` rows active during the period and `billing_counted = true`. If no occupant rows exist, fallback to `contracts.occupant_count`.

### D5 - Missing or invalid inputs block issue

Issue must be blocked when:

- active contract lacks required billing references
- required utility pricing config is missing
- per-usage utility requires current or previous reading and either is missing
- current reading is lower than previous reading
- building electricity pricing is `tiered`
- invoice for the same contract and period already exists unless the operation is an idempotent re-issue of a draft

### D6 - Payments belong to invoices

Monthly collection records go to `invoice_payments`, not `contract_payments`.

`contract_payments` remains for deposit/prepaid/legacy contract-level records. Existing `rent` rows remain readable but must not be treated as invoice settlement source.

### D7 - Period close locks mutable monthly actions

When a period is `closed`:

- readings for the period should no longer be edited from the workspace
- invoice charges should not be regenerated
- invoice payments should not be added/edited through the normal flow
- reopening, if implemented, must be an explicit privileged action

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

- `unique (billing_period_id, contract_id)`
- check amounts are non-negative except no check needed for line-level negative adjustment if handled in charges
- index `(billing_period_id, status)`
- index `(contract_id)`
- index `(tenant_id)`
- index `(balance_amount)` where `balance_amount > 0`

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

### Operation 5 - Triggers and RLS

Triggers:

- add `public.set_updated_at()` trigger to `billing_periods`
- add `public.set_updated_at()` trigger to `invoices`
- add `public.set_updated_at()` trigger to `invoice_payments`

RLS:

- enable RLS on all four new tables
- admin: all operations on all four tables
- manager: select/insert/update on `billing_periods`, `invoices`, `invoice_charges`, `invoice_payments`, except close/reopen remains enforced in service layer through `billing.close`

Post-apply verification:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('billing_periods', 'invoices', 'invoice_charges', 'invoice_payments');
```

## Risks

- A full flow is larger than just draft charge calculation. Implementation should be phased inside the task list.
- `tiered` electricity exists in building config but has no tier schema. Blocking issue for tiered buildings is safer than silently misbilling.
- Payment totals must be kept consistent. The implementation should update invoice `paid_amount`, `balance_amount`, and `status` transactionally when payments change.
- Closing a period without a reopen strategy can trap mistakes. If reopen is deferred, close confirmation must be explicit and visible.
