## MODIFIED Requirements

### Requirement: Room detail page
`/rooms/:id` page SHALL display full room info including building name, all fields, occupancy status badge, room assignment section, **and a "Chỉ số điện nước" utility readings panel**. Admin sees edit and delete buttons. The page SHALL also display a read-only "Hợp đồng" section listing all contracts for this room.

#### Scenario: Utility panel visible in room detail
- **WHEN** admin navigates to /rooms/:id
- **THEN** a "Chỉ số điện nước" panel is visible below the assignment section
