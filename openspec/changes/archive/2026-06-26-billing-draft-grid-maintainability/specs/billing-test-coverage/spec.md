## ADDED Requirements

### Requirement: Draft grid refactor regression coverage
The billing test suite SHALL protect draft-grid behavior that is moved into composables or child components.

#### Scenario: Extracted autosave covered
- **WHEN** autosave state is extracted from the draft-grid component
- **THEN** tests cover dirty cell detection, saved-state persistence without refresh, and save failure preserving local values

#### Scenario: Extracted navigation covered
- **WHEN** keyboard navigation or focused-cell paste logic is extracted
- **THEN** tests cover Tab, Enter, Shift modifiers, downstream paste, and read-only row skipping

#### Scenario: Extracted override and expanded row covered
- **WHEN** override or expanded-row rendering is extracted
- **THEN** tests cover override payload construction and discrepancy intent emission
