## ADDED Requirements

### Requirement: Meter devices section in room detail
The room detail page SHALL include a "Thiết bị đồng hồ" section below the contracts section.

#### Scenario: Section renders
- **WHEN** navigating to `/rooms/:id`
- **THEN** page includes `<RoomMeterDevices :room-id="id" />` component
