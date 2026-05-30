## ADDED Requirements

### Requirement: Room meter devices section
The room detail page SHALL display a section listing active meter devices for that room, with the ability to add a new device.

#### Scenario: No devices yet
- **WHEN** a room has no meter devices
- **THEN** section shows empty state with a "Thêm thiết bị" button

#### Scenario: Has active devices
- **WHEN** a room has active meter devices
- **THEN** section lists each device with: type (điện/nước), meter_code, start_reading, installed_at, status badge

#### Scenario: Add new device
- **WHEN** admin clicks "Thêm thiết bị" and submits the form
- **THEN** system creates the device and refreshes the list

#### Scenario: Deactivate device
- **WHEN** admin clicks "Ngưng sử dụng" on a device
- **THEN** system sets status=inactive, removed_at=today and removes it from the active list

### Requirement: Contract handover readings section
The contract detail page SHALL display a section for entering handover readings (in/out) per meter device.

#### Scenario: Handover-in readings
- **WHEN** viewing an active contract detail
- **THEN** section shows a row per active meter device in the room, with handover_in reading (existing value or empty input)

#### Scenario: Save handover-in reading
- **WHEN** admin enters a value and saves
- **THEN** system creates/updates a `meter_readings` row with `reading_type = 'handover_in'` for that device and contract's start month

#### Scenario: Handover-out readings
- **WHEN** viewing a terminated/expired contract detail
- **THEN** section also shows handover_out row per device

#### Scenario: No devices in room
- **WHEN** the contracted room has no active meter devices
- **THEN** section shows empty state "Phòng chưa có thiết bị đồng hồ"
