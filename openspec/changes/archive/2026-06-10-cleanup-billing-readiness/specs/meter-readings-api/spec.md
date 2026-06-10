## MODIFIED Requirements

### Requirement: Building rooms status query needs no devices
The status query SHALL return occupied rooms with their meter types directly, not via device lookup. This query is a billing-readiness input for a Building + Period workflow.

#### Scenario: Get building rooms status
- **WHEN** GET `/api/meter-readings/bulk?building_id=&period_year=&period_month=`
- **THEN** returns array of `{ roomId, roomNumber, floor, devices: [{ meterType, existingReading, previousReading }] }`
- **AND** each room always has exactly 2 meter entries: electricity + water

#### Scenario: Previous reading fallback to handover_in
- **WHEN** a room has no monthly reading from the previous period but has a `handover_in` reading
- **THEN** `previousReading` is populated with the `handover_in` reading

#### Scenario: Only occupied rooms returned
- **WHEN** building has a mix of occupied and vacant rooms
- **THEN** only rooms with `status = 'occupied'` are included in the response

### Requirement: Monthly reading workflow ownership
Monthly utility readings SHALL be treated as inputs to a Building + Period billing workflow. Room detail MAY read meter history for context, but SHALL NOT be the primary monthly reading entry point.

#### Scenario: Monthly readings entered from workspace
- **WHEN** user needs to enter readings for a billing period
- **THEN** the UI provides a Building + Period scoped workflow

#### Scenario: Room detail can be read-only
- **WHEN** Room detail displays meter information
- **THEN** it is read-only context and does not become the monthly billing workflow

