## ADDED Requirements

### Requirement: Prepaid contribution to report totals
The system SHALL include active prepaid monthly allocation in operations report totals and expose it as a distinct breakdown.

#### Scenario: Total expense includes prepaid
- **WHEN** the operations report is generated for a month with an active prepaid window
- **THEN** the report's total expense and profit figures include the prepaid monthly allocation alongside fixed costs and one-off expenses

#### Scenario: Prepaid breakdown returned
- **WHEN** the report DTO is produced
- **THEN** it includes a prepaid section listing contributing prepaid items and their monthly amounts

#### Scenario: Export includes prepaid
- **WHEN** the operations report is exported to Excel for a month with active prepaid allocation
- **THEN** the workbook includes the prepaid section consistent with the on-screen report
