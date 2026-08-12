## ADDED Requirements

### Requirement: Invoice profile snapshot refresh audit
Refreshing an invoice payment-profile snapshot SHALL atomically update the invoice and append `invoice.profile_snapshot.refreshed` with building scope, actor, invoice identifier, and safe before/after snapshot metadata.

#### Scenario: Authorized refresh succeeds
- **WHEN** an authorized scoped user refreshes an invoice payment-profile snapshot
- **THEN** the invoice update and audit event commit together without exposing private asset paths

#### Scenario: Refresh audit fails
- **WHEN** the audit event cannot be inserted
- **THEN** the invoice snapshot remains unchanged
