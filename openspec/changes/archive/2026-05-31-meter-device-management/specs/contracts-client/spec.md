## ADDED Requirements

### Requirement: Handover readings section in contract detail
The contract detail page SHALL include a "Số bàn giao" section showing handover readings per meter device.

#### Scenario: Section renders
- **WHEN** navigating to `/contracts/:id`
- **THEN** page includes `<ContractHandoverReadings :contract-id="id" :room-id="contract.room.id" />` component

#### Scenario: Section position
- **WHEN** viewing contract detail
- **THEN** handover readings section appears after the basic info section and before or alongside other tabs
