## ADDED Requirements

### Requirement: Utility readings panel in room detail
`/rooms/:id` page SHALL display a "Chỉ số điện nước" panel below the assignment section. The panel shows two sections — Electricity and Water — each with: latest reading value + date, and a history table of last 5 readings with columns: date, value, consumption. An "Ghi chỉ số" button opens a modal to submit a new reading.

#### Scenario: Panel displays latest readings
- **WHEN** admin views a room with existing readings
- **THEN** panel shows current electricity and water values with reading dates

#### Scenario: History table shows consumption
- **WHEN** multiple readings exist for a utility type
- **THEN** history rows show consumption (diff from previous) per entry

#### Scenario: No readings yet
- **WHEN** no readings exist for the room
- **THEN** panel shows "Chưa có chỉ số" placeholder for each type with prompt to add first reading

### Requirement: Add reading modal
A modal `RoomReadingModal.vue` SHALL allow admin to submit a new utility reading. Fields: `utility_type` (select: Điện / Nước), `reading_value` (number input), `reading_date` (date input, default today), `notes` (optional textarea). Shows previous reading value as helper text. Validates and submits to `POST /api/utility-readings`. On success refreshes panel.

#### Scenario: Submit creates reading
- **WHEN** admin fills valid form and submits
- **THEN** new reading appears in history, panel updates with new latest value

#### Scenario: Regression blocked at UI
- **WHEN** server returns 409 CONFLICT
- **THEN** modal shows error: "Chỉ số mới phải lớn hơn hoặc bằng chỉ số trước (X)"
