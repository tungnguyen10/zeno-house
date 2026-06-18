## ADDED Requirements

### Requirement: Billing transaction failure-path coverage
The billing test suite SHALL cover success and failure paths for hardened invoice issue and bulk payment transactions.

#### Scenario: Issue rollback covered
- **WHEN** tests simulate a failure during invoice charge persistence
- **THEN** they assert no partial invoice, charge, period status, or success audit state remains

#### Scenario: Bulk payment rollback covered
- **WHEN** tests simulate a failure after at least one bulk payment row was attempted
- **THEN** they assert payment rows and invoice totals are rolled back and the failed index/reason is returned

#### Scenario: SQL artifacts covered
- **WHEN** transaction SQL functions are introduced
- **THEN** tests or static assertions verify the migration contains required function, verification, and rollback sections
