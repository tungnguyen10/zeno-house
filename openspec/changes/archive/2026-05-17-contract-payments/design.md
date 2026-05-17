## Context

v0.2 contracts store `deposit` as a numeric field on the contract record — it represents the agreed deposit amount, not whether it was actually paid. Similarly, some tenants prepay rent months in advance before any invoice system exists. These payments have no structured home in the current schema, forcing landlords to track them in notes or externally.

## Goals / Non-Goals

**Goals:**
- Add a `contract_payments` table to record all contract-level payments structurally
- Support payment types: `deposit`, `prepaid_rent`, `rent`, `other`
- Support period coverage fields (`covered_period_start`, `covered_period_end`) for prepaid rent
- Expose API endpoints: list and create payments for a contract
- Show payment history on contract detail page

**Non-Goals:**
- Monthly invoice generation, billing runs, or payment reconciliation (v0.3)
- Payment editing or deletion (append-only at this stage)
- Integration with external payment gateways

## Decisions

### 1. Append-only payment log

**Decision**: `contract_payments` is an append-only ledger. No update or delete endpoints in this phase.

**Rationale**: Payment records are financial history. Immutability reduces audit risk and simplifies the data model. Corrections can be handled with a reversal entry in v0.3 if needed.

**Alternative considered**: Allow editing. Rejected — financial data should not be mutable without explicit audit trail.

### 2. Store period coverage as YYYY-MM strings

**Decision**: `covered_period_start` and `covered_period_end` are stored as `varchar(7)` (e.g., `'2026-05'`), not full dates.

**Rationale**: Billing periods are month-scoped. Using `YYYY-MM` avoids timezone/day ambiguity and directly matches the billing workspace model in v0.3.

**Alternative considered**: Use `date` columns. Rejected — day precision is meaningless for monthly period coverage.

### 3. Keep deposit amount on contract, add payment record separately

**Decision**: `contracts.deposit_amount` remains as the agreed deposit. A `contract_payments` record with `type = deposit` records the actual payment event.

**Rationale**: The agreed amount and the paid amount are separate concerns. A tenant might underpay deposit, or pay in installments.

### 4. method field is free text for MVP

**Decision**: `payment_method` is a nullable varchar, not an enum.

**Rationale**: Real payment methods vary widely (cash, bank transfer, Momo, Zalo Pay, etc.). Enforcing an enum now would require migration later. Free text is sufficient for record-keeping at this stage.

## Risks / Trade-offs

- No deletion means test/bad data cannot be cleaned easily in production → acceptable for now; can add soft-delete in v0.3
- Period coverage is advisory only (not validated against billing runs) → accepted at v0.2.5; v0.3 will enforce consistency
- contract_payments.tenant_id duplicates contract.tenant_id for most records → kept for flexibility (future: room-sharing payment splits)
