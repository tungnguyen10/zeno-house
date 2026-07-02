## MODIFIED Requirements

### Requirement: Invoice issue UI
The billing workspace SHALL let users issue valid invoices from within the draft grid tab via bulk selection and a sticky action bar; the separate `Phát hành` tab is removed.

#### Scenario: Bulk issue from grid
- **WHEN** the user selects one or more rows whose status is `ready` in the `Soạn kỳ` tab
- **THEN** a sticky bottom bar appears showing selected count, total amount, and a primary `Phát hành (N)` action

#### Scenario: Issue confirmation
- **WHEN** the user clicks `Phát hành (N)`
- **THEN** a confirmation modal shows the count, total, and warning that issuing is irreversible per-invoice (only voidable individually)

#### Scenario: Blockers excluded from selection
- **WHEN** a row has a blocker
- **THEN** its row checkbox is disabled with tooltip describing the blocker; bulk select-all only picks rows that are selectable

#### Scenario: Filter pill highlights ready rows
- **WHEN** the user opens the `Soạn kỳ` tab
- **THEN** a filter pill `Sẵn sàng phát hành` is available to scope the grid to rows status=`ready`

#### Scenario: Issue tab removed
- **WHEN** the user opens a billing period workspace
- **THEN** the tab list contains exactly `Soạn kỳ` and `Thu tiền & công nợ`; no `Phát hành` tab is rendered

### Requirement: Payment and debt UI
The billing workspace `Thu tiền & công nợ` tab SHALL support monthly collection tracking with single-action paid + single-action undo, without partial-payment UI or adjustment UI.

#### Scenario: Record payment one-click
- **WHEN** the user clicks `Đã thu` on an issued invoice row
- **THEN** a compact modal pre-fills amount as full balance, defaults date to today, asks for method and optional note, and submits to record payment

#### Scenario: Bulk payment
- **WHEN** the user selects multiple unpaid invoices and clicks `Đã thu hết (N)`
- **THEN** a modal asks for shared date, method, and note; the system records full-balance payments for each selected invoice in one operation and reports per-invoice success/failure

#### Scenario: Undo payment one-click
- **WHEN** the user clicks `Hoàn tác` on a paid invoice row in an open period
- **THEN** the payment is soft-deleted, the invoice returns to `issued` status with updated balance, and a toast confirms; no multi-step confirmation is required at MVP

#### Scenario: Undo unavailable on closed period
- **WHEN** the period is `closed`
- **THEN** the `Hoàn tác` action is hidden or disabled with tooltip indicating the period is locked

#### Scenario: No partial filter pill
- **WHEN** the user opens the filter
- **THEN** the available status filters are `Tất cả`, `Chưa thu`, `Đã thu`, `Quá hạn`; `Một phần` is NOT presented (legacy partial invoices appear under `Chưa thu`)

#### Scenario: No adjustment action
- **WHEN** the user opens the row action menu of a paid invoice
- **THEN** the menu shows `Hoàn tác`, `In`, `Sao mã`; no `Adjustment` / `Cộng thêm` action is available

#### Scenario: Debt list
- **WHEN** invoices have remaining balances
- **THEN** the workspace shows outstanding debt by room/tenant

### Requirement: Correction UI
The billing workspace SHALL expose correction actions according to invoice and period state with a simplified model: void+reissue (unpaid in open period) or undo+void+reissue (paid in open period); closed periods require reopen.

#### Scenario: Pre-issue correction
- **WHEN** invoices have not been issued
- **THEN** the UI lets users correct readings, utility overrides, or billing inputs and the grid recomputes

#### Scenario: Void and reissue visible for unpaid in open period
- **WHEN** an issued invoice has no payments and the period is not closed
- **THEN** the UI offers void/reissue with required reason

#### Scenario: Undo + void + reissue for paid in open period
- **WHEN** a paid invoice in an open period needs correction
- **THEN** the UI guides the user through: undo payment → void invoice → fix source → reissue → record payment
- **AND** all four operations share one `correlation_id` in the audit log

#### Scenario: Reopen required for closed period
- **WHEN** a closed period needs correction
- **THEN** the UI explains the period is closed and prompts the user to reopen with required reason (subject to permission)

### Requirement: Closed period UI
The billing workspace SHALL represent closed periods as totally locked across both tabs.

#### Scenario: Closed period locks both tabs
- **WHEN** the workspace period is closed
- **THEN** `Soạn kỳ` tab readings, overrides, and bulk issue actions are disabled
- **AND** `Thu tiền & công nợ` tab `Đã thu`, `Hoàn tác`, `Huỷ`, `In` (write-affecting actions) are disabled; `In` and read-only views remain available

#### Scenario: Closed banner explains state
- **WHEN** the workspace shows a closed period
- **THEN** a non-dismissible banner at the top of the period view says "Kỳ đã chốt" with a CTA "Mở lại kỳ" gated by permission

### Requirement: Billing tab summaries do not duplicate the strip
Billing workspace tab summaries SHALL NOT repeat metrics that are already on the sticky KPI strip. Tab-internal cues that remain SHALL be either drill-down metrics specific to that tab or inline text.

#### Scenario: Payments tab has no duplicate summary grid
- **WHEN** the user opens the Thu tiền & công nợ tab
- **THEN** the tab does not render its own four-tile summary grid; an inline pill next to the section heading shows the overdue count when it is greater than zero

#### Scenario: Grid tab totals are inline
- **WHEN** the user opens the Soạn kỳ tab
- **THEN** the tab does not repeat strip metrics (Cần đọc, Tổng nháp) and shows the remaining drill-down counts (Sẵn sàng, Có lỗi) as inline text below the section heading

## REMOVED Requirements

### Requirement: Issue remains a separate confirmation tab
**Reason**: Issue is merged into the `Soạn kỳ` tab via bulk-select and sticky action bar; a separate tab adds an unnecessary step. Draft readiness source is unchanged — same blockers gate issue.
**Migration**: Users now click `Phát hành (N)` from the `Soạn kỳ` tab's sticky bottom bar instead of switching to `Phát hành` tab. Documentation updated. `BillingIssueStep.vue` component is removed.

## ADDED Requirements

### Requirement: Auto-issue + pay row action
The `Soạn kỳ` tab SHALL provide an inline `Đã thu` row-action that combines invoice issue and full payment in one atomic operation, gated by a feature flag while in rollout.

#### Scenario: Action visible on ready rows
- **WHEN** a draft row's status is `ready` and the period is not closed
- **THEN** the row's action area includes a primary `Đã thu` button (in addition to existing detail/override actions)

#### Scenario: Modal collects payment details
- **WHEN** the user clicks `Đã thu` on a ready row
- **THEN** a compact modal opens with: room/tenant context, draft total (read-only), date picker (default today), method selector (cash/transfer/other), optional note; submit triggers the `issue_and_pay` operation

#### Scenario: After success, row reflects PAID
- **WHEN** the operation succeeds
- **THEN** the grid row updates in place: status badge changes to `PAID`, draft inputs become read-only, action area changes to `Hoàn tác` / `In` / `→ Thu tiền`

#### Scenario: Feature-flag off
- **WHEN** the deployment feature flag `BILLING_AUTO_ISSUE_ENABLED` is false
- **THEN** the `Đã thu` row-action is hidden; users still issue via the bulk path

### Requirement: Audit log drawer rework
The audit drawer SHALL group events by date, support filtering, search, diff view, and export, replacing the flat-table presentation.

#### Scenario: Group by date
- **WHEN** the drawer opens
- **THEN** events are grouped under headers: `Hôm nay`, `Hôm qua`, `7 ngày qua`, then month groups for older

#### Scenario: Category icons and colors
- **WHEN** events render in the list
- **THEN** each event shows an icon and color tone matching its action category: Tạo (green), Sửa (yellow), Phá (red), Trạng thái (blue), Khác (gray)

#### Scenario: Filter bar
- **WHEN** the user opens filters
- **THEN** filters available: actor (multi-select), action category (multi-chip), date range, ☑ "Chỉ critical" (limits to void / undo / reopen / unissue)

#### Scenario: Free-text search
- **WHEN** the user types in the search input
- **THEN** events are filtered server-side (debounced 300ms) by matching tenant name, invoice code, or amount substring in metadata

#### Scenario: Reading diff view
- **WHEN** an event is `reading.saved` with `previous_value` and `new_value` in metadata
- **THEN** the event row renders an inline diff `1500 → 1520 (+20)` instead of raw JSON

#### Scenario: Correlation grouping
- **WHEN** events share a `correlation_id`
- **THEN** clicking "Xem cùng correlation" on any of them filters the list to only those events with their parent expanded

#### Scenario: Quick action open entity
- **WHEN** an event has an associated entity (invoice, period, reading)
- **THEN** the row includes a `→ Mở` quick action that navigates to that entity

#### Scenario: Pagination / virtualization
- **WHEN** the period has more than 100 audit events
- **THEN** the drawer paginates or virtualizes the list to remain responsive

#### Scenario: Export CSV
- **WHEN** the user clicks `Export CSV`
- **THEN** the drawer downloads a CSV with columns: timestamp, actor email, action, entity type, entity label, summary, correlation_id, metadata (compact JSON)

#### Scenario: Drawer entry point promoted
- **WHEN** the user is on the period workspace
- **THEN** the `Nhật ký` action remains in the `Hành động ▾` menu AND a count badge appears on the menu trigger when there are events in the last 24 hours
