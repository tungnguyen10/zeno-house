## ADDED Requirements

### Requirement: Billing periods table
The database SHALL store monthly billing period state in `public.billing_periods`.

#### Scenario: Billing period schema exists
- **WHEN** the billing SQL is applied manually in Supabase Dashboard SQL Editor
- **THEN** `billing_periods` includes building reference, year, month, status, opened_by, issued_at, closed_at, created_at, and updated_at fields

#### Scenario: Building month uniqueness
- **WHEN** two billing periods target the same building, year, and month
- **THEN** the database rejects the duplicate row

#### Scenario: Billing period RLS enabled
- **WHEN** the table is created
- **THEN** RLS is enabled and role-based admin/manager policies are present

### Requirement: Invoices table
The database SHALL store issued invoice snapshots in `public.invoices`.

#### Scenario: Invoice schema exists
- **WHEN** the billing SQL is applied manually in Supabase Dashboard SQL Editor
- **THEN** `invoices` includes billing_period_id, contract_id, room_id, tenant_id, status, due_date, issued_at, paid_at, voided_at, voided_by, void_reason, superseded_by_invoice_id, supersedes_invoice_id, amount totals, notes, created_at, and updated_at fields

#### Scenario: One active invoice per contract per period
- **WHEN** a non-void invoice already exists for a contract in a billing period
- **THEN** the database rejects another non-void invoice for the same billing_period_id and contract_id

#### Scenario: Voided invoice can be replaced
- **WHEN** an invoice has status `void`
- **THEN** the database allows a replacement non-void invoice for the same billing_period_id and contract_id

#### Scenario: Outstanding debt query is indexed
- **WHEN** invoices have positive balance amounts
- **THEN** the database has an index that supports querying outstanding balances

#### Scenario: Voided invoice has reason
- **WHEN** an invoice status is changed to `void`
- **THEN** the invoice stores voided_at, voided_by, and void_reason

#### Scenario: Reissue relation stored
- **WHEN** an invoice is reissued after being voided
- **THEN** the old and replacement invoices can be linked through superseded/supersedes references

### Requirement: Invoice charges table
The database SHALL store invoice line items in `public.invoice_charges`.

#### Scenario: Invoice charge schema exists
- **WHEN** the billing SQL is applied manually in Supabase Dashboard SQL Editor
- **THEN** `invoice_charges` includes invoice_id, charge_type, label, source_type, source_id, quantity, unit_price, amount, metadata, sort_order, and created_at fields

#### Scenario: Charges cascade with invoice
- **WHEN** an invoice is deleted during rollback or void handling
- **THEN** its invoice charges are removed by foreign key cascade

#### Scenario: Charge calculation metadata stored
- **WHEN** an invoice charge is issued
- **THEN** the charge row stores enough metadata to reconstruct the calculation inputs used at issue time

#### Scenario: Adjustment charge references original issue
- **WHEN** an adjustment charge is created to correct a paid or closed-period invoice
- **THEN** its metadata references the original invoice, original period, correction reason, and actor context

### Requirement: Invoice payments table
The database SHALL store monthly collection entries in `public.invoice_payments`.

#### Scenario: Invoice payment schema exists
- **WHEN** the billing SQL is applied manually in Supabase Dashboard SQL Editor
- **THEN** `invoice_payments` includes invoice_id, amount, paid_at, payment_method, note, recorded_by, created_at, and updated_at fields

#### Scenario: Non-positive payment rejected
- **WHEN** a payment amount is zero or negative
- **THEN** the database rejects the row

#### Scenario: Payments cascade with invoice
- **WHEN** an invoice is deleted during rollback or void handling
- **THEN** its invoice payments are removed by foreign key cascade

### Requirement: Billing utility usages table
The database SHALL store period-scoped utility usage snapshots and overrides in `public.billing_utility_usages`.

#### Scenario: Utility usage schema exists
- **WHEN** the billing SQL is applied manually in Supabase Dashboard SQL Editor
- **THEN** `billing_utility_usages` includes billing_period_id, room_id, meter_type, previous/current reading ids and values, old_meter_final_value, new_meter_start_value, billable_usage, reason, note, created_by, created_at, and updated_at fields

#### Scenario: One usage row per room meter period
- **WHEN** two utility usage rows target the same billing period, room, and meter type
- **THEN** the database rejects the duplicate row

#### Scenario: Replacement usage is persisted
- **WHEN** a meter is replaced or reset during a period
- **THEN** the table can store old meter final value, new meter start value, current reading value, and billable usage for that period

#### Scenario: Utility usage RLS enabled
- **WHEN** the table is created
- **THEN** RLS is enabled and role-based admin/manager policies are present

### Requirement: Billing audit events table
The database SHALL store immutable billing operational history in `public.billing_audit_events`.

#### Scenario: Billing audit schema exists
- **WHEN** the billing SQL is applied manually in Supabase Dashboard SQL Editor
- **THEN** `billing_audit_events` includes billing_period_id, actor_id, action, entity_type, entity_id, before_data, after_data, metadata, and created_at fields

#### Scenario: Audit lookup indexed by period
- **WHEN** audit events are queried for a billing period
- **THEN** the database has an index that supports lookup by billing_period_id and created_at

#### Scenario: Audit lookup indexed by entity
- **WHEN** audit events are queried for a specific invoice, payment, reading, or period
- **THEN** the database has an index that supports lookup by entity_type, entity_id, and created_at

#### Scenario: Audit RLS enabled
- **WHEN** the audit table is created
- **THEN** RLS is enabled and role-based admin/manager policies are present

### Requirement: Manual Supabase SQL execution
The implementation SHALL document all billing database operations for manual Supabase Dashboard SQL Editor execution.

#### Scenario: SQL script is prepared
- **WHEN** implementation adds the billing schema
- **THEN** the SQL script lists tables, columns, constraints, indexes, triggers, RLS policies, verification queries, and rollback notes

#### Scenario: No destructive operation
- **WHEN** this billing schema is applied
- **THEN** it only adds new objects and does not drop existing tables or columns
