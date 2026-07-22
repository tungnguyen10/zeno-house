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
`GET /api/tenant/me` SHALL return the caller's tenant profile with safe fields only. `PATCH /api/tenant/me` SHALL update only a strict non-credential profile whitelist (`phone`, `emergency_contact_name`, `emergency_contact_phone`, `notes`, and the accepted personal profile fields) and SHALL reject or ignore any other field, including login `email`, `status`, `code`, and linkage fields. Supabase Auth login email and the contact email in `tenants.email` are independent.

#### Scenario: Read own profile
- **WHEN** a tenant calls `GET /api/tenant/me`
- **THEN** the response contains the caller's profile safe fields

#### Scenario: Update allowed contact fields
- **WHEN** a tenant PATCHes `phone`
- **THEN** the update succeeds and returns the updated profile

#### Scenario: Login email is not a profile mutation
- **WHEN** a tenant PATCH includes `email`
- **THEN** it is not persisted as a profile edit

#### Scenario: Non-whitelisted field rejected
- **WHEN** a tenant PATCH includes `status` or `id_number`
- **THEN** that field is rejected/ignored and never persisted

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
`GET /api/tenant/invoices` SHALL return paginated invoices with derived overdue status. Primary tenant scope SHALL remain `tenant_id` so historical invoices are retained. Active roommate scope SHALL be the server-resolved current `contract_id`, including invoices issued before move-in. `GET /api/tenant/invoices/[id]` SHALL enforce the same scope before returning charge lines; otherwise it SHALL return a consistent not-found response.

#### Scenario: List own invoices
- **WHEN** a tenant calls `GET /api/tenant/invoices`
- **THEN** only invoices whose `tenant_id` equals the resolved tenant are returned

#### Scenario: Roommate lists shared-contract invoices
- **WHEN** an active roommate calls `GET /api/tenant/invoices`
- **THEN** only invoices for the resolved shared contract are returned

#### Scenario: Roommate cannot read another contract invoice
- **WHEN** a roommate requests an invoice outside the resolved shared contract
- **THEN** the response is the same consistent not-found response

#### Scenario: Overdue status derived
- **WHEN** an issued invoice is past its due date with a positive balance
- **THEN** the list marks it overdue

#### Scenario: Detail ownership enforced
- **WHEN** a tenant requests an invoice id that belongs to another tenant
- **THEN** the response is a consistent not-found with no existence leak

#### Scenario: Voided invoice detail
- **WHEN** a tenant requests one of their own voided invoices
- **THEN** the detail returns with void metadata
