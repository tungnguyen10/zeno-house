# operational-url-identifiers Specification

## Purpose
TBD - created by archiving change dashboard-building-tenant-ux. Update Purpose after archive.
## Requirements
### Requirement: Operational URLs use stable readable identifiers
User-facing operational routes SHALL prefer stable persisted slugs or business codes over raw UUIDs when the entity has a safe non-PII identifier. Existing UUID routes SHALL remain supported during migration.

#### Scenario: Readable identifier preferred
- **WHEN** UI renders a link for an entity with a safe slug or business code
- **THEN** the generated URL uses that slug or code instead of the raw UUID

#### Scenario: UUID fallback supported
- **WHEN** a user opens an existing UUID-based URL
- **THEN** the application resolves the record and renders the same destination

### Requirement: Person records avoid name-derived slugs
Routes for sensitive person records such as tenants SHALL NOT use slugs derived from personal names. They SHALL remain UUID-based or use a non-PII tenant code if such a code is introduced later.

#### Scenario: Tenant route does not expose name
- **WHEN** UI renders a tenant link
- **THEN** the URL does not include the tenant full name or a slug derived from it

### Requirement: Scoped child entities use parent context
Child entities whose natural identifiers are only unique within a parent, such as room numbers within a building, SHALL use parent-scoped routes instead of global slugs.

#### Scenario: Room route scoped by building
- **WHEN** UI renders a room link and building slug is available
- **THEN** the URL includes the building slug and room slug context

### Requirement: Business documents use document codes
Business documents such as contracts and invoices SHALL prefer stable document codes for user-facing URLs when those codes exist. They SHALL NOT derive URLs from tenant names.

#### Scenario: Contract route uses code
- **WHEN** UI renders a contract link with a stable contract code
- **THEN** the URL uses the contract code instead of a tenant-name slug

#### Scenario: Invoice route uses code
- **WHEN** UI renders an invoice link with a stable invoice code
- **THEN** the URL uses the invoice code instead of a tenant-name slug

