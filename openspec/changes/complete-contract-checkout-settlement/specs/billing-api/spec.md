## ADDED Requirements

### Requirement: Checkout final charges
Billing SHALL show each eligible contract per room and SHALL calculate only unbilled metered utilities and incidental charges for a checkout contract. Final charge persistence SHALL retain the one-effective-invoice-per-contract-period rule.

#### Scenario: Existing paid invoice
- **WHEN** a returned contract already has a paid invoice and unbilled final consumption
- **THEN** confirmation appends typed audited charges and preserves payments, rather than creating a duplicate invoice or recalculating rent
