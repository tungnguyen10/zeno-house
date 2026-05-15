## MODIFIED Requirements

### Requirement: Room detail page
`/rooms/:id` page SHALL display full room info, occupancy section, utility readings panel, **and a "Phí dịch vụ" section** listing active service fee assignments with effective amounts and add/remove controls.

#### Scenario: Service fees section visible in room detail
- **WHEN** admin views room detail
- **THEN** "Phí dịch vụ" section is visible with assigned fees or empty state
