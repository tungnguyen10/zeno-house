## ADDED Requirements

### Requirement: Draft workspace manages room incidental charges
The **Soạn kỳ** workspace SHALL expose incidental-charge management per billable contract row without adding a permanent grid column.

#### Scenario: Add charge from desktop row
- **WHEN** an editable billable row has no effective invoice and the operator chooses **Thêm phát sinh**
- **THEN** a modal captures name, positive currency amount, and optional note and refreshes authoritative totals after save

#### Scenario: Add charge from mobile row
- **WHEN** the same workflow is opened on a mobile viewport
- **THEN** the mobile card exposes the same action and validation without horizontal overflow

### Requirement: Room detail shows current-period incidental charges
The room-detail drawer SHALL show every current-period incidental charge with its label, amount, optional note, and appropriate edit state.

#### Scenario: Editable charge list
- **WHEN** the period and target row are editable
- **THEN** each incidental charge provides edit and delete actions with loading, failure, and success feedback

#### Scenario: Locked charge list
- **WHEN** the period is closed or the row has an effective invoice
- **THEN** charges remain visible, mutation actions are hidden, and the UI explains that post-issue changes use invoice correction

#### Scenario: Empty charge list
- **WHEN** the room has no incidental charges in the current period
- **THEN** the drawer shows a concise empty state and the add action only when editing is allowed
