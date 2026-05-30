## Purpose

Reusable confirmation dialog component for destructive actions (delete, terminate, etc.).

## Requirements

### Requirement: UiConfirmModal component
The system SHALL provide a `UiConfirmModal` component for confirmation dialogs. Props: `open` (boolean), `title` (string), `message` (string), `confirmLabel` (string, default "Xoá"), `loading` (boolean). Emits: `confirm`, `cancel`. Used to replace inline delete modal logic in domain detail pages.

#### Scenario: Confirm action
- **WHEN** user clicks the confirm button
- **THEN** component emits `confirm` event

#### Scenario: Cancel action
- **WHEN** user clicks cancel or closes modal
- **THEN** component emits `cancel` event

#### Scenario: Loading state
- **WHEN** `loading` prop is true
- **THEN** confirm button shows loading indicator and is disabled
