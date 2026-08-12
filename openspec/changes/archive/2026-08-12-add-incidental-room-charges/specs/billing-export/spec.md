## ADDED Requirements

### Requirement: Billing exports include incidental charges
Period exports and operations reporting SHALL include `incidental` invoice charge totals in the existing other/service charge grouping while preserving contract surcharge reporting.

#### Scenario: Export contains incidental value
- **WHEN** an issued invoice has service, recurring surcharge, and incidental lines
- **THEN** the other/service export amount includes all three and the invoice total matches persisted charges

#### Scenario: Printed invoice preserves labels
- **WHEN** an invoice contains multiple incidental charges
- **THEN** each charge appears as its own labelled line on the invoice document
