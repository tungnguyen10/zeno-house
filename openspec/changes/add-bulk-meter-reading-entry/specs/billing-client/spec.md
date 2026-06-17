## ADDED Requirements

### Requirement: Draft grid optimistic reading feedback
The billing draft grid SHALL show immediate optimistic feedback for locally edited meter readings without waiting for a full server grid reload.

#### Scenario: Electricity edit updates usage and amount
- **WHEN** the user enters an editable electricity reading and the row has a previous electricity reading and per-kWh rate
- **THEN** the grid immediately shows the effective current reading, kWh usage, electricity amount, and updated draft row total based on the local value

#### Scenario: Metered water edit updates usage and amount
- **WHEN** the user enters an editable water reading and the row has a previous water reading and per-m3 rate
- **THEN** the grid immediately shows the effective current reading, m3 usage, water amount, and updated draft row total based on the local value

#### Scenario: Non-meter water remains unchanged
- **WHEN** water is billed per person or fixed per room
- **THEN** the grid does not request or calculate a water meter reading and continues to show the configured non-meter water charge behavior

#### Scenario: Empty local value does not corrupt totals
- **WHEN** the user clears a reading cell before entering a replacement value
- **THEN** the grid marks the cell dirty but does not calculate a misleading utility amount or negative draft total from an empty value

#### Scenario: Invalid local value does not calculate amount
- **WHEN** a local reading value is not a valid non-negative number
- **THEN** the grid keeps the local value visible, marks the row as needing correction, and does not calculate a utility amount from that value

#### Scenario: Lower-than-previous local value warns
- **WHEN** a local reading value is lower than the previous reading for that meter
- **THEN** the grid shows a warning and avoids presenting a normal negative-consumption amount

#### Scenario: Unsupported pricing does not invent estimate
- **WHEN** a row uses utility pricing that cannot be estimated safely on the client
- **THEN** the grid shows the local reading value and save state but leaves the amount as requiring server refresh or unsupported review

#### Scenario: Server data remains source of truth after explicit refresh
- **WHEN** the user explicitly refreshes the grid or proceeds to invoice issue
- **THEN** optimistic display values are reconciled with server-computed draft rows

### Requirement: Draft grid bulk reading entry UI
The billing draft grid SHALL expose bulk meter-reading entry as part of the existing reading-entry workflow.

#### Scenario: Bulk entry applies to current draft grid scope
- **WHEN** the user opens bulk entry from the draft grid
- **THEN** ordered input maps against the current visible draft-grid rows and room-number input matches against rooms present in the current grid response

#### Scenario: Bulk entry respects filters visibly
- **WHEN** the grid is filtered before opening bulk entry
- **THEN** the modal makes clear that ordered input follows the currently visible row order

#### Scenario: Bulk entry uses same autosave state
- **WHEN** accepted bulk readings are applied to the grid
- **THEN** affected rows show the same saving, saved, and error indicators as manual edits

#### Scenario: Bulk entry does not bypass issue safeguards
- **WHEN** bulk readings are applied but blockers or warnings remain
- **THEN** the issue tab continues to prevent issuing affected invoices according to the authoritative draft readiness rules

## MODIFIED Requirements

### Requirement: Draft grid recompute workflow
The billing draft grid SHALL save changed readings without reloading the full grid after each successful auto-save, SHALL provide optimistic row-level feedback for local edits, and SHALL still support explicit server recomputation when authoritative data is needed.

#### Scenario: Save changed readings only
- **WHEN** the user saves readings manually, through focused-cell paste, or through bulk-entry apply
- **THEN** the client submits changed meter readings and does not resubmit unchanged rows unnecessarily

#### Scenario: Auto-save success preserves grid session
- **WHEN** saving readings succeeds from auto-save
- **THEN** the grid remains mounted, the active input/focus context is not disrupted by a full grid reload, filters remain selected, expanded rows remain open, and row save state changes to saved

#### Scenario: Save now preserves grid session
- **WHEN** the user clicks `Lưu ngay` for pending reading changes
- **THEN** the client saves changed readings without automatically reloading the full draft grid solely because the save succeeded

#### Scenario: Server recomputation is available on demand
- **WHEN** the user clicks `Tải lại`, changes billing period, saves a utility override, or enters invoice issue/reissue workflows
- **THEN** the grid refreshes from the draft-grid API/read model and displays server-computed utility amounts, line totals, blockers, warnings, and draft totals

#### Scenario: Filter state preserved on explicit refresh
- **WHEN** the grid refreshes after an explicit refresh or workflow transition
- **THEN** the selected filter and expanded rows are preserved when the corresponding rows still exist

#### Scenario: Save failure keeps local draft
- **WHEN** saving readings fails
- **THEN** the grid keeps the user's local values visible, marks the affected row with an error state, and does not discard unsaved input by reloading the full grid
