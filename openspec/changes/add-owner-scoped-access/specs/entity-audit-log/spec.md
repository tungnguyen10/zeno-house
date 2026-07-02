## ADDED Requirements

### Requirement: Audit access is scoped for owner and manager
Audit log APIs SHALL allow admin global queries. Owner and manager SHALL be restricted to building-scoped audit queries and SHALL pass building scope checks.

#### Scenario: Admin queries global audit
- **WHEN** admin calls audit API without `building_id`
- **THEN** response includes global audit events according to filters

#### Scenario: Owner must provide building_id
- **WHEN** owner calls audit API without `building_id`
- **THEN** response is 422 Validation Error

#### Scenario: Owner queries scoped building audit
- **WHEN** owner calls audit API with `building_id` in owner scope
- **THEN** response includes audit events for that building

#### Scenario: Owner cannot query unscoped building audit
- **WHEN** owner calls audit API with `building_id` outside owner scope
- **THEN** response is 404 Not Found or 403 Forbidden according to read/mutation semantics

---

### Requirement: Audit authorization uses app_metadata role
Audit authorization SHALL use `user.app_metadata.role` or shared role helpers and SHALL NOT use top-level `user.role`.

#### Scenario: Top-level role mismatch
- **WHEN** request user has top-level `role = 'admin'` but `app_metadata.role = 'owner'`
- **THEN** audit access is evaluated as owner scoped access
