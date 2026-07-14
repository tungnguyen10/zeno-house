# api-performance Specification

## Purpose
TBD - created by archiving change harden-and-optimize-billing. Update Purpose after archive.
## Requirements
### Requirement: API request performance is observable
The system SHALL attach a request identifier and `Server-Timing` information to API responses and SHALL record route, method, status, duration, response size, and application database round-trip count for slow or failed requests.

#### Scenario: Slow read request
- **WHEN** an API GET request takes longer than 500 milliseconds
- **THEN** the server emits a structured slow-request diagnostic containing its request identifier and timing values

#### Scenario: Slow mutation request
- **WHEN** an API POST, PATCH, PUT, or DELETE request takes longer than 1000 milliseconds
- **THEN** the server emits a structured slow-request diagnostic containing its request identifier and timing values

### Requirement: Performance optimizations preserve authorization isolation
The system MUST resolve authoritative building scope before using cached or aggregated business data, and cached entries MUST be partitioned by the complete resolved scope and relevant data version.

#### Scenario: Managers have different scopes
- **WHEN** two managers request the same summary period with different assigned buildings
- **THEN** neither request can receive data or a cache entry produced for the other manager's scope

### Requirement: Large datasets remain complete
Summary and report APIs SHALL NOT silently truncate business results at implementation row limits.

#### Scenario: Dataset exceeds former limits
- **WHEN** room, billing-period, invoice, or audit data exceeds a former in-memory limit
- **THEN** aggregate totals remain correct and paginated collections expose a continuation cursor where applicable

