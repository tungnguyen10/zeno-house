## ADDED Requirements

### Requirement: Dashboard summaries use complete scoped aggregation
The dashboard summary API SHALL compute metrics for all records in the caller's authorized building scope without relying on fixed application row limits, and SHALL preserve the existing response envelope and DTO.

#### Scenario: Scoped summary exceeds application limits
- **WHEN** an authorized scope contains more than 2000 rooms or invoices
- **THEN** the returned totals and trends include every matching record

#### Scenario: Repeated scoped request
- **WHEN** the same resolved scope requests the same current-period summary within the cache window
- **THEN** the server may reuse the scope-keyed result without changing response data
