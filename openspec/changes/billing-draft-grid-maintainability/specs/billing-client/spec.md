## ADDED Requirements

### Requirement: Draft grid behavior preserved during maintainability refactor
The billing draft grid SHALL preserve existing user-facing reading entry, auto-save, optimistic display, override, discrepancy, read-only, filter, and mobile workflows while being composed from focused units.

#### Scenario: Manual reading behavior preserved
- **WHEN** a user edits an editable electricity or water reading cell
- **THEN** the row auto-saves through the existing no-refresh path and displays the same save states as before the refactor

#### Scenario: Override behavior preserved
- **WHEN** a user saves a utility override from a draft-grid row
- **THEN** the same utility usage override payload is submitted and the grid refresh behavior remains unchanged

#### Scenario: Discrepancy intent behavior preserved
- **WHEN** a draft row has an issued-invoice discrepancy and the user chooses an adjustment or void/reissue action
- **THEN** the workspace receives the same intent payloads as before the refactor

#### Scenario: Mobile behavior preserved
- **WHEN** the draft grid renders on a mobile viewport
- **THEN** the same stacked row workflow remains available without horizontal table scanning
