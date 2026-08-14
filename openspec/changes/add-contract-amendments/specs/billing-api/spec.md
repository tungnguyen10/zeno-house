## ADDED Requirements

### Requirement: Billing draft uses due amendments
Before loading mutable contract terms for draft preparation, billing SHALL invoke the idempotent due-amendment application operation for the target building and period date. Existing non-void invoices SHALL remain immutable.

#### Scenario: Amendment is due before draft calculation
- **WHEN** billing prepares a draft for a contract with a due scheduled amendment
- **THEN** the amendment is applied first and the draft uses the new effective terms

#### Scenario: Invoice already issued
- **WHEN** an amendment operation runs after an invoice snapshot has been issued
- **THEN** the existing invoice and charge rows remain unchanged
