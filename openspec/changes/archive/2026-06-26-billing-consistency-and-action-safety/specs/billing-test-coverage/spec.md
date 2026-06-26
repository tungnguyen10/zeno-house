## ADDED Requirements

### Requirement: Billing consistency regression coverage
The billing test suite SHALL cover shared billable-contract eligibility, required-reading progress, actor enrichment, and async confirmation behavior.

#### Scenario: Eligibility helper covered
- **WHEN** billing service tests run
- **THEN** they assert which contract statuses are included or excluded for a selected period

#### Scenario: Reading progress helper covered
- **WHEN** billing service tests run for meter-based, fixed, and per-person utility pricing
- **THEN** they assert required and complete reading counts match the shared helper behavior

#### Scenario: Confirmation behavior covered
- **WHEN** component tests simulate failed issue or close mutations
- **THEN** they assert modal and selection state are not cleared prematurely
