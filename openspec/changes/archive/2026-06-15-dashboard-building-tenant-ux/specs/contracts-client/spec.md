## ADDED Requirements

### Requirement: Contract links prefer stable codes
Contract UI links SHALL prefer stable contract codes or slugs when available, while preserving UUID contract detail links.

#### Scenario: Contract link uses code
- **WHEN** a contract has code `hd-2026-0001`
- **THEN** the preferred detail link is `/contracts/hd-2026-0001`

#### Scenario: Contract link falls back to id
- **WHEN** a contract has no stable code
- **THEN** the UI links to `/contracts/<id>`

### Requirement: Contract URLs do not derive from tenant names
Contract routes SHALL NOT use tenant-name-derived slugs.

#### Scenario: Contract with tenant name
- **WHEN** UI renders a contract for tenant Nguyen Van A
- **THEN** the contract URL does not include a slug derived from `Nguyen Van A`
