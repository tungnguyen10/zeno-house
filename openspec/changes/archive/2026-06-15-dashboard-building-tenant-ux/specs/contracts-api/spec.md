## ADDED Requirements

### Requirement: Contract API supports id or code lookup
`GET /api/contracts/:identifier` SHALL support UUID id lookup and stable contract-code lookup when contract codes are available.

#### Scenario: Lookup contract by id
- **WHEN** authenticated user calls GET /api/contracts/<uuid>
- **THEN** the API returns the matching contract

#### Scenario: Lookup contract by code
- **WHEN** authenticated user calls GET /api/contracts/hd-2026-0001
- **THEN** the API returns the matching contract

#### Scenario: Unknown contract code
- **WHEN** authenticated user calls GET /api/contracts/unknown-code
- **THEN** the API returns 404 NOT_FOUND
