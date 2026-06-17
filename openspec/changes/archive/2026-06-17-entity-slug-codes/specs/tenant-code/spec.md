## ADDED Requirements

### Requirement: tenants.code column exists and is globally unique
The `tenants` table SHALL include a `code` column. `code` SHALL follow the format `{nameInitials}-{year}-{seq}` where:
- `nameInitials` = first character of each hyphen-separated word in `slugify(full_name)`, lowercase (e.g., `"Nguyễn Văn A"` → slugify → `"nguyen-van-a"` → `"nva"`)
- `year` = 4-digit year of creation (`YYYY`)
- `seq` = zero-padded 4-digit global sequence within the same `{nameInitials}-{year}` prefix (e.g., `0001`)

`code` SHALL be set at tenant creation time and be globally unique. Existing tenants SHALL be backfilled by migration.

#### Scenario: Code generated at creation
- **WHEN** tenant `"Nguyễn Văn A"` is created in 2026
- **THEN** `tenants.code` is `nva-2026-0001` (or next available sequence)

#### Scenario: Same initials in same year get incremented sequence
- **WHEN** a second tenant with the same name initials `nva` is created in 2026
- **THEN** `tenants.code` is `nva-2026-0002`

#### Scenario: Same initials in different year restart sequence
- **WHEN** tenant with initials `nva` is created in 2027
- **THEN** `tenants.code` is `nva-2027-0001`

#### Scenario: Code uniqueness enforced at DB level
- **WHEN** two tenants would produce the same code (race condition)
- **THEN** the database unique index on `tenants.code` prevents duplicates

#### Scenario: Existing tenants backfilled
- **WHEN** the `add_tenant_codes` migration is applied
- **THEN** every existing tenant row has a non-empty `code` in the correct format

---

### Requirement: tenants.code is immutable after creation
`tenants.code` SHALL NOT be updatable via any API endpoint after the tenant is created. Attempts to set `code` via PATCH SHALL be silently ignored or rejected.

#### Scenario: Code not changed by tenant update
- **WHEN** admin PATCHes tenant with a different `code` value
- **THEN** `tenants.code` remains unchanged

---

### Requirement: Tenant API resolves by code or UUID
`GET /api/tenants/:identifier` SHALL accept either a UUID or a `tenants.code` value. When `identifier` is not a UUID, the server SHALL look up by `code` column.

#### Scenario: Fetch tenant by code
- **WHEN** admin calls GET /api/tenants/nva-2026-0001
- **THEN** returns the tenant with code `nva-2026-0001`

#### Scenario: Fetch tenant by UUID still works
- **WHEN** admin calls GET /api/tenants/:uuid
- **THEN** returns the matching tenant (backward compatibility)

#### Scenario: Unknown identifier returns 404
- **WHEN** identifier matches neither UUID nor code
- **THEN** returns 404 NOT_FOUND

---

### Requirement: Tenant DTO includes code
Tenant DTOs returned by the API SHALL include `code: string`.

#### Scenario: Tenant list includes code
- **WHEN** admin calls GET /api/tenants
- **THEN** each tenant object includes a non-empty `code` field

#### Scenario: Tenant detail includes code
- **WHEN** admin calls GET /api/tenants/:identifier
- **THEN** tenant object includes a non-empty `code` field
