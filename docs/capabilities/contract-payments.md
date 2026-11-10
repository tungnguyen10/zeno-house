---
type: Capability Specification
title: "contract-payments"
status: stable
tags: [capability, requirements]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/specs/contract-payments/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

## Purpose

Recording and managing contract-level payments (deposit, prepaid rent, rent, other). Payments are nested under a contract and support period coverage for prepaid rent scenarios.
## Requirements
### Requirement: Contract payment recording
The system SHALL allow recording payments against a contract. A payment SHALL include: type (`deposit` | `prepaid_rent` | `rent` | `other`), amount (positive number), paid_at date, optional payment_method, optional note, and optional period coverage (`covered_period_start`, `covered_period_end` in YYYY-MM format) for prepaid rent. Contract-level payments are intended for pre-invoice financial events: `deposit` and `prepaid_rent` are the primary supported types. `rent` and `other` remain for backward compatibility until invoice settlement exists, but they SHALL NOT be treated as the source of truth for monthly invoice settlement. After monthly invoices are introduced, monthly rent/utility/service collection SHALL be recorded through invoice-level payments.

#### Scenario: Deposit recorded
- **WHEN** admin records a deposit payment
- **THEN** payment persisted with type `deposit`, amount, and paid_at date

#### Scenario: Prepaid rent recorded with period coverage
- **WHEN** admin records prepaid rent covering multiple months
- **THEN** payment persisted with type `prepaid_rent`, amount, covered_period_start, covered_period_end

#### Scenario: Payment list retrievable
- **WHEN** admin views a contract
- **THEN** all payments returned in reverse-chronological order (newest first)

#### Scenario: Invalid payment type rejected
- **WHEN** payment submitted with type outside (deposit, prepaid_rent, rent, other)
- **THEN** request rejected with VALIDATION_ERROR

#### Scenario: Non-positive amount rejected
- **WHEN** payment submitted with amount <= 0
- **THEN** request rejected with VALIDATION_ERROR

#### Scenario: Monthly settlement boundary is explicit
- **WHEN** a developer implements monthly invoice collection
- **THEN** the implementation uses invoice-level payment allocation instead of relying on contract-level `rent` payments as the financial source of truth

#### Scenario: Legacy rent payment remains readable
- **WHEN** a contract has an existing payment with type `rent`
- **THEN** it remains retrievable in the contract payment list for compatibility

#### Scenario: Invoice payment is separate
- **WHEN** a user records payment for an issued monthly invoice
- **THEN** the payment is recorded against the invoice, not as a new contract-level `rent` payment

### Requirement: Held funds and protected allocations
Held deposits SHALL derive only from `contracts.deposit` less allocations and refunds; every contract is treated as holding its deposit from creation, and `deposit` payment receipts SHALL NOT create or change held deposit. Explicitly approved other source funds SHALL remain distinguishable. Allocated sources SHALL NOT be edited or deleted directly, and the contract deposit SHALL NOT change after allocation or settlement.

#### Scenario: Prepaid rent is not deposit
- **WHEN** a contract has both a deposit amount and prepaid-rent receipts
- **THEN** the displayed held deposit equals the contract deposit less allocations and refunds, and prepaid funds require explicit source approval before settlement use
