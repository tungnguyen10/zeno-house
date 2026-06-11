## ADDED Requirements

### Requirement: Searchable select primitive
The UI primitive system SHALL provide a searchable selection primitive for choosing an item from a list of domain options such as rooms, tenants, contracts, buildings, or invoices. The primitive SHALL support `modelValue`, option identity, option label rendering, `label`, `required`, `disabled`, `loading`, `error`, empty state text, and clear/select behavior.

#### Scenario: Search filters options
- **WHEN** a user types a query into the searchable select
- **THEN** matching options remain visible and non-matching options are hidden or deprioritized without changing the selected value until the user selects an option

#### Scenario: Selected option is emitted
- **WHEN** a user selects an option from the searchable select
- **THEN** the primitive emits `update:modelValue` with the selected option value and displays the selected option label

#### Scenario: Empty result is visible
- **WHEN** the searchable select has no matching options for the current query
- **THEN** it renders a consistent dark themed empty state instead of an unstyled blank dropdown

#### Scenario: Searchable select error state
- **WHEN** the searchable select receives an error string
- **THEN** it renders the error message and error border consistently with `UiInput` and `UiSelect`

#### Scenario: Searchable select supports loading
- **WHEN** options are loading
- **THEN** the primitive communicates the loading state and prevents ambiguous selection

### Requirement: Compact density for form controls
`UiInput`, `UiSelect`, and `UiTextarea` SHALL support compact density in addition to their default size so editable tables, matrix cells, meter readings, and billing review rows can use primitive controls without custom inline classes.

#### Scenario: Compact input in table cell
- **WHEN** `UiInput` is rendered with compact density inside a table cell
- **THEN** it uses reduced padding and stable height while retaining label-less accessibility, focus ring, disabled state, prefix/suffix slots, and error styling

#### Scenario: Compact select in toolbar or table
- **WHEN** `UiSelect` is rendered with compact density
- **THEN** it uses reduced height and padding while preserving placeholder, disabled state, option rendering, error state, and dark select arrow styling

#### Scenario: Compact textarea for dense correction note
- **WHEN** `UiTextarea` is rendered with compact density
- **THEN** it uses compact spacing while preserving resize behavior, error state, and helper text

### Requirement: Primitive-backed icon actions
Icon-only and low-emphasis action buttons SHALL use `UiButton` with `iconOnly` or an equivalent primitive-backed pattern instead of raw `<button>` styling outside primitive internals.

#### Scenario: Accessible icon-only action
- **WHEN** an icon-only action is rendered in the shell, toolbar, row action, or modal header
- **THEN** the action has an accessible label and uses the design-system focus, hover, disabled, and size behavior

#### Scenario: Raw button exception is documented
- **WHEN** a raw `<button>` remains outside `app/components/ui/`
- **THEN** the implementation documents why it is a justified exception or migrates it to `UiButton`

### Requirement: Primitive showcase remains complete
The internal primitive showcase SHALL render every public primitive and every material variant/state added by this change.

#### Scenario: Searchable select showcase
- **WHEN** the searchable select primitive is added
- **THEN** `/ui-showcase` renders examples for normal, selected, loading, empty, disabled, and error states

#### Scenario: Compact density showcase
- **WHEN** compact density is added to form controls
- **THEN** `/ui-showcase` renders compact input, select, and textarea examples in a dense/table-like context
