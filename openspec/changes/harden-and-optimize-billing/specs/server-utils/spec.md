## ADDED Requirements

### Requirement: API client and server diagnostics are consistent
The application SHALL use shared defaults for request IDs, timeout handling, error normalization, deduplication, and cancellation while preserving Nuxt SSR hydration for initial reads.

#### Scenario: Initial server-rendered read
- **WHEN** a page loads business data during SSR
- **THEN** the client uses Nuxt async-data hydration and does not repeat the same initial request during hydration

#### Scenario: Superseded search request
- **WHEN** a newer debounced filter request supersedes an in-flight request
- **THEN** the older request is cancelled or ignored and cannot overwrite the newer result
