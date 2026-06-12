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
The design system SHALL provide primitives and patterns sufficient to build the Building + Period workspace using a streamlined three-tab information architecture: a sticky KPI strip at the top, three primary work tabs, and overflow surfaces (drawer + header overflow action) for reference and rare actions.

#### Scenario: Workspace composition
- **WHEN** the billing workspace is implemented
- **THEN** it can be composed from `UiPageHeader` (with header overflow button and drawer trigger button), a sticky KPI strip below the header, `UiTabs` for three primary tabs, `UiSection` for tab content, and action surfaces from the design system

#### Scenario: Workspace primary tabs
- **WHEN** the billing workspace renders top-level tabs
- **THEN** there are exactly three tabs in the order: `Chỉ số & hoá đơn nháp`, `Phát hành`, `Thanh toán & công nợ`, and `UiTabs` supports their active/disabled states with reasons

#### Scenario: Sticky KPI strip
- **WHEN** the billing workspace renders below `UiPageHeader`
- **THEN** a sticky KPI strip composed of `UiMetric` (or equivalent compact metric primitives) is visible across every tab and stays pinned during vertical scroll

#### Scenario: Audit drawer
- **WHEN** the user opens the audit log from the workspace header
- **THEN** the audit list is presented inside `UiDrawer` (right-side overlay) rather than a tab, preserving the active work tab underneath

#### Scenario: Close period from header overflow action
- **WHEN** an admin user clicks the workspace header overflow action
- **THEN** the action opens a close-period confirmation modal, and there is no dedicated close-period tab

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
- **THEN** the system provides a correction form surface with source context, amount input, reason, and clear save/cancel actions; the reference invoice selector SHALL use a searchable select populated with issued invoices in the period rather than raw UID input

#### Scenario: Audit list inside drawer
- **WHEN** billing audit events are displayed
- **THEN** `UiTable` or dense list patterns inside `UiDrawer` can show `actorName`, action, `entityLabel`, timestamp, and `summary` without raw UUID exposure in primary columns

### Requirement: UiDrawer primitive
The design system SHALL provide a `UiDrawer` primitive used for right-side overlay surfaces such as the billing audit log.

#### Scenario: Drawer renders right-side overlay
- **WHEN** `UiDrawer` is opened
- **THEN** it slides in from the right with a backdrop, supports a configurable width on desktop and full width on mobile, and exposes `header` / `default` / `footer` slots

#### Scenario: Drawer accessibility
- **WHEN** `UiDrawer` is open
- **THEN** it sets `role="dialog"`, `aria-modal="true"`, traps focus, and closes on Esc or backdrop click

#### Scenario: Drawer composes with billing audit
- **WHEN** `UiDrawer` is used to host the billing audit list
- **THEN** the audit table renders without bespoke styling and uses standard density and primitives

### Requirement: Workspace header overflow action pattern
The design system SHALL document and support a header overflow action pattern in `UiPageHeader` for rare or destructive actions that should not occupy primary tab slots.

#### Scenario: Header overflow action surfaces rare actions
- **WHEN** a workspace has actions used at most once per session (e.g. `Chốt kỳ`, future `Hủy phát hành kỳ`)
- **THEN** they can be placed behind an icon-only header overflow affordance from the page header without creating a dedicated tab; when several actions exist, the affordance can graduate to `UiDropdownMenu` or equivalent

#### Scenario: Header overflow action respects permissions
- **WHEN** the current user lacks the capability for a header overflow action (e.g. `billing.close`)
- **THEN** the action is hidden or rendered disabled with a permission reason tooltip

### Requirement: Toast notification host
The design system SHALL provide a toast notification host and a `useToast` composable used to surface mutation success and failure states.

#### Scenario: Toast on mutation success
- **WHEN** a billing mutation (issue, payment, void, reissue, adjustment, override) completes successfully
- **THEN** a non-blocking toast renders with severity `success` and a Vietnamese message

#### Scenario: Toast on mutation failure
- **WHEN** a billing mutation fails with a server error
- **THEN** a toast renders with severity `danger` and the server error message (or a fallback when not available)

#### Scenario: Toast positioning
- **WHEN** toasts render on desktop
- **THEN** they appear top-right and stack vertically; on mobile they appear bottom-center

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

