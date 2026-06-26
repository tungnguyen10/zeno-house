## ADDED Requirements

### Requirement: Draft grid bulk input behavior preserved during extraction
Bulk reading entry and focused-cell paste SHALL keep their current parsing, preview, validation, highlight, and auto-save behavior after draft-grid internals are extracted.

#### Scenario: Focused-cell paste preserved
- **WHEN** the user pastes multiple values into a focused reading cell
- **THEN** values fill downstream editable cells in that meter column, affected cells highlight, and row auto-save uses the no-refresh path

#### Scenario: Bulk modal apply preserved
- **WHEN** the user applies accepted rows from the bulk reading modal
- **THEN** accepted values update local draft-grid state, skipped values remain unchanged, and row auto-save is scheduled through the same shared path
