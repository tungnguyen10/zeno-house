# Portal Financial Overview Design

## Goal

Adapt the information hierarchy from the supplied mobile analytics reference into the tenant portal home without copying its visual system. The portal keeps MapTrack colors, typography, spacing, radii, elevation, light/dark behavior, and navigation unchanged.

## User job

Help a tenant answer two questions from the home screen:

1. How have my invoice totals and payments changed across recent billing periods?
2. What is my typical monthly cost and how much of the recent total has been paid?

## Chosen direction

Use a single financial overview block built from one wide dual-line chart followed by two compact insight cards. Do not add the reference image's table, extra navigation, notification chrome, gradients, or additional dashboard widgets.

The section sits after the latest-invoice statement and before quick actions:

1. Identity and active room
2. Latest invoice
3. Financial overview
4. Quick actions

## Data and calculations

Use only `TenantInvoiceListItem[]` already returned by the tenant bootstrap. No API, service, repository, database, or DTO changes are required.

The chart uses up to six newest invoices, ordered chronologically:

- `Tổng hóa đơn`: `totalAmount`
- `Đã thanh toán`: `paidAmount`

The total line is solid with a restrained accent fill. The paid line is dashed
without fill so fully paid periods remain distinguishable when both values
overlap.

The insight cards use the same displayed periods:

- `Bình quân mỗi tháng`: sum of `totalAmount` divided by the number of displayed invoices.
- `Tỷ lệ đã thanh toán`: sum of `paidAmount` divided by sum of `totalAmount`, clamped to `0–100%`. When the total is zero, display `0%`.

Voided invoices remain governed by the existing tenant invoice list behavior; the presentation does not invent additional filtering.

## Components

### `PortalSpendingChart`

Evolve the existing component from one total-amount line into two named series. Preserve its public inputs (`invoices`, `limit`, `height`) and empty fallback so existing showcase usage stays compatible.

The component owns:

- chronological period labels;
- chart datasets and accessible text summary;
- tooltip formatting;
- responsive chart height;
- reduced-motion behavior.

### Portal chart theme adapter

Add a portal-only chart theme composable that resolves the existing
`--portal-*` CSS variables from the active `.portal-shell`. It exposes accent,
accent-soft, positive, border, deep surface, title, body, and muted roles. It
must react when the portal theme changes and provide concrete color strings to
Chart.js.

It must not modify `useChartTheme()`, which remains the dashboard chart contract. It must not duplicate MapTrack color values or introduce new tokens.

### Home composition

The home page composes the chart with existing `PortalCard` surfaces and two compact insight cards. The insight cards are page composition, not new primitives.

## Visual behavior

- Use the existing MapTrack accent for `Tổng hóa đơn`.
- Use the existing positive color for `Đã thanh toán`.
- Use existing portal border, surface, title, body, muted, and elevation tokens for axes, grid, tooltip, and cards.
- Keep the legend short and outside the canvas.
- Use tabular currency treatment already provided by the portal.
- Avoid moralizing increases or decreases; the two cards report neutral facts.
- Do not add new colors, fonts, radii, shadows, tokens, or animation styles.

## Responsive and accessibility

- The chart is one full-width block. The two insight cards stay in a
  `minmax(0, 1fr)` two-column grid at 320px and use compact currency formatting
  so labels and values do not clip.
- The chart displays at most six X-axis labels and uses compact VND formatting.
- The chart has a concise text alternative describing both series across the displayed period range.
- Tooltip content includes the series label and formatted currency.
- With fewer than two invoices, the home keeps the current behavior and omits the overview.
- Chart animation resolves to zero when `prefers-reduced-motion: reduce` is active.
- Loading continues to use the existing statement skeleton.

## Error and empty states

The section relies on the portal bootstrap status:

- pending: existing home skeleton behavior;
- fewer than two invoices: section omitted;
- two or more invoices: chart and insights rendered;
- client-only chart fallback: existing portal skeleton surface.

No additional error card is added because the home already treats bootstrap failure at the page/composable boundary.

## Testing

- Unit-test the chart data contract: chronological order, two datasets, limit, labels, and payment calculations.
- Unit-test the portal chart theme adapter against dark and light portal CSS variables and theme changes.
- Page contract test: financial overview appears before quick actions, uses existing portal primitives, and contains the two insight labels.
- Preserve the development showcase contract.
- Run focused portal tests, typecheck, lint, and the relevant OpenSpec validation.

## Non-goals

- No expense-category breakdown.
- No charge aggregation or API expansion.
- No dashboard changes.
- No new design-system primitives or tokens.
- No table of historical invoices on the home page.
- No pixel copying from the reference image.
