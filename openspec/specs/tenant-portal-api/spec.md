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
`GET /api/tenant/me` SHALL return the caller's tenant profile with safe fields only. `PATCH /api/tenant/me` SHALL update only a strict whitelist (`phone`, `email`, `emergency_contact_name`, `emergency_contact_phone`, `notes`) and SHALL reject or ignore any other field, including `status`, `code`, `id_number`, `full_name` policy fields, and linkage fields.

#### Scenario: Read own profile
- **WHEN** a tenant calls `GET /api/tenant/me`
- **THEN** the response contains the caller's profile safe fields

#### Scenario: Update allowed contact fields
- **WHEN** a tenant PATCHes `phone` and `email`
- **THEN** the update succeeds and returns the updated profile

#### Scenario: Non-whitelisted field rejected
- **WHEN** a tenant PATCH includes `status` or `id_number`
- **THEN** that field is rejected/ignored and never persisted

### Requirement: Tenant active contract summary
`GET /api/tenant/contract` SHALL return the caller's active contract summary (room number, building name, start/end dates, monthly rent, deposit, status). Terminated or expired contracts SHALL be excluded, and the endpoint SHALL never return another tenant's contract.

#### Scenario: Active contract returned
- **WHEN** a tenant with an active contract calls the endpoint
- **THEN** the active contract summary is returned

#### Scenario: No active contract
- **WHEN** the tenant has no active contract
- **THEN** the endpoint returns an empty/absent result, not another tenant's data

### Requirement: Tenant invoice list and detail
`GET /api/tenant/invoices` SHALL return only the caller's invoices, paginated, with derived overdue status. `GET /api/tenant/invoices/[id]` SHALL return one invoice with its charge lines only when it belongs to the caller; otherwise it SHALL return a consistent not-found response that does not leak the existence of another tenant's invoice.

#### Scenario: List own invoices
- **WHEN** a tenant calls `GET /api/tenant/invoices`
- **THEN** only invoices whose `tenant_id` equals the resolved tenant are returned

#### Scenario: Overdue status derived
- **WHEN** an issued invoice is past its due date with a positive balance
- **THEN** the list marks it overdue

#### Scenario: Detail ownership enforced
- **WHEN** a tenant requests an invoice id that belongs to another tenant
- **THEN** the response is a consistent not-found with no existence leak

#### Scenario: Voided invoice detail
- **WHEN** a tenant requests one of their own voided invoices
- **THEN** the detail returns with void metadata
