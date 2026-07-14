## ADDED Requirements

### Requirement: Billing mutations refresh only affected workspace data
The billing client SHALL update direct mutation results locally where safe and SHALL reload each affected aggregate at most once per successful action.

#### Scenario: Save meter readings
- **WHEN** meter readings are saved successfully
- **THEN** the client reloads the draft grid once and does not separately reload an overview already included by that grid

#### Scenario: Issue invoices
- **WHEN** invoices are issued successfully
- **THEN** the client refreshes invoice and grid state without duplicate draft or overview requests that return equivalent data
