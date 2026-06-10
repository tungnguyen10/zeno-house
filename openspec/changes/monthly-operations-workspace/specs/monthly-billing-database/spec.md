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
- **THEN** `invoices` includes billing_period_id, contract_id, room_id, tenant_id, status, due_date, issued_at, paid_at, amount totals, notes, created_at, and updated_at fields

#### Scenario: One invoice per contract per period
- **WHEN** an invoice already exists for a contract in a billing period
- **THEN** the database rejects another invoice for the same billing_period_id and contract_id

#### Scenario: Outstanding debt query is indexed
- **WHEN** invoices have positive balance amounts
- **THEN** the database has an index that supports querying outstanding balances

### Requirement: Invoice charges table
The database SHALL store invoice line items in `public.invoice_charges`.

#### Scenario: Invoice charge schema exists
- **WHEN** the billing SQL is applied manually in Supabase Dashboard SQL Editor
- **THEN** `invoice_charges` includes invoice_id, charge_type, label, source_type, source_id, quantity, unit_price, amount, metadata, sort_order, and created_at fields

#### Scenario: Charges cascade with invoice
- **WHEN** an invoice is deleted during rollback or void handling
- **THEN** its invoice charges are removed by foreign key cascade

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

### Requirement: Manual Supabase SQL execution
The implementation SHALL document all billing database operations for manual Supabase Dashboard SQL Editor execution.

#### Scenario: SQL script is prepared
- **WHEN** implementation adds the billing schema
- **THEN** the SQL script lists tables, columns, constraints, indexes, triggers, RLS policies, verification queries, and rollback notes

#### Scenario: No destructive operation
- **WHEN** this billing schema is applied
- **THEN** it only adds new objects and does not drop existing tables or columns

