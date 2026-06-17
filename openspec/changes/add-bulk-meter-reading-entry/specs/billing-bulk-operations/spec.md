## ADDED Requirements

### Requirement: Bulk meter reading entry modal
The billing draft grid SHALL provide a dedicated bulk meter-reading entry modal for applying multiple room readings at once.

#### Scenario: Open bulk entry from draft grid
- **WHEN** the billing draft grid is editable
- **THEN** the toolbar shows an `Nhập nhanh` action that opens a modal with a textarea, dynamic input guidance, preview area, apply action, and cancel action

#### Scenario: Bulk entry hidden for locked periods
- **WHEN** the billing period is issued, collecting, closed, or otherwise read-only for reading edits
- **THEN** the `Nhập nhanh` action is hidden or disabled with a clear reason

#### Scenario: Guidance for electricity and metered water
- **WHEN** visible editable rows require both electricity and metered water readings
- **THEN** the modal guidance shows examples for `room electricity water` and ordered `electricity water` input

#### Scenario: Guidance for electricity only
- **WHEN** visible editable rows require electricity readings and water is billed per person or fixed per room
- **THEN** the modal guidance shows examples for electricity-only input and explains that water does not need meter entry

#### Scenario: Guidance for mixed row requirements
- **WHEN** visible rows have mixed electricity/water requirements
- **THEN** the modal guidance explains that each row is validated against its own editable meter cells and the preview will mark non-applicable values

### Requirement: Bulk meter reading input formats
The bulk meter-reading entry modal SHALL support ordered input and room-number input with explicit skip behavior.

#### Scenario: Ordered electricity and water rows
- **WHEN** the user enters lines like `12345 12`, `45678 18`, and `16920 9` in ordered mode
- **THEN** each non-empty line maps to the next visible editable room in order and applies electricity and water values where those meter cells are applicable

#### Scenario: Ordered blank line skips room
- **WHEN** the user enters an empty line in ordered mode
- **THEN** the corresponding visible room is marked skipped and no meter value is changed for that room

#### Scenario: Ordered electricity-only rows
- **WHEN** the user enters lines like `12345`, `45678`, and `16920` in ordered mode for a grid where water does not require meter entry
- **THEN** each line applies only electricity and does not mark water as missing

#### Scenario: Room-number electricity and water rows
- **WHEN** the user enters lines like `A101 12345 12`
- **THEN** the first token is matched to a visible room number and the next tokens are interpreted as electricity and water values

#### Scenario: Room-number electricity-only row
- **WHEN** the user enters `A101 12345`
- **THEN** the preview applies the electricity value for room `A101` and leaves water unchanged unless the row requires water and the user explicitly provided it

#### Scenario: Room-number line with no readings
- **WHEN** the user enters a line containing only a room number such as `A102`
- **THEN** the preview marks that room as skipped and does not change existing values

#### Scenario: Explicit skip marker
- **WHEN** the user enters `A104 - 15`
- **THEN** the preview skips electricity for `A104`, applies water `15` only if water is applicable, and does not overwrite the electricity reading

#### Scenario: Spreadsheet tab-separated input
- **WHEN** the user pastes tab-separated rows from Excel or Google Sheets
- **THEN** tabs are treated as column separators equivalent to spaces

#### Scenario: Extra whitespace
- **WHEN** the input contains leading, trailing, or repeated whitespace
- **THEN** parsing ignores insignificant whitespace without changing the intended columns

### Requirement: Bulk meter reading preview validation
The bulk meter-reading entry modal SHALL preview parsed rows and block unsafe application until errors are resolved or affected lines are skipped.

#### Scenario: Preview maps ordered rows to rooms
- **WHEN** the user enters ordered input
- **THEN** the preview shows each source line, target room, electricity value, water value, and status before apply is allowed

#### Scenario: Preview maps room-number rows
- **WHEN** the user enters room-number input
- **THEN** the preview shows the matched room for each line and does not rely on current row order for those lines

#### Scenario: Room not found
- **WHEN** a room-number line references a room that is not visible in the draft grid
- **THEN** the preview marks the line `Không tìm thấy phòng` and blocks apply for that line

#### Scenario: Duplicate room line
- **WHEN** the input contains multiple non-skipped lines for the same room
- **THEN** the preview marks duplicate lines as errors and blocks apply until the duplicate is removed or skipped

#### Scenario: Invalid number
- **WHEN** an electricity or water token is not numeric and is not the skip marker
- **THEN** the preview marks that cell `Giá trị không hợp lệ` and blocks applying that value

#### Scenario: Negative reading
- **WHEN** an electricity or water reading value is less than zero
- **THEN** the preview marks that cell invalid and blocks applying that value

#### Scenario: Reading lower than previous
- **WHEN** a new reading is lower than the previous reading for that meter cell
- **THEN** the preview marks a warning such as `Nhỏ hơn chỉ số cũ` and does not silently calculate negative usage

#### Scenario: Read-only target row
- **WHEN** a parsed line targets a row that is not editable because its invoice or period state is locked
- **THEN** the preview marks the line `Không thể sửa` and does not apply values to that row

#### Scenario: Non-applicable meter cell
- **WHEN** a parsed value targets a meter cell that is not required or not editable for that room
- **THEN** the preview marks that value `Không áp dụng` and ignores it without treating it as a missing reading

#### Scenario: Empty input
- **WHEN** the textarea is empty or contains only skipped lines
- **THEN** apply is disabled and the preview explains that there are no valid readings to apply

### Requirement: Bulk meter reading apply behavior
Accepted bulk meter-reading values SHALL be applied through the same local draft state and save orchestration as manual meter entry.

#### Scenario: Apply valid preview values
- **WHEN** the user applies a preview that contains accepted electricity or water values
- **THEN** those values populate the corresponding grid cells, affected cells are highlighted briefly, and row auto-save is scheduled using the shared draft-grid save path

#### Scenario: Skipped values preserve existing readings
- **WHEN** a preview row or cell is skipped by blank input or `-`
- **THEN** existing local and persisted values for that room/meter are left unchanged

#### Scenario: Non-applicable water is ignored
- **WHEN** water is billed per person or fixed per room and the user provides a water value
- **THEN** applying the preview updates applicable electricity values but does not create or update a water meter reading for that row

#### Scenario: Apply does not immediately refresh grid
- **WHEN** bulk values are applied and auto-save begins
- **THEN** the draft grid remains mounted, preserves focus context, preserves the active filter, and does not reload the full grid after each successful row save

#### Scenario: Save error preserves local values
- **WHEN** auto-save fails for a row after bulk apply
- **THEN** the row shows an error state, local entered values remain visible, and other successful rows remain saved

## MODIFIED Requirements

### Requirement: Bulk meter reading paste
The billing draft grid SHALL accept clipboard paste of multi-row meter readings into a focused new-reading cell and propagate values down the column, while the dedicated bulk-entry modal SHALL handle multi-column and room-number input.

#### Scenario: Paste tab/newline separated values
- **WHEN** the user focuses a new-reading cell and pastes text containing newline-separated numbers
- **THEN** values fill the focused cell and following editable cells in the same column, skipping read-only rows

#### Scenario: Paste with mixed decimal separators
- **WHEN** the pasted text contains values like `123,45` and `123.45`
- **THEN** both forms are normalized to numeric values with `.` as decimal separator before saving

#### Scenario: Paste highlights affected cells
- **WHEN** values fill multiple cells from a single paste
- **THEN** the affected cells are visually highlighted briefly so the user can verify the range

#### Scenario: Multi-column paste uses bulk entry
- **WHEN** the user needs to paste both electricity and water columns or include room numbers
- **THEN** the user can use the `Nhập nhanh` modal to preview and apply the data instead of relying on focused-cell column paste

### Requirement: Debounced auto-save for draft grid
Draft meter readings SHALL save automatically after a short idle period without requiring an explicit save button per row and SHALL NOT reload the full draft grid after each successful save.

#### Scenario: Edit triggers debounced save
- **WHEN** the user edits a new-reading value
- **THEN** the row saves to the server after ~800ms of input inactivity

#### Scenario: Save state visible per row
- **WHEN** a save is in progress, succeeded, or failed for a row
- **THEN** a small status indicator on that row reflects the state (saving / saved / error)

#### Scenario: Save success does not reload grid
- **WHEN** a manual edit, focused-cell paste, or bulk-entry-applied row save succeeds
- **THEN** the draft grid does not call the full grid reload path solely because that save succeeded

#### Scenario: Explicit refresh still reloads authoritative grid
- **WHEN** the user clicks `Tải lại` or enters a workflow that requires authoritative server recomputation such as invoice issue
- **THEN** the workspace refreshes the draft grid from the server read model
