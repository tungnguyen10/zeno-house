## MODIFIED Requirements

### Requirement: Room detail page
`/rooms/:id` page SHALL display full room info, occupancy section, utility readings panel, service fees section, **and a "Sinh hóa đơn" button** that opens a generate invoice modal. The page SHALL also show a read-only list of recent invoices for the room with links to invoice detail.

#### Scenario: Generate invoice button visible
- **WHEN** admin views room detail
- **THEN** "Sinh hóa đơn" button is visible in the actions area
