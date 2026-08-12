## MODIFIED Requirements

### Requirement: Tenant profile read and whitelist update
`GET /api/tenant/me` SHALL return the caller's safe tenant profile. `PATCH /api/tenant/me` SHALL update only the strict self-service whitelist: `full_name`, `phone`, `gender`, `date_of_birth`, `occupation`, `permanent_address`, `emergency_contact_name`, `emergency_contact_phone`, and `notes`. Login email, tenant contact email, status, code, linkage fields, and legal identity fields (`id_number`, `id_issued_date`, `id_issued_place`) SHALL be rejected or ignored and never persisted by tenant self-service.

#### Scenario: Read own profile
- **WHEN** a tenant calls `GET /api/tenant/me`
- **THEN** the response contains the caller's safe profile fields including read-only legal identity

#### Scenario: Update allowed contact fields
- **WHEN** a tenant PATCHes `phone`
- **THEN** the update succeeds and returns the updated profile

#### Scenario: Login email is not a profile mutation
- **WHEN** a tenant PATCH includes `email`
- **THEN** it is not persisted as a profile edit

#### Scenario: Legal identity is operator-managed
- **WHEN** a tenant PATCH includes `id_number`, `id_issued_date`, or `id_issued_place`
- **THEN** those fields are rejected or ignored and never persisted

### Requirement: Tenant invoice list and detail
`GET /api/tenant/invoices` SHALL return paginated invoices with derived overdue status and complete pagination metadata. Primary tenant scope SHALL remain `tenant_id` so historical invoices are retained. Active roommate scope SHALL be the server-resolved current `contract_id`, including invoices issued before move-in. The portal SHALL be able to request subsequent pages without replacing already loaded rows. `GET /api/tenant/invoices/[id]` SHALL enforce the same scope before returning charge lines; otherwise it SHALL return a consistent not-found response.

#### Scenario: List own invoices
- **WHEN** a tenant calls `GET /api/tenant/invoices`
- **THEN** only invoices whose `tenant_id` equals the resolved tenant are returned with pagination metadata

#### Scenario: Load subsequent invoice page
- **WHEN** the portal requests a page after page one
- **THEN** the API returns that page and stable total/page/limit/totalPages metadata

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
