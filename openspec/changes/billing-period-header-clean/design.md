## Context

`UiPageHeader` is shared by ~10 detail/edit pages. The current API exposes only `title`, `description`, default slot, and `#actions` slot — leaving back-navigation, status metadata, and overflow menus to ad-hoc markup inside each page's action slot. The billing period page is the most extreme case: the slot stacks a status badge, a `…` text button, and a `← Danh sách kỳ` link, each visually inconsistent.

Sticky `BillingKpiStrip` shows 7 numeric tiles always. Three tab summaries (`BillingPaymentsStep`, `BillingIssueStep`, `BillingDraftGridStep`) each render their own metric grids that duplicate strip values — verified during exploration:

| Source | Duplicated tiles |
| --- | --- |
| Payments tab summary (4 tiles) | 3 of 4 (Tổng phát hành, Đã thu, Còn lại) duplicate strip |
| Issue tab summary (4 tiles) | 1 of 4 (Tổng dự kiến) duplicates strip's Nháp |
| Grid tab footer (4 tiles) | 2 of 4 (Cần đọc, Tổng nháp) duplicate strip |

## Goals / Non-Goals

**Goals**
- Visually clean, scannable period workspace; eliminate KPI duplication.
- Compact, evenly-sized sticky strip that lays out predictably at all breakpoints.
- Clear, icon-led page header actions; back-navigation distinct from action set.
- Keep `UiPageHeader` API backward-compatible — no callsite must change unless it opts in.

**Non-Goals**
- Touching other pages that use `UiPageHeader` (only billing period page adopts new prop in this change).
- Reworking billing API, schemas, or tab navigation logic.
- Replacing the sticky strip with a fundamentally different summary surface (e.g., collapsible drawer).
- Adding tests beyond what exists; this is UI polish only.

## Decisions

### 1. Extend `UiPageHeader` with optional back-link instead of writing a separate `UiDetailHeader`

Adding `backTo` + `backLabel` props (both optional) keeps the primitive count the same and unlocks the pattern for every detail page. The default behaviour with no props is byte-identical to today.

**Alternatives considered**
- Separate `UiDetailHeader` component → splits the mental model; pages would have to choose between two near-identical headers.
- Slot named `#back` → more flexible but requires every callsite to know markup for the link; less ergonomic than a prop.

### 2. Single action menu with text label `"Hành động"` + kebab icon

The current `…` text button is ambiguous. Options were (a) replace with kebab icon only, (b) expose every action as its own icon button, (c) keep a single menu with both icon and text label.

**Chosen: (c)** — `[IconMoreVertical] Hành động [IconChevronDown]`. Rationale:
- Header keeps to one visual action surface; doesn't compete with title.
- Menu items get icon prefixes so users scan them visually.
- Destructive items (Chốt kỳ, Huỷ phát hành) live behind a separator and use rose tint — the menu acts as a soft "confirm step" for irreversible work.

### 3. Sticky strip nén từ 7 → 5 thẻ

Seven is awkward to grid; `xl:grid-cols-7` only works ≥1280px. At 982px (default content width) the strip becomes 2 rows × 4+3, which is what the user flagged as "không đều".

**Chosen layout**: `grid-cols-2 md:grid-cols-3 lg:grid-cols-5`. Five divides evenly at all common content widths.

**Information consolidation**
- `Hợp đồng` + `Hoá đơn` → one `Quy mô` tile (`N HĐ` with `M hoá đơn` caption). Both numbers stay visible but only spend one column.
- `Nháp` collapses into `Đã phát hành` as a caption (`Nháp +X ₫`). The two are conceptually paired (pre-issue vs post-issue totals).
- `Chỉ số`, `Đã thu`, `Công nợ` stay as standalone tiles — they are the most actionable.

### 4. Giữ `mb-6` cứng trong `UiPageHeader`

Initial plan considered removing the hard-coded `mb-6` so parent `space-y-*` controls spacing. Audit revealed several detail/edit pages (`contracts/[code]/edit.vue`, `rooms/[code]/edit.vue`, `buildings/[id]/index.vue`, `buildings/index.vue`, etc.) wrap the header in a plain `<div>` with no `space-y-*` parent and rely on the header's own `mb-6` for separation. Removing it would create a visual regression on multiple unrelated pages. Decision: keep `mb-6`. The slight margin-collapse with billing's `space-y-5` parent is 24px (max of mb-6 vs mt-5), which is acceptable.

### 5. Quá hạn → pill inline, không phải tile

In `BillingPaymentsStep`, only "Quá hạn" is genuinely new information versus the strip. Promoting it from a 1-of-4 tile to an inline pill next to the section header (visible only when count > 0) reduces vertical noise to zero in the common case (no overdue).

### 6. Grid tab footer → inline text under section heading

`Sẵn sàng` and `Có lỗi` are tab-internal cues, not period KPIs. Two cards at the bottom of a long table is wasteful; one short inline line (`Sẵn sàng: N · Có lỗi: M`) keeps the information without claiming a row.

## Risks / Trade-offs

| Risk | Mitigation |
| --- | --- |
| Other pages relying on the `mb-6` of `UiPageHeader` lose intended spacing. | Kept the `mb-6`; only added the optional back-link affordance. No existing callsite is touched. |
| `Quy mô` tile combining HĐ + hoá đơn may confuse users who expect separate numbers. | Both numbers remain visible (one as value, one as caption). If feedback says it's worse, splitting back is a one-line revert. |
| Overflow menu with icon prefixes may not align cleanly with current ghost button styling. | Use existing dark-card menu styling already in `[period].vue`; icons stay at `w-4 h-4 shrink-0` aligned left. |
| New SVG icons (`more-vertical`, `download`) must use `currentColor` and standard 24×24 viewBox or Tailwind text color won't apply. | Author both following existing convention (e.g. `refresh.svg`); add to icon inventory doc. |
| Removing duplicate metric grids may break a future feature relying on those exact DOM nodes. | They are page-internal display only; no test currently asserts their presence. |

## Migration Plan

Single PR. No data migration. Rollout strategy:
1. Add icons + extend `UiPageHeader` (backward-compatible). No visible change yet.
2. Refactor `BillingKpiStrip` to 5-tile layout. Visible change on every billing period page.
3. Refactor `[period].vue` header (adopt `backTo`, remove status badge + description, swap menu trigger).
4. Strip duplicate KPI grids from `BillingPaymentsStep`, `BillingIssueStep`, `BillingDraftGridStep`.
5. Update icon inventory doc.

Rollback: revert PR — no schema, no API, no data migration.

## Open Questions

None — all clarified during exploration with the user.
