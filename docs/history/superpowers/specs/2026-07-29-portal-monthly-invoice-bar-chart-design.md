# Portal Monthly Invoice Bar Chart Design

## Goal

Change the tenant portal financial overview from a dual-line billed-versus-paid
chart to a single-series bar chart. Each bar represents the total invoice amount
for one billing month.

The change applies only to the tenant portal. It must not alter dashboard charts,
APIs, tenant bootstrap data, or the MapTrack design system.

## User job

Help a tenant quickly compare how much they were billed in each recent month.
Payment progress remains available through the existing `Tỷ lệ đã thanh toán`
insight card rather than as a second chart series.

## Chosen direction

Use one vertical bar per billing period:

- X axis: up to six recent invoice periods in chronological order.
- Y axis: compact VND values.
- Bar value: `TenantInvoiceListItem.totalAmount`.
- Dataset label and external legend: `Tổng hóa đơn theo tháng`.

This is preferred over grouped bars because the chart has one purpose and stays
legible at 320px. Status-colored bars are excluded because color would compete
with the amount comparison and could imply that status changes the metric.
Horizontal bars are excluded because they use more vertical space and weaken
the month-to-month scan.

## Data flow

Continue using `buildPortalFinancialOverview(invoices, limit)`.
`labels` and `totalAmounts` already provide the required chronological monthly
series, so no API, service, repository, DTO, or calculation change is needed.

`paidAmounts` and `paidRatio` remain in the derived overview because the page
still renders `Tỷ lệ đã thanh toán`. The chart no longer consumes
`paidAmounts`.

## Component behavior

`PortalSpendingChart` keeps its existing public props:

- `invoices`
- optional `limit`
- optional `height`

The component switches from `Line` to `Bar` from `vue-chartjs` and changes its
Chart.js types from `line` to `bar`.

The single dataset uses:

- `palette.accent` as the bar fill;
- no literal colors or new CSS variables;
- `borderRadius: 6` and `borderSkipped: 'bottom'` so only the exposed bar end
  reads as rounded;
- `maxBarThickness: 28` so six periods remain airy on mobile;
- the existing portal tooltip surface, border, title, body, and muted roles.

The external legend becomes one concise item, `Tổng hóa đơn theo tháng`.
The visually hidden summary states the displayed period range and that the bars
represent monthly invoice totals.

## Page composition

The section order and title remain unchanged:

1. Latest invoice
2. `Tổng quan tài chính`
3. Quick actions

The two existing insight cards remain:

- `Bình quân mỗi tháng`
- `Tỷ lệ đã thanh toán`

No new card, primitive, token, icon, navigation item, or table is introduced.

## Responsive and accessibility

- Render at most six vertical bars.
- Keep the current full-width chart card and compact 144px default plot height.
- Use compact VND tick labels and full VND tooltip values.
- Preserve the client-only fallback and empty state.
- Preserve the text alternative for screen readers.
- Continue resolving animation duration from `prefers-reduced-motion`.
- Keep all colors sourced from the active portal light/dark theme.

## Accepted behavior update

Update the tenant portal OpenSpec requirement so the chart displays monthly
total invoice values. Remove the obsolete requirement that the chart must
distinguish total and paid series. The average-monthly and paid-ratio insight
requirements remain unchanged.

## Testing

- Update the chart component test to mock `Bar` instead of `Line`.
- Assert one dataset labeled `Tổng hóa đơn theo tháng`.
- Assert the dataset uses `totalAmounts`, bar radius, and maximum thickness.
- Assert the external legend and accessible period summary.
- Preserve empty-state, portal-theme, reduced-motion, page-order, insight-card,
  and showcase coverage.
- Run focused portal tests, OpenSpec validation, typecheck, lint, and the full
  repository suite from an isolated worktree.

## Non-goals

- No paid-value bar or line.
- No remaining-balance stack.
- No status-colored bars.
- No drill-down interaction.
- No API or financial calculation change.
- No dashboard changes.
- No design-system changes.
