## ADDED Requirements

### Requirement: Batch generate page
`/invoices/generate` page SHALL provide a form to trigger batch invoice generation: period_start, period_end, electricity_rate, water_rate, building filter (optional). On submit shows a results table with per-room status (success/skipped/error), invoice link for successes, reason for skips/errors. Summary counts shown at top of results.

#### Scenario: Batch form submits and shows results
- **WHEN** admin fills form and clicks generate
- **THEN** results table appears showing per-room status with summary counts

#### Scenario: Success rows link to invoices
- **WHEN** a room is successfully generated
- **THEN** result row has link to the new invoice detail page
