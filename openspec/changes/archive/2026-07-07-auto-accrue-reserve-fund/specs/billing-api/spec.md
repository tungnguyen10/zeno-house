## ADDED Requirements

### Requirement: Close period creates reserve accrual
The billing close flow SHALL create or refresh the building's monthly reserve accrual from issued revenue and the effective reserve rate.

#### Scenario: Close creates monthly reserve accrual
- **WHEN** an authorized user closes a billing period for a building with an effective reserve rate
- **THEN** the system records a reserve fund monthly accrual transaction for that building, year, and month

#### Scenario: Accrual uses issued revenue
- **WHEN** the monthly accrual is recorded during billing close
- **THEN** the accrual amount is calculated from non-void issued invoice totals and the effective reserve rate, not from collected cash

#### Scenario: Close without rate records zero accrual
- **WHEN** an authorized user closes a billing period for a building without an effective reserve rate
- **THEN** the system records or preserves a zero-rate monthly accrual for that building/month

#### Scenario: Reclose refreshes accrual
- **WHEN** a closed period is reopened and closed again after billing data changes
- **THEN** the system refreshes the existing reserve accrual transaction for that building/month instead of creating a duplicate
