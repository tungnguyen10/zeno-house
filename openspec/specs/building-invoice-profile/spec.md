# building-invoice-profile Specification

## Purpose
Define building-scoped receiving-bank identity, private invoice assets, transfer templates, and one-time legacy invoice snapshot behavior.

## Requirements

### Requirement: Building invoice profile management
The system SHALL store one current invoice profile per building containing bank name, account holder, account number, transfer-content template, required QR image, and optional building logo.

#### Scenario: Owner or admin saves a scoped profile
- **WHEN** an owner inside building scope or an admin submits a valid complete profile
- **THEN** the system saves the profile and returns signed preview URLs without exposing storage paths

#### Scenario: Manager reads but cannot change a profile
- **WHEN** a scoped manager opens building settings
- **THEN** the manager can read the profile but receives forbidden for an update attempt

#### Scenario: Initial profile lacks QR
- **WHEN** a building without a profile submits bank fields without a valid QR image
- **THEN** the request fails validation and no profile is created

### Requirement: Transfer-content templates
The system SHALL accept only `{building_code}`, `{room_number}`, `{invoice_code}`, and `{period}` template variables and SHALL render them to plain text for each invoice snapshot.

#### Scenario: Supported variables are rendered
- **WHEN** an invoice is issued for a configured building
- **THEN** every supported variable is replaced with that invoice's building, room, code, and period values

#### Scenario: Unknown variable is rejected
- **WHEN** a profile template contains any other brace-delimited variable
- **THEN** profile validation fails with a clear error

### Requirement: Private append-only profile assets
The system SHALL store QR and logo images in a private bucket using unique non-overwriting paths and SHALL accept only JPEG, PNG, or WebP files up to 5 MB.

#### Scenario: Profile image is served
- **WHEN** an authorized scoped user reads a profile or invoice snapshot
- **THEN** the API returns a short-lived signed URL for each available private image

#### Scenario: Profile image is replaced
- **WHEN** an owner uploads a replacement QR or logo
- **THEN** the new profile references a unique new object and the prior committed object remains available to historical snapshots

#### Scenario: Persistence fails after upload
- **WHEN** new assets upload successfully but profile persistence fails
- **THEN** the request's newly uploaded objects are removed and the prior profile remains unchanged

### Requirement: First-configuration legacy backfill
The system SHALL backfill the newly configured profile exactly once into active legacy invoices that have no profile snapshot.

#### Scenario: First profile save backfills legacy invoices
- **WHEN** a building profile is created for the first time
- **THEN** every non-void invoice for that building with a null profile snapshot receives a rendered snapshot in the same database transaction

#### Scenario: Later profile edit preserves history
- **WHEN** the profile is updated after initial configuration
- **THEN** no existing invoice snapshot is changed

#### Scenario: Void legacy invoice is excluded
- **WHEN** first configuration encounters a void invoice with a null snapshot
- **THEN** that invoice remains unchanged
