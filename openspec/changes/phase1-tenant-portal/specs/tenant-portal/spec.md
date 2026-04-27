## ADDED Requirements

### Requirement: Tenant dashboard shows current room and contract summary
The system SHALL display a dashboard at `/tenant` showing the tenant's current room name, floor, building, active contract end date with days remaining, and count of unpaid invoices (stub = 0 in Phase 1).

#### Scenario: Dashboard shows room and contract info
- **WHEN** an authenticated tenant visits `/tenant`
- **THEN** their current room name, building, and active contract days remaining are displayed

#### Scenario: Dashboard shows zero unpaid invoices in Phase 1
- **WHEN** a tenant has no invoices (invoices module not yet implemented)
- **THEN** the dashboard shows 0 unpaid invoices

### Requirement: Tenant can view their active contract read-only
The system SHALL provide a `/tenant/contracts` page showing the rendered contract HTML (`content_html`) read-only. A disabled "Tải PDF" button is visible.

#### Scenario: Contract page renders HTML content
- **WHEN** a tenant navigates to `/tenant/contracts`
- **THEN** their active contract's `content_html` is rendered (sanitized)

#### Scenario: No active contract shows empty state
- **WHEN** a tenant has no active contract
- **THEN** an empty state message is shown

### Requirement: Tenant can submit maintenance requests
The system SHALL provide a form at `/tenant/maintenance/new` for submitting a maintenance request with title, description, priority INTEGER (1=low, 2=medium, 3=high — no "urgent" level), and up to 3 photos.

#### Scenario: Submitted request appears in tenant's list
- **WHEN** a tenant submits a maintenance request
- **THEN** the request appears at `/tenant/maintenance` with status `open`

#### Scenario: Photo upload limited to 3 images
- **WHEN** a tenant attempts to upload a 4th photo
- **THEN** the upload is blocked with an inline error

### Requirement: Tenant maintenance list shows own requests only
The system SHALL display only the authenticated tenant's maintenance requests at `/tenant/maintenance`. Requests include status, priority, title, and submission date.

#### Scenario: Tenant cannot see other tenants' requests
- **WHEN** a tenant views `/tenant/maintenance`
- **THEN** only requests they submitted are shown

### Requirement: Tenant account page allows editing personal info and changing password
The system SHALL provide a `/tenant/account` page (NOT `/tenant/profile`) where the tenant can update their `full_name` and `phone` (on `profiles`) and `permanent_address`, `emergency_contact_name`, `emergency_contact_phone` (on `tenants`), and change their password.

#### Scenario: Account edit saves updated name
- **WHEN** a tenant updates their full_name and saves
- **THEN** the profile is updated and a success toast is shown

#### Scenario: Password change requires current password
- **WHEN** a tenant submits a new password
- **THEN** Supabase Auth validates the current password before updating

### Requirement: Invoice page is a Phase 2 placeholder
The system SHALL have a `/tenant/invoices` page that renders an empty state indicating the feature is coming in a future update.

#### Scenario: Invoice page shows placeholder message
- **WHEN** a tenant navigates to `/tenant/invoices`
- **THEN** an empty state with "Tính năng đang phát triển" is shown
