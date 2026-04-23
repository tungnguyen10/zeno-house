## ADDED Requirements

### Requirement: Tenant check-in form collects info in multiple steps
The system SHALL provide a multi-step form for creating a new tenant: Step 1 (personal info), Step 2 (CCCD upload), Step 3 (room assignment). All data is submitted on the final step via a single API call.

#### Scenario: Form validates VN phone format
- **WHEN** a user enters a phone number not matching VN format (10 digits starting with 0)
- **THEN** a validation error is shown inline

#### Scenario: Form validates CCCD format
- **WHEN** a user enters a CCCD with fewer or more than 12 digits
- **THEN** a validation error is shown inline

#### Scenario: Completed form creates tenant and shows success
- **WHEN** all steps are complete and the user submits
- **THEN** the tenant is created, a success toast is shown, and the user is redirected to the tenant detail page

### Requirement: CCCD upload stores images in Supabase Storage
The system SHALL allow uploading front and back CCCD images via `CCCDUpload.vue`. Images are stored in a private Supabase Storage bucket and the URL is saved on the tenant record.

#### Scenario: File upload stores URL on tenant
- **WHEN** a user uploads a CCCD image
- **THEN** the file is saved to Supabase Storage and the URL is associated with the tenant record

#### Scenario: AI OCR button is disabled placeholder
- **WHEN** a user views the CCCD upload step
- **THEN** an "AI đọc tự động" button is visible but disabled with tooltip "Sắp có"

### Requirement: Tenant detail page shows rental history
The system SHALL provide a `/tenants/[id]/history` page listing all past room assignments (room name, move-in date, move-out date, contract status) for the tenant.

#### Scenario: History shows all past rooms
- **WHEN** an admin views a tenant's history
- **THEN** all previous and current room assignments are listed in reverse chronological order

### Requirement: Checkout action frees the room and terminates contracts
The system SHALL provide a `POST /api/tenants/[id]/checkout` route that marks the tenant's current contracts as terminated and sets the room's status back to `available` atomically.

#### Scenario: Checkout frees room
- **WHEN** checkout is triggered for a tenant in an occupied room
- **THEN** the room's status changes to `available` and the active contract is terminated

#### Scenario: Checkout fails if no active contract
- **WHEN** checkout is triggered for a tenant with no active contract
- **THEN** the API returns HTTP 400 with an informative message
