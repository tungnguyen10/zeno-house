## 1. Icons & docs

- [x] 1.1 Add `app/assets/icons/more-vertical.svg` (3 dots vertical, 24×24, `currentColor`)
- [x] 1.2 Add `app/assets/icons/download.svg` (arrow-down into tray, 24×24, `currentColor`)
- [x] 1.3 Update `.github/instructions/images.instructions.md` icon inventory table with `IconMoreVertical` and `IconDownload`

## 2. UiPageHeader primitive (backward-compatible)

- [x] 2.1 Add `backTo?: RouteLocationRaw | string` and `backLabel?: string` props to `app/components/ui/UiPageHeader.vue`
- [x] 2.2 Render `NuxtLink` above the title with `IconArrowLeft` + label when `backTo` is provided; small muted style (`text-xs text-muted hover:text-white`)
- [x] 2.3 Keep the hard-coded `mb-6` on the root `div` — audit showed several callsites (contracts/rooms/buildings edit + buildings index/detail) lack a `space-y-*` parent and rely on it
- [x] 2.4 Update the script-block docstring to document new props
- [x] 2.5 Spot-check the rendered output on at least one existing callsite (e.g. `app/pages/rooms/[code]/index.vue`) — no visual regression because `backTo` is unset

## 3. BillingKpiStrip: 7 → 5 tiles

- [x] 3.1 Refactor `metrics` in `app/components/billing/BillingKpiStrip.vue`:
  - Merge `Hợp đồng` + `Hoá đơn` into one `Quy mô` tile (value `${contractCount} HĐ`, caption `${invoiceCount} hoá đơn`)
  - Collapse `Nháp` into `Đã phát hành` as caption (`Nháp +${formatCurrency(draftTotal)}`)
  - Keep `Chỉ số`, `Đã thu`, `Công nợ`
- [x] 3.2 Change grid classes from `grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7` to `grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5`
- [x] 3.3 Verify `UiMetric` supports the `caption` prop for the two tiles that need it (already used in current code)

## 4. Period page header (`app/pages/billing/[building]/[period].vue`)

- [x] 4.1 Remove `UiStatusBadge` rendering from `#actions`
- [x] 4.2 Remove the description string `"Quản lý nhập chỉ số, soát hoá đơn, phát hành, thanh toán và chốt kỳ."`
- [x] 4.3 Adopt `UiPageHeader`'s new props: `:back-to="'/billing'"` `back-label="Danh sách kỳ"`; remove the `<NuxtLink to="/billing">` button from the action slot
- [x] 4.4 Replace the `…` ghost trigger with a button that shows `IconMoreVertical` + text `Hành động` + `IconChevronDown`
- [x] 4.5 Prefix each dropdown item with its icon (`IconDocument` for Nhật ký, `IconDownload` for Xuất Excel, `IconCheckCircle` for Chốt kỳ, `IconXCircle` for Huỷ phát hành) keeping current `<UiButton>` styling
- [x] 4.6 Ensure the destructive items keep their separator and the `text-rose-400` tint for the Huỷ phát hành label/icon
- [x] 4.7 Remove `actionMenuOpen` toggle markup leftovers if any class strings change

## 5. Strip duplicate KPI grids from tab steps

- [x] 5.1 `app/components/billing/BillingPaymentsStep.vue`: delete the four-tile summary grid (`Tổng phát hành / Đã thu / Còn lại / Quá hạn`). Surface `summary.overdueCount` only when `> 0` as an inline pill in the section header next to "Thanh toán & Công nợ"
- [x] 5.2 `app/components/billing/BillingIssueStep.vue`: delete the entire 3-tile grid (`Có thể phát hành` / `Bị blocker` / `Đã phát hành (bỏ qua)`). Issuable count is implicit from the table + tab badge; blocker count is already surfaced via the existing `UiAlert`; skipped count appears as an inline muted line only when `> 0`
- [x] 5.3 `app/components/billing/BillingDraftGridStep.vue`: delete the four-tile footer grid; render an inline line under the section heading like `Sẵn sàng: N · Có lỗi: M` (text-xs text-muted; collapsed entirely when both are zero)

## 6. Verify & gate

- [x] 6.1 `npm run typecheck` clean
- [x] 6.2 `npm run lint` clean (or no new violations)
- [x] 6.3 `npx vitest run` clean (36 files / 157 tests pass — none assert on removed tiles)
- [ ] 6.4 Manual smoke on `/billing/<building-slug>/<YYYY>-<MM>`:
  - Header shows: back-link above title, no status badge, no description, single "Hành động" menu with icon prefixes
  - Strip shows 5 tiles, no odd trailing row at any breakpoint
  - Each tab content no longer repeats strip numbers; Payments tab pill appears only when overdue > 0
  - Existing menu actions (audit drawer, Excel export, Chốt kỳ, Huỷ phát hành) still work
- [ ] 6.5 Spot-check at least two unrelated pages still using `UiPageHeader` (rooms detail + contracts edit) — no visual regression
- [x] 6.6 `openspec validate billing-period-header-clean --strict` passes
