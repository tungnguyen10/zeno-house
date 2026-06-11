## ADDED Requirements

### Requirement: Billing entry route uses the design system
The `/billing` entry route SHALL not remain a raw placeholder UI. It SHALL either be migrated to the established design-system primitives or replaced by the primitive-backed monthly operations entry route.

#### Scenario: Billing placeholder is migrated
- **WHEN** `/billing` remains as a standalone entry page before monthly operations workspace implementation
- **THEN** it uses `UiPageHeader`, `UiToolbar` or primitive form controls, `UiSection`, `UiAlert` where needed, and primitive-backed actions

#### Scenario: Billing placeholder is replaced
- **WHEN** `monthly-operations-workspace` replaces `/billing`
- **THEN** the replacement route uses the billing-ready primitive set and does not copy raw select/card/button markup from the placeholder

### Requirement: Billing-ready compact editing
Billing UI readiness SHALL include compact primitive controls for meter readings, charge review, invoice adjustments, correction reason capture, and payment entry.

#### Scenario: Meter reading entry can use compact controls
- **WHEN** the monthly billing workspace renders a readings table
- **THEN** old reading, new reading, billable usage, replacement/reset flags, and notes can be entered with compact primitive controls

#### Scenario: Charge review can use compact controls
- **WHEN** the monthly billing workspace renders charge review lines
- **THEN** quantities, unit prices, adjustments, and notes can be displayed or edited without custom inline form classes

### Requirement: Billing-ready searchable selection
Billing UI readiness SHALL include searchable selection for high-cardinality subjects such as building, room, tenant, contract, invoice, or billing period when a simple select would be inefficient.

#### Scenario: Searchable billing subject selection
- **WHEN** a billing workflow requires selecting a contract, tenant, room, invoice, or building from many records
- **THEN** it can use the searchable select primitive with loading, empty, disabled, and error states

### Requirement: Billing status context is explicit
Billing UI SHALL use explicit `UiStatusBadge` context for billing period, invoice, and correction statuses when a status key can overlap between domains.

#### Scenario: Period issued status
- **WHEN** a billing period has status `issued`
- **THEN** the badge is rendered with period context so it uses the period label and semantic variant

#### Scenario: Invoice issued status
- **WHEN** an invoice has status `issued`
- **THEN** the badge is rendered with invoice context so it uses the invoice label and semantic variant

#### Scenario: Correction status
- **WHEN** a correction, adjustment, replacement, blocked, warning, or corrected state is shown
- **THEN** the badge or alert uses correction context and the matching semantic variant
