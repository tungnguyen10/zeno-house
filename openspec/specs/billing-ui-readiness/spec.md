## Purpose

Defines the UI readiness contract for the billing surface: what primitives, patterns, and status semantics the design system must provide so the `/billing` work queue, the Building + Period workspace, and billing correction flows can be implemented without one-off UI surfaces or bespoke styling.

## Requirements

### Requirement: Billing period list readiness
The design system SHALL provide primitives and patterns sufficient to build `/billing` as a monthly work queue and period list.

#### Scenario: Billing list composition
- **WHEN** `/billing` is implemented
- **THEN** it can be composed from `UiPageHeader`, `UiToolbar`, `UiMetric`, `UiTable`, `UiStatusBadge`, and `UiAlert`

#### Scenario: Billing filters
- **WHEN** `/billing` needs building, period, status, and debt filters
- **THEN** the filters can use standardized select/input/toolbar primitives

#### Scenario: Billing period row
- **WHEN** a billing period row is rendered
- **THEN** it can show status, reading progress, invoice count, issued total, paid total, debt total, and open action without custom row styling

### Requirement: Billing workspace readiness
The design system SHALL provide primitives and patterns sufficient to build the Building + Period workspace.

#### Scenario: Workspace composition
- **WHEN** the billing workspace is implemented
- **THEN** it can be composed from workspace header, tabs, metrics, alerts, tables, and action surfaces from the design system

#### Scenario: Workspace tabs
- **WHEN** billing needs Overview, Readings, Review, Invoices, Payments, and Audit
- **THEN** `UiTabs` supports those steps and active/disabled states

#### Scenario: Review charges
- **WHEN** charge review is implemented
- **THEN** `UiTable`, `UiBadge`, `UiAlert`, and numeric alignment support per-contract line item review

### Requirement: Billing status semantics
The design system SHALL define status labels and variants for billing states.

#### Scenario: Period statuses
- **WHEN** a billing period status is rendered
- **THEN** draft, readings, review, issued, collecting, and closed have Vietnamese labels and consistent semantic variants

#### Scenario: Invoice statuses
- **WHEN** an invoice status is rendered
- **THEN** draft, issued, partial, paid, overdue, and void have Vietnamese labels and consistent semantic variants

#### Scenario: Correction statuses
- **WHEN** correction, adjustment, replacement, blocked, warning, or corrected states are rendered
- **THEN** they use consistent badge/alert variants

### Requirement: Billing correction UI readiness
The design system SHALL support correction and audit workflows without one-off UI surfaces.

#### Scenario: Utility override form
- **WHEN** a meter replacement/reset override form is implemented
- **THEN** the system provides form controls and modal/drawer surface suitable for old reading, new reading, billable usage, reason, and note fields

#### Scenario: Void and reissue
- **WHEN** void/reissue is implemented
- **THEN** the system provides modal/alert/button patterns for destructive confirmation and required reason capture

#### Scenario: Adjustment line
- **WHEN** paid-invoice correction is implemented through an adjustment
- **THEN** the system provides a correction form surface with source context, amount input, reason, and clear save/cancel actions

#### Scenario: Audit list
- **WHEN** billing audit events are displayed
- **THEN** `UiTable` or dense list patterns can show actor, action, entity, timestamp, and metadata summary
