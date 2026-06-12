## MODIFIED Requirements

### Requirement: Billing workspace readiness
The design system SHALL provide primitives and patterns sufficient to build the Building + Period workspace using a streamlined three-tab information architecture: a sticky KPI strip at the top, three primary work tabs, and overflow surfaces (drawer + header overflow action) for reference and rare actions.

#### Scenario: Workspace composition
- **WHEN** the billing workspace is implemented
- **THEN** it can be composed from `UiPageHeader` (with header overflow button and drawer trigger button), a sticky KPI strip below the header, `UiTabs` for three primary tabs, `UiSection` for tab content, and action surfaces from the design system

#### Scenario: Workspace primary tabs
- **WHEN** the billing workspace renders top-level tabs
- **THEN** there are exactly three tabs in the order: `Chỉ số & hoá đơn nháp`, `Phát hành`, `Thanh toán & công nợ` — and `UiTabs` supports their active/disabled states with reasons

#### Scenario: Sticky KPI strip
- **WHEN** the billing workspace renders below `UiPageHeader`
- **THEN** a sticky KPI strip composed of `UiMetric` (or equivalent compact metric primitives) is visible across every tab and stays pinned during vertical scroll

#### Scenario: Audit drawer
- **WHEN** the user opens the audit log from the workspace header
- **THEN** the audit list is presented inside `UiDrawer` (right-side overlay) rather than a tab, preserving the active work tab underneath

#### Scenario: Close period from header overflow action
- **WHEN** an admin user clicks the workspace header overflow action
- **THEN** the action opens a close-period confirmation modal � there is no dedicated close-period tab

#### Scenario: Review charges
- **WHEN** charge review is implemented inside the `Chỉ số & hoá đơn nháp` tab
- **THEN** `UiTable`, `UiBadge`, `UiAlert`, and numeric alignment support per-contract line item review

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

## ADDED Requirements

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

## REMOVED Requirements

<!-- No removals: existing requirements (period list readiness, status context, searchable selection, compact editing, billing entry route) remain unchanged. -->
