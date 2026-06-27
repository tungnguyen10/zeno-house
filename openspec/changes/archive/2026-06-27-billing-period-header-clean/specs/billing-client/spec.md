## ADDED Requirements

### Requirement: Billing period workspace header is minimal
The billing period workspace header SHALL surface only the period title, primary action menu, and back navigation. It SHALL NOT repeat status metadata that is already discoverable on the billing period list, and SHALL NOT carry a description that merely enumerates the tabs.

#### Scenario: No status badge in period header
- **WHEN** a user opens `/billing/[building]/[period]`
- **THEN** the `UiPageHeader` SHALL NOT render a `UiStatusBadge`; the period status is conveyed by the list view and by tab-internal locked-state messaging

#### Scenario: Back-link via UiPageHeader prop
- **WHEN** the period workspace renders
- **THEN** the back-link to `/billing` SHALL be rendered via `UiPageHeader`'s `backTo`/`backLabel` props (rendered above the title with an arrow-left icon), not as a manually-placed button inside the `#actions` slot

#### Scenario: Icon-prefixed action menu
- **WHEN** the period workspace exposes period-level actions (Nhật ký, Xuất Excel, Chốt kỳ, Huỷ phát hành kỳ)
- **THEN** the actions live behind a single "Hành động" menu whose trigger uses a kebab icon and a visible text label, and each menu item is prefixed by an icon
- **AND** destructive items (Chốt kỳ, Huỷ phát hành) are visually separated and tinted to convey caution

### Requirement: Billing sticky KPI strip is compact
The sticky KPI strip on a billing period page SHALL surface no more than 5 tiles and SHALL lay out evenly at all responsive breakpoints used by the admin shell.

#### Scenario: Five-tile strip
- **WHEN** the period overview is loaded
- **THEN** the strip renders exactly: (1) a Quy mô tile combining contract and invoice counts, (2) a Chỉ số tile, (3) an Đã phát hành tile with draft total as caption, (4) an Đã thu tile, (5) a Công nợ tile

#### Scenario: Even responsive grid
- **WHEN** the strip is rendered at small/medium/large viewports
- **THEN** the grid uses `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` so columns divide evenly without an odd trailing row

### Requirement: Billing tab summaries do not duplicate the strip
Billing workspace tab summaries SHALL NOT repeat metrics that are already on the sticky KPI strip. Tab-internal cues that remain SHALL be either drill-down metrics specific to that tab or inline text.

#### Scenario: Payments tab has no duplicate summary grid
- **WHEN** the user opens the Thanh toán & công nợ tab
- **THEN** the tab does not render its own four-tile summary grid; an inline pill next to the section heading shows the overdue count when it is greater than zero

#### Scenario: Issue tab has no duplicate summary grid
- **WHEN** the user opens the Phát hành tab
- **THEN** the tab does not render a multi-tile KPI grid; the issuable count is conveyed by the table and tab badge, the blocker count is surfaced by the existing warning alert when greater than zero, and the skipped count appears as a single inline muted line above the table only when greater than zero

#### Scenario: Grid tab totals are inline
- **WHEN** the user opens the Chỉ số & hoá đơn nháp tab
- **THEN** the tab does not repeat strip metrics (Cần đọc, Tổng nháp) and shows the remaining drill-down counts (Sẵn sàng, Có lỗi) as inline text below the section heading

## MODIFIED Requirements

### Requirement: Billing UI uses operational design system
The billing entry page and workspace SHALL be built from the adopted operational design-system primitives and patterns. Billing pages SHALL NOT introduce raw form controls, raw tables, raw alert blocks, or billing-only duplicate primitives unless the exception is documented.

#### Scenario: Billing entry page composition
- **WHEN** a user opens `/billing`
- **THEN** the page uses `UiPageHeader`, `UiToolbar`, `UiMetric`, `UiTable`, `UiStatusBadge`, `UiAlert`, `UiSkeleton`, and `UiEmptyState` according to the state being rendered

#### Scenario: Workspace composition
- **WHEN** a user opens a billing workspace
- **THEN** the workspace uses `UiPageHeader` (with `backTo`/`backLabel` for back navigation), `UiTabs`, `UiSection`, `UiMetric`, `UiTable`, `UiAlert`, and primitive-backed actions for the end-to-end monthly flow

#### Scenario: Dense editable billing rows
- **WHEN** readings, charge review, adjustment, or payment rows require editable fields
- **THEN** they use compact `UiInput`, `UiSelect`, or `UiTextarea` controls rather than raw inline input classes

#### Scenario: Searchable billing selection
- **WHEN** a billing workflow requires selecting a high-cardinality building, room, tenant, contract, invoice, or related subject
- **THEN** it uses the searchable select primitive from the design system rather than a billing-specific custom dropdown

#### Scenario: Billing status badge context
- **WHEN** period, invoice, or correction statuses are displayed
- **THEN** `UiStatusBadge` is rendered with the correct context so overlapping status keys use the correct label and semantic variant

#### Scenario: Raw billing UI exception documented
- **WHEN** a raw `input`, `select`, `textarea`, `table`, or `button` remains in billing pages/components
- **THEN** the implementation documents why the design-system primitive cannot cover it yet and what follow-up is needed
