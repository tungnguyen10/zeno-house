## ADDED Requirements

### Requirement: invoices table
`invoices` SHALL have: `id` (uuid PK), `room_id` (uuid FK → rooms RESTRICT NOT NULL), `contract_id` (uuid FK → contracts RESTRICT nullable), `period_start` (date NOT NULL), `period_end` (date NOT NULL), `status` (enum: `draft`|`issued`|`partial`|`paid`|`overdue`|`cancelled` DEFAULT `draft`), `total_amount` (NUMERIC(12,2) NOT NULL), `notes` (text nullable), `due_date` (date nullable), `created_at`, `updated_at`. Index on `(room_id, period_start, period_end)`. RLS: admin all, manager select.

### Requirement: invoice_items table
`invoice_items` SHALL have: `id` (uuid PK), `invoice_id` (uuid FK → invoices CASCADE NOT NULL), `item_type` (enum: `rent`|`electricity`|`water`|`service_fee`|`other`), `description` (text NOT NULL), `unit_price` (NUMERIC(12,2) NOT NULL), `quantity` (NUMERIC(10,3) NOT NULL DEFAULT 1), `amount` (NUMERIC(12,2) NOT NULL — computed: unit_price * quantity), `created_at`. RLS: admin all, manager select.

#### Scenario: Tables created with correct schema
- **WHEN** migration runs
- **THEN** `invoices` and `invoice_items` exist with correct columns, FK constraints, status enum, and RLS
