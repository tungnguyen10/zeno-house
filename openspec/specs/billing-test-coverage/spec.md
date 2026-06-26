# billing-test-coverage Specification

## Purpose
Define the billing test baseline: Vitest tooling, deterministic fixtures, focused billing rule coverage, component smoke coverage, and CI coverage enforcement for billing service code.
## Requirements
### Requirement: Test framework
The repository SHALL include a configured Vitest test framework with scripts for run, watch, and coverage modes, integrated into the CI pipeline.

#### Scenario: npm test runs unit suite
- **WHEN** a developer runs `npm test`
- **THEN** Vitest executes all unit and component tests headlessly and exits non-zero on failure

#### Scenario: Watch mode for local dev
- **WHEN** a developer runs `npm run test:watch`
- **THEN** Vitest re-runs affected tests on file change

#### Scenario: Coverage report
- **WHEN** a developer runs `npm run test:coverage`
- **THEN** Vitest produces a v8 coverage report under `coverage/` and prints a summary table

#### Scenario: CI runs tests
- **WHEN** a pull request is opened or updated
- **THEN** the CI pipeline runs `npm run test:coverage` after lint and typecheck steps and fails the build if any test fails or coverage drops below the configured threshold

### Requirement: Draft calculation unit tests
Pure draft calculation logic SHALL be covered by unit tests for rent prorate, discount, electricity modes, water modes, handover fallback, and override metadata.

#### Scenario: Rent prorated by date range
- **WHEN** the contract `start_date` or `end_date` falls inside the period
- **THEN** the rent line is prorated by day count and the test asserts the exact computed amount

#### Scenario: Electricity per_kwh
- **WHEN** the electricity service is `per_kwh` and the reading produces a billable usage of N kWh
- **THEN** the line equals `unit_price * N` and the breakdown lists old reading, new reading, billable usage

#### Scenario: Electricity tiered
- **WHEN** the electricity service is `tiered` with declared brackets
- **THEN** the line equals the sum of bracket amounts and the breakdown lists per-bracket detail

#### Scenario: Electricity fixed
- **WHEN** the electricity service is `fixed`
- **THEN** the line equals the configured fixed amount regardless of reading

#### Scenario: Electricity per_person
- **WHEN** the electricity service is `per_person`
- **THEN** the line equals `unit_price * occupant_count`

#### Scenario: Water per_m3
- **WHEN** the water service is `per_m3`
- **THEN** the line equals `unit_price * billable_usage_m3`

#### Scenario: Water per_person
- **WHEN** the water service is `per_person`
- **THEN** the line equals `unit_price * occupant_count`

#### Scenario: Water fixed_per_room
- **WHEN** the water service is `fixed_per_room`
- **THEN** the line equals the configured fixed-per-room amount

#### Scenario: Handover fallback
- **WHEN** no current meter reading exists for a contract and the contract has a handover reading
- **THEN** the calculation uses the handover reading as old reading and skips electricity/water lines or applies fallback per current rule

#### Scenario: Override block applied
- **WHEN** a meter reading carries `is_replacement` or `is_reset` flags with override block fields
- **THEN** the billable usage is taken from the override block rather than recomputed from raw old/new

### Requirement: Status transition tests
Period and invoice status transitions SHALL be covered by unit tests for happy paths and forbidden transitions.

#### Scenario: Period happy path
- **WHEN** a period transitions `drafted → issued → collecting → closed` via the corresponding service methods
- **THEN** each method updates the status and the assertion confirms the new status plus an audit event was appended

#### Scenario: Period closed is terminal
- **WHEN** any service method other than read is called on a period with status `closed`
- **THEN** the method throws CONFLICT and the test asserts the error code

#### Scenario: Invoice paid recalculation
- **WHEN** payments accumulate to equal the invoice total
- **THEN** the invoice status moves from `partially_paid` (or `issued`) to `paid` after the next status recalc

#### Scenario: Invoice void from issued
- **WHEN** `voidInvoice` is called on an invoice with status `issued` and zero successful payments
- **THEN** the invoice status becomes `void` and the test confirms the audit event includes the reason

#### Scenario: Invoice reissue creates link
- **WHEN** `reissueInvoice` is called on a voided invoice
- **THEN** a new invoice is created with `parent_invoice_id` referencing the voided one and the test asserts the link

### Requirement: Blocker rule tests
Issuance and utility blocker logic SHALL be covered by unit tests.

#### Scenario: Missing electricity reading blocks
- **WHEN** at least one contract has no electricity reading for the period
- **THEN** `findIssuanceBlockers` returns a blocker with a Vietnamese reason indicating missing electricity reading

#### Scenario: Unresolved override blocks
- **WHEN** a meter reading has `requires_override = true` without a saved override block
- **THEN** the blocker list includes that contract with the corresponding reason

#### Scenario: Empty override reason blocks
- **WHEN** a saved override block has an empty or whitespace-only reason
- **THEN** the blocker list includes that contract

#### Scenario: All clear returns empty list
- **WHEN** every contract has valid readings and no override issues
- **THEN** the blocker list is empty

### Requirement: Adjustment validation tests
Invoice adjustment validation SHALL be covered by unit tests for closed-period block, balance constraints, and reason policy.

#### Scenario: Closed period blocks adjustment
- **WHEN** `createAdjustment` is called on an invoice whose period is `closed`
- **THEN** the call throws CONFLICT with a Vietnamese error message

#### Scenario: Negative adjustment cannot exceed paid
- **WHEN** the adjustment amount is negative and absolute value exceeds total paid amount on the invoice
- **THEN** the call throws CONFLICT and the test asserts the error code

#### Scenario: Reason length enforced for significant negative
- **WHEN** the adjustment amount is negative with absolute value at least 100,000 and reason trims to fewer than 10 characters
- **THEN** the call throws VALIDATION_ERROR

#### Scenario: Positive adjustment allowed beyond invoice total
- **WHEN** a positive adjustment is created that increases the invoice total
- **THEN** the call succeeds and the new total reflects the increase

### Requirement: Audit summary formatter tests
The audit summary formatter SHALL be covered by unit tests for every documented action and a fallback case.

#### Scenario: Each action produces expected Vietnamese summary
- **WHEN** the formatter is called with each action documented in the design (period.opened, period.status_changed, period.closed, period.unissued, reading.saved, utility.override_saved, invoices.issued, invoice.voided, invoice.reissued, invoice.adjustment_created, payment.recorded, payments.bulk_recorded, invoice.issue_attempted)
- **THEN** the output matches the expected snapshot string

#### Scenario: Missing optional metadata handled
- **WHEN** the formatter is called with metadata missing optional fields (e.g. `payment_method` for `payment.recorded`)
- **THEN** the output omits the optional clause without throwing

#### Scenario: Unknown action falls back
- **WHEN** the formatter is called with an action not in the formatter map
- **THEN** the output is `Hành động: <action>` and no error is raised

### Requirement: Draft grid component smoke test
The billing draft grid component SHALL have at least one component test demonstrating keyboard navigation and clipboard paste behavior.

#### Scenario: Tab key moves focus to next editable cell
- **WHEN** the test mounts the draft grid with two editable rows and presses Tab from the first cell
- **THEN** focus is on the next editable cell in the same row, asserted via active element

#### Scenario: Paste fills downstream cells
- **WHEN** the test simulates a paste event with multi-line text on a focused new-reading cell
- **THEN** subsequent editable cells in the same column receive the parsed values

### Requirement: Fixture builders
Test fixtures for billing entities SHALL be provided as builder functions with sensible defaults and override support.

#### Scenario: Period builder
- **WHEN** the test calls `buildPeriod({ status: 'issued' })`
- **THEN** the function returns a `BillingPeriod` with the requested status and valid defaults for all other required fields

#### Scenario: Contract builder
- **WHEN** the test calls `buildContract({ rent: 5_000_000 })`
- **THEN** the function returns a contract object with the requested rent and valid defaults

#### Scenario: Reading builder with flags
- **WHEN** the test calls `buildReading({ is_replacement: true, override: {...} })`
- **THEN** the function returns a reading carrying the flags and override block

#### Scenario: Invoice and payment builders
- **WHEN** tests need invoice or payment fixtures
- **THEN** corresponding builders exist and produce valid records

### Requirement: Coverage threshold enforced for billing services
The CI test step SHALL enforce minimum coverage thresholds on billing service code.

#### Scenario: Threshold defined for billing services
- **WHEN** Vitest coverage runs against `server/services/billing/`
- **THEN** the configuration enforces at least branch 70%, function 80%, statement 75% (or values explicitly chosen during implementation, documented in `vitest.config.ts`)

#### Scenario: Coverage failure fails CI
- **WHEN** coverage drops below the configured threshold for billing services
- **THEN** the test step exits non-zero and the CI build fails

### Requirement: Billing consistency regression coverage
The billing test suite SHALL cover shared billable-contract eligibility, required-reading progress, actor enrichment, and async confirmation behavior.

#### Scenario: Eligibility helper covered
- **WHEN** billing service tests run
- **THEN** they assert which contract statuses are included or excluded for a selected period

#### Scenario: Reading progress helper covered
- **WHEN** billing service tests run for meter-based, fixed, and per-person utility pricing
- **THEN** they assert required and complete reading counts match the shared helper behavior

#### Scenario: Confirmation behavior covered
- **WHEN** component tests simulate failed issue or close mutations
- **THEN** they assert modal and selection state are not cleared prematurely

### Requirement: Draft grid refactor regression coverage
The billing test suite SHALL protect draft-grid behavior that is moved into composables or child components.

#### Scenario: Extracted autosave covered
- **WHEN** autosave state is extracted from the draft-grid component
- **THEN** tests cover dirty cell detection, saved-state persistence without refresh, and save failure preserving local values

#### Scenario: Extracted navigation covered
- **WHEN** keyboard navigation or focused-cell paste logic is extracted
- **THEN** tests cover Tab, Enter, Shift modifiers, downstream paste, and read-only row skipping

#### Scenario: Extracted override and expanded row covered
- **WHEN** override or expanded-row rendering is extracted
- **THEN** tests cover override payload construction and discrepancy intent emission

