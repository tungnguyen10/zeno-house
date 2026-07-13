## ADDED Requirements

### Requirement: Billing export batches invoice relations
The billing period export SHALL load invoice charges and display dependencies in bounded batch queries rather than issuing a database query per invoice.

#### Scenario: Export many invoices
- **WHEN** a period export contains an increasing number of invoices
- **THEN** the number of application database round trips used to load charges remains constant
