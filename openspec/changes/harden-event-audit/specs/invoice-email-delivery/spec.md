## ADDED Requirements

### Requirement: Invoice-email setting mutation audit
Changing a building's automatic invoice-email setting SHALL atomically persist the setting and append `building.invoice_email_settings.updated` with the building scope, actor, and safe before/after enabled values.

#### Scenario: Automatic-send setting changes
- **WHEN** an authorized owner or admin enables or disables automatic invoice email
- **THEN** the setting and audit event commit together

#### Scenario: Setting audit fails
- **WHEN** the required audit event cannot be inserted
- **THEN** the setting remains unchanged
