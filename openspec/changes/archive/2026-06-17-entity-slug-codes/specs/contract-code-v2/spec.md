## ADDED Requirements

### Requirement: Contract code format includes building code
New contracts SHALL have `contract_code` in the format `hd-{buildingCode}-{year}-{seq}` where:
- `buildingCode` = the code of the building the contracted room belongs to (e.g., `zhpn`)
- `year` = 4-digit year of contract `start_date` (`YYYY`)
- `seq` = zero-padded 4-digit sequence scoped to `{buildingCode}-{year}` prefix (e.g., `0001`)

Example: `hd-zhpn-2026-0001`

#### Scenario: Contract code generated with building code
- **WHEN** a contract is created for room `zhpn-b201` with `start_date = 2026-09-01`
- **THEN** `contracts.contract_code` is `hd-zhpn-2026-0001` (or next available sequence for that building+year)

#### Scenario: Sequence is per-building per-year
- **WHEN** two contracts are created in the same year for different buildings `zhpn` and `hnt`
- **THEN** both can have sequence `0001` independently: `hd-zhpn-2026-0001` and `hd-hnt-2026-0001`

#### Scenario: Sequence increments within same building and year
- **WHEN** a second contract is created for building `zhpn` in 2026
- **THEN** `contracts.contract_code` is `hd-zhpn-2026-0002`

#### Scenario: Code uniqueness enforced at DB level
- **WHEN** two contracts would produce the same code
- **THEN** the database unique constraint on `contracts.contract_code` prevents duplicates

---

### Requirement: Existing contract codes migrated to new format
All existing `contract_code` values in format `hd-{year}-{seq}` SHALL be migrated to `hd-{buildingCode}-{year}-{seq}` via a one-time SQL migration. The migration SHALL resolve `buildingCode` by joining `contracts → rooms → buildings`.

#### Scenario: Existing code migrated
- **WHEN** the `update_contract_codes` migration is applied to a contract with code `hd-2026-0001` in building `zhpn`
- **THEN** `contracts.contract_code` becomes `hd-zhpn-2026-0001`

#### Scenario: Migration is atomic
- **WHEN** the migration encounters any error
- **THEN** the entire transaction is rolled back and no partial updates are persisted

---

### Requirement: Contract API resolves by code or UUID
`GET /api/contracts/:identifier` SHALL accept either a UUID or a `contract_code` value. When `identifier` is not a UUID, the server SHALL look up by `contract_code` column. Both old format (`hd-2026-0001`) and new format (`hd-zhpn-2026-0001`) SHALL resolve correctly after migration.

#### Scenario: Fetch contract by new-format code
- **WHEN** admin calls GET /api/contracts/hd-zhpn-2026-0001
- **THEN** returns the contract with that code

#### Scenario: Fetch contract by UUID still works
- **WHEN** admin calls GET /api/contracts/:uuid
- **THEN** returns the matching contract (backward compatibility)

#### Scenario: Unknown identifier returns 404
- **WHEN** identifier matches neither UUID nor contract_code
- **THEN** returns 404 NOT_FOUND
