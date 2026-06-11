## ADDED Requirements

### Requirement: Existing page adoption audit
Existing operational pages SHALL be migrated to the established page structure when this cleanup touches them. The migration SHALL cover page headers, actions, filters, loading states, empty states, error states, sections, and repeated content containers.

#### Scenario: List page uses operational primitives
- **WHEN** a list page is migrated by this cleanup
- **THEN** it uses `UiPageHeader` for title/action context, `UiToolbar` for filters/search when present, `UiAlert` for API errors, `UiSkeleton` for loading, and `UiEmptyState` for empty data

#### Scenario: Detail page uses sections
- **WHEN** a detail page is migrated by this cleanup
- **THEN** it uses `UiPageHeader` and `UiSection` or an approved dense list/table pattern instead of repeated ad-hoc rounded surface wrappers

#### Scenario: Create and edit pages use sectioned forms
- **WHEN** a create or edit page is migrated by this cleanup
- **THEN** it uses `UiPageHeader`, `UiAlert`, and primitive-backed form sections/actions without duplicating raw card/error classes

### Requirement: Existing form control adoption
Existing domain forms SHALL use UI primitives for text input, number input, select, textarea, checkbox, toggle, searchable selection, error display, helper text, and form actions.

#### Scenario: Raw select is removed from domain forms
- **WHEN** a migrated form needs a dropdown choice
- **THEN** it uses `UiSelect` instead of a raw `<select>` with hand-written Tailwind classes

#### Scenario: Raw textarea is removed from domain forms
- **WHEN** a migrated form needs multiline text
- **THEN** it uses `UiTextarea` instead of a raw `<textarea>` with hand-written Tailwind classes

#### Scenario: Searchable entity selector is standardized
- **WHEN** a migrated contract or occupant form needs room or tenant search/selection
- **THEN** it uses the searchable select primitive instead of custom input/dropdown/button markup

#### Scenario: API error uses alert
- **WHEN** a migrated form receives an API or workflow error
- **THEN** it displays the error through `UiAlert` with the appropriate severity

### Requirement: Existing table and matrix adoption
Existing tabular operational surfaces SHALL use `UiTable` or a documented dense list/table exception. Editable cells SHALL use primitive controls with compact density.

#### Scenario: Editable meter table
- **WHEN** meter readings or handover readings are migrated
- **THEN** numeric reading cells use compact primitive inputs and numeric columns are right-aligned

#### Scenario: Service matrix table
- **WHEN** service settings, building service matrix, or contract service tables are migrated
- **THEN** the table uses `UiTable` where feasible and primitive-backed toggles/inputs/buttons for cell controls

#### Scenario: Raw table exception is documented
- **WHEN** a raw `<table>` remains outside `app/components/ui/`
- **THEN** the implementation documents why `UiTable` cannot express that layout yet or extends `UiTable` before leaving the exception

### Requirement: Cleanup verification scans
The cleanup implementation SHALL include source scans for raw controls, raw tables, raw error blocks, and primitive adoption gaps. Remaining matches SHALL be either inside `app/components/ui/` or explicitly documented as accepted exceptions.

#### Scenario: Raw control scan
- **WHEN** implementation is complete
- **THEN** a scan for raw `input`, `select`, `textarea`, `table`, and `button` usage outside `app/components/ui/` has no unexplained matches

#### Scenario: Raw feedback scan
- **WHEN** implementation is complete
- **THEN** raw API/workflow error blocks are replaced by `UiAlert` or documented as non-alert field-level validation

#### Scenario: Page primitive scan
- **WHEN** implementation is complete
- **THEN** migrated operational pages show adoption of `UiPageHeader`, `UiSection`, `UiToolbar`, `UiAlert`, `UiSkeleton`, or `UiEmptyState` according to their screen type
