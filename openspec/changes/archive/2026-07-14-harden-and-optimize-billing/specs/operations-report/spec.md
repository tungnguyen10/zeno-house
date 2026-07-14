## ADDED Requirements

### Requirement: Operations reports use a consistent aggregate snapshot
The operations report API SHALL derive billing, expense, prepaid, closure, and reserve values from one consistent period snapshot and SHALL preserve current report formulas and DTOs.

#### Scenario: Load an open report
- **WHEN** an authorized user requests an open period report
- **THEN** the report uses a short-lived scope-safe cache and reflects invalidation after relevant mutations

#### Scenario: Load a closed report
- **WHEN** an authorized user requests a closed period report whose version has not changed
- **THEN** the server may reuse the versioned cached snapshot without recomputing it
