# Tenant Portal API Specification

## Purpose

Define the authenticated, self-scoped API contract for tenant profile access, active contract summaries, and invoice list/detail reads.
## Requirements
### Requirement: Tenant profile updates are audited
The tenant profile update service SHALL append `tenant.profile_updated` with whitelisted before/after snapshots and the resolved tenant ID.

#### Scenario: Self-service profile audit
- **WHEN** a tenant successfully updates an allowed profile field
- **THEN** one audit event identifies the tenant actor and target tenant
- **AND** client-injected tenant IDs, sessions, and credentials are absent from the payload

### Requirement: Tenant self-service API namespace
The system SHALL expose tenant self-service endpoints under `/api/tenant/**`, available only to the `tenant` role. Every endpoint SHALL resolve the caller's tenant via `resolveTenantId(event, user)` and SHALL ignore any client-supplied tenant identifier in body, query, or path. Responses SHALL use the standard `{ data, meta? }` / `{ error }` envelope.

#### Scenario: Only tenant role may call tenant API
- **WHEN** a non-`tenant` role calls any `/api/tenant/**` endpoint
- **THEN** the request is rejected by the namespace guard

#### Scenario: Client-supplied tenant id ignored
- **WHEN** a tenant request includes a `tenant_id` value in its input
- **THEN** the server uses the resolver's tenant id and ignores the supplied value

### Requirement: Tenant profile read and whitelist update
`GET /api/tenant/me` SHALL return the caller's tenant profile with safe fields only. `PATCH /api/tenant/me` SHALL update only a strict non-credential profile whitelist (`full_name`, `phone`, `gender`, `date_of_birth`, `occupation`, `permanent_address`, `emergency_contact_name`, `emergency_contact_phone`, `notes`, `id_number`, `id_issued_date`, and `id_issued_place`) and SHALL reject or ignore any other field, including login `email`, `status`, `code`, and linkage fields. Supabase Auth login email and the contact email in `tenants.email` are independent.

#### Scenario: Read own profile
- **WHEN** a tenant calls `GET /api/tenant/me`
- **THEN** the response contains the caller's profile safe fields

#### Scenario: Update allowed contact fields
- **WHEN** a tenant PATCHes `phone`
- **THEN** the update succeeds and returns the updated profile

#### Scenario: Update unique identity details
- **WHEN** a tenant PATCHes a CCCD/CMND number not assigned to another tenant
- **THEN** the normalized identity fields are persisted and returned

#### Scenario: Duplicate identity number
- **WHEN** a tenant PATCHes a CCCD/CMND number assigned to another tenant
- **THEN** the server returns a conflict with a field error for `id_number`

#### Scenario: Login email is not a profile mutation
- **WHEN** a tenant PATCH includes `email`
- **THEN** it is not persisted as a profile edit

#### Scenario: Non-whitelisted field rejected
- **WHEN** a tenant PATCH includes `status` or a linkage field
- **THEN** that field is rejected/ignored and never persisted

### Requirement: Tenant password change is verified and audited
`POST /api/tenant/password` SHALL verify the caller's current password through Supabase Auth before setting a valid new password, SHALL keep the successful current session active, and SHALL append `tenant.account.password_changed` without including any credential values.

#### Scenario: Current password is correct
- **WHEN** a tenant submits the correct current password and matching valid new passwords
- **THEN** Supabase Auth updates the password, the current session remains active, and one credential-free audit event is appended

#### Scenario: Current password is incorrect
- **WHEN** Supabase Auth rejects `current_password`
- **THEN** the endpoint returns a safe field validation error and does not append a password-change audit event

### Requirement: Tenant active contract summary
`GET /api/tenant/contract` SHALL return the active housing contract summary (room number, building name, start/end dates, monthly rent, deposit, status, `assignmentRole`, and `primaryTenantName`). The server SHALL prefer the caller's current primary contract and otherwise use only a current active roommate occupancy. Terminated, expired, future move-in, and moved-out contexts SHALL be excluded.

#### Scenario: Active contract returned
- **WHEN** a tenant with an active contract calls the endpoint
- **THEN** the active contract summary is returned with `assignmentRole = primary`

#### Scenario: Active roommate contract returned
- **WHEN** an active roommate calls the endpoint
- **THEN** the shared contract is returned with `assignmentRole = roommate` and the primary tenant name

#### Scenario: No active contract
- **WHEN** the tenant has no active contract
- **THEN** the endpoint returns an empty/absent result, not another tenant's data

### Requirement: Tenant invoice list and detail
Tenant invoice list and detail endpoints SHALL preserve existing tenant and roommate scope rules and SHALL return immutable `dueDate`, `gracePeriodDays`, and `overdueDate` schedule fields. Derived overdue status SHALL use `overdueDate`, not `dueDate`.

#### Scenario: Grace interval is not overdue
- **WHEN** an unpaid issued invoice is past `dueDate` but not past `overdueDate`
- **THEN** the API keeps its derived status issued and returns both dates

#### Scenario: Invoice is overdue after grace
- **WHEN** an unpaid issued invoice is past `overdueDate`
- **THEN** the API marks it overdue

#### Scenario: Legacy invoice has no due date
- **WHEN** an owned legacy invoice has null due and overdue dates
- **THEN** the API returns both as null without inventing a fallback

#### Scenario: Existing scope and immutable payment instructions remain
- **WHEN** a tenant or active roommate requests an invoice within their resolved scope
- **THEN** the API returns only authorized invoice data and the stored payment-profile snapshot without substituting current building data
