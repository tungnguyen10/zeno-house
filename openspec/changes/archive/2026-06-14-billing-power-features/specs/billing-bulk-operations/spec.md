## ADDED Requirements

### Requirement: Bulk meter reading paste
The billing draft grid SHALL accept clipboard paste of multi-row meter readings into a focused new-reading cell and propagate values down the column.

#### Scenario: Paste tab/newline separated values
- **WHEN** the user focuses a new-reading cell and pastes text containing newline-separated numbers
- **THEN** values fill the focused cell and following editable cells in the same column, skipping read-only rows

#### Scenario: Paste with mixed decimal separators
- **WHEN** the pasted text contains values like `123,45` and `123.45`
- **THEN** both forms are normalized to numeric values with `.` as decimal separator before saving

#### Scenario: Paste highlights affected cells
- **WHEN** values fill multiple cells from a single paste
- **THEN** the affected cells are visually highlighted briefly so the user can verify the range

### Requirement: Debounced auto-save for draft grid
Draft meter readings SHALL save automatically after a short idle period without requiring an explicit save button per row.

#### Scenario: Edit triggers debounced save
- **WHEN** the user edits a new-reading value
- **THEN** the row saves to the server after ~800ms of input inactivity

#### Scenario: Save state visible per row
- **WHEN** a save is in progress, succeeded, or failed for a row
- **THEN** a small status indicator on that row reflects the state (saving / saved / error)

#### Scenario: Single refresh after save
- **WHEN** a row save succeeds
- **THEN** the workspace refreshes draft grid + KPI strip via a single batched response, not three separate GETs

### Requirement: Keyboard navigation in draft grid
The draft grid SHALL support keyboard navigation between editable cells.

#### Scenario: Tab moves to next editable cell in row
- **WHEN** the user presses `Tab` in a draft cell
- **THEN** focus moves to the next editable cell in the same row, skipping read-only cells, and wrapping to the first editable cell of the next row at end of row

#### Scenario: Enter moves to same column next row
- **WHEN** the user presses `Enter` in a draft cell
- **THEN** focus moves to the same column in the next editable row

#### Scenario: Shift modifiers move backward
- **WHEN** the user presses `Shift+Tab` or `Shift+Enter`
- **THEN** focus moves in the reverse direction with the same skip rules

### Requirement: Bulk payment recording endpoint
A `POST /api/billing/invoices/bulk-payments` endpoint SHALL record multiple payments transactionally.

#### Scenario: Successful bulk payment
- **WHEN** the request body contains an array of valid payment entries with `invoice_id`, `amount`, `payment_method`, `payment_date`
- **THEN** all payments are recorded as if each were submitted to `recordPayment`, the response returns the created payment IDs, and a single `payments.bulk_recorded` audit event is appended with metadata `{ count, total_amount, invoice_ids }`

#### Scenario: All-or-nothing on partial failure
- **WHEN** any single payment in the batch fails validation or domain checks
- **THEN** all already-inserted payments are rolled back, no audit event is appended, and the response is `409 CONFLICT` with `details: { failed_index, failed_reason }`

#### Scenario: Permission required
- **WHEN** the caller lacks `billing.write`
- **THEN** the request fails with `403 FORBIDDEN`

### Requirement: Bulk payment recording UI
The Thanh toán & công nợ tab SHALL allow selecting multiple invoices and recording payments in one modal interaction.

#### Scenario: Selectable invoice rows
- **WHEN** an invoice row has remaining balance greater than zero
- **THEN** a checkbox is shown that contributes to a multi-select state

#### Scenario: Bulk action bar
- **WHEN** at least one invoice is selected
- **THEN** an action bar shows the selected count and a "Ghi thu hàng loạt" button

#### Scenario: Bulk modal pre-fills amounts
- **WHEN** the bulk payment modal opens
- **THEN** each row defaults `amount` to its remaining balance, and a single payment method/date/note set applies to all rows unless overridden per row

### Requirement: Inline 2-line mobile row in draft grid
The draft grid SHALL render readable mobile rows showing primary identity and editable input on line one, and breakdown info on line two.

#### Scenario: Mobile draft row layout
- **WHEN** the draft grid renders on a viewport below the table breakpoint
- **THEN** each row shows room + tenant name + new-reading input on line one, and breakdown text (old → new with units, unit price) on line two using compact muted typography

#### Scenario: Desktop layout unchanged
- **WHEN** the draft grid renders on desktop viewports
- **THEN** the existing multi-column table layout is preserved

## ADDED Capabilities

<!-- Capability surface owners: see proposal Capabilities section. Detailed requirements above. -->
