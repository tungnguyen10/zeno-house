---
type: Capability Specification
title: "operational-url-identifiers"
status: stable
tags: [capability, requirements]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/specs/operational-url-identifiers/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

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
Routes for sensitive person records such as tenants SHALL NOT use slugs derived from personal names. They SHALL use `tenant.code` (format `{nameInitials}-{year}-{seq}`) as the URL identifier. The code is non-PII: it is not reconstructable to full name from initials alone.

#### Scenario: Tenant route uses code, not name slug
- **WHEN** UI renders a tenant link for tenant with code `nva-2026-0001`
- **THEN** the URL is `/tenants/nva-2026-0001` and does not include the tenant full name

#### Scenario: Tenant route does not expose name
- **WHEN** UI renders a tenant link for tenant `"Nguyễn Văn A"`
- **THEN** the URL does not include `nguyen-van-a` or any slug derived from the full name

### Requirement: Scoped child entities use parent context
Room routes SHALL use `room.code` (globally unique, format `{buildingCode}-{roomSlug}`) as the canonical URL identifier. The parent-context route `/buildings/:buildingSlug/rooms/:roomSlug` SHALL remain available as a navigation entry point but SHALL redirect to the canonical `/rooms/:roomCode` URL.

#### Scenario: Canonical room route uses room code
- **WHEN** UI renders a room link for room with code `zhpn-b201`
- **THEN** the canonical URL is `/rooms/zhpn-b201`

#### Scenario: Building-scoped room path redirects to canonical
- **WHEN** user navigates to `/buildings/zeno-house-phu-nhuan/rooms/b201`
- **THEN** the application resolves the room and redirects to `/rooms/zhpn-b201`

### Requirement: Business documents use document codes
Business documents such as contracts and invoices SHALL prefer stable document codes for user-facing URLs when those codes exist. They SHALL NOT derive URLs from tenant names.

#### Scenario: Contract route uses new-format code
- **WHEN** UI renders a contract link with code `hd-zhpn-2026-0001`
- **THEN** the URL is `/contracts/hd-zhpn-2026-0001`

#### Scenario: Invoice route uses code
- **WHEN** UI renders an invoice link with a stable invoice code
- **THEN** the URL uses the invoice code instead of a tenant-name slug

---

### Requirement: UUID-based URLs resolve via redirect
Legacy UUID-based URLs for rooms, tenants, and contracts SHALL remain resolvable. When a UUID identifier is detected, the server or page SHALL resolve the record and redirect to its canonical code-based URL.

#### Scenario: Legacy room UUID URL redirects
- **WHEN** user navigates to `/rooms/30000000-0000-4000-8000-000000000201`
- **THEN** the application resolves the room and redirects to `/rooms/zhpn-b201`

#### Scenario: Legacy tenant UUID URL redirects
- **WHEN** user navigates to `/tenants/40000000-0000-4000-8000-000000000002`
- **THEN** the application resolves the tenant and redirects to `/tenants/nva-2026-0001`

#### Scenario: Legacy contract UUID URL redirects
- **WHEN** user navigates to `/contracts/uuid`
- **THEN** the application resolves the contract and redirects to `/contracts/hd-zhpn-2026-0001`
