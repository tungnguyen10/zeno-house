## ADDED Requirements

### Requirement: Billing confirmation actions preserve state until mutation completes
Billing confirmation UI SHALL keep modal, loading, selection, and error state accurate until server mutations complete.

#### Scenario: Issue succeeds
- **WHEN** the user confirms invoice issue and the server request succeeds
- **THEN** the issue modal closes, selected draft rows are cleared, and the workspace refreshes from server state

#### Scenario: Issue fails
- **WHEN** the user confirms invoice issue and the server request fails
- **THEN** the issue modal remains open, selected draft rows remain selected, and the error is visible to the user

#### Scenario: Close period fails
- **WHEN** the user confirms close period and the server request fails
- **THEN** the close confirmation remains visible or returns to a recoverable state with the server error visible
