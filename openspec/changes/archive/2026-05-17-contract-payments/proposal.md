## Why

Tenants commonly pay deposit and prepaid rent before monthly invoices exist. These payments need to be recorded structurally — not as notes — so they are auditable and can be applied against future invoices in v0.3.

## What Changes

- New `contract_payments` table to record deposit, prepaid rent, and other contract-level payments
- New API: `POST /api/contracts/:id/payments`, `GET /api/contracts/:id/payments`
- Contract detail page shows payment history (deposit paid, prepaid rent periods covered)
- Validators, types, mapper, repository for contract payments

## Capabilities

### New Capabilities
- `contract-payments`: Record and retrieve contract-level payments (deposit, prepaid rent, rent, other) with amount, payment date, method, and optional period coverage

### Modified Capabilities
- `contracts-client`: Contract detail page gains a Payments section showing recorded payments
