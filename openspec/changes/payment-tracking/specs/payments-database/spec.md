## ADDED Requirements

### Requirement: payments table
`payments` SHALL have: `id` (uuid PK), `invoice_id` (uuid FK → invoices RESTRICT NOT NULL), `amount` (NUMERIC(12,2) NOT NULL CHECK > 0), `payment_method` (enum: `cash`|`bank_transfer`|`other`), `payment_date` (date NOT NULL), `notes` (text nullable), `created_at`. No `updated_at` — payments are immutable. RLS: admin all, manager select.

#### Scenario: Table created with correct schema
- **WHEN** migration runs
- **THEN** `payments` exists with FK to invoices and method enum
