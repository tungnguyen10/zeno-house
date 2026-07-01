# Tasks

Tách 4 phase để ship dần và dễ revert. Mỗi phase ship được độc lập, không phá luồng cũ.

## Phase A — Audit data foundation (backend additive)

**Mục tiêu**: Mở rộng audit data để Phase C và D có dữ liệu mà render. Không user-facing.

- [x] A1. Migration `correlation_id`
  - [x] Tạo migration `supabase/migrations/<ts>_add_audit_correlation_id.sql` thêm cột `correlation_id uuid null` trên `billing_audit_events`
  - [x] Index `(period_id, correlation_id) where correlation_id is not null`
  - [x] Cập nhật `app/types/database.types.ts` qua `supabase gen types`

- [x] A2. Service emit correlation
  - [x] Helper `server/utils/billing/correlation.ts` export `newCorrelationId()` dùng `uuidv7` (npm `uuidv7`)
  - [x] Sửa `server/services/billing/invoices.ts` (issue path — KHÔNG có file `period-issue.ts`) để bulk issue và adjacent events nhận chung correlation
  - [x] Sửa `server/services/billing/payments.ts` (KHÔNG có file `bulk-payments.ts`) để parent `payments.bulk_recorded` + children `invoice.payment_recorded` share correlation
  - [x] Sửa void + reissue trong `server/services/billing/invoices.ts` để 2 events share correlation

- [x] A3. Bổ sung action codes mới
  - [x] Cập nhật `app/utils/constants/billing.ts` `BILLING_AUDIT_ACTIONS` thêm `payment.undone`, `payment.edited`, `invoice.printed`
  - [x] Cập nhật `server/services/billing/audit-summary.ts` formatter cho 3 code mới
  - [x] Cập nhật `app/utils/format/billing.ts` (nếu có) icon/label client-side
  - [x] Lưu ý: `payment.edited` **không có emit point** trong change này (đã bỏ edit/partial/adjustment flow). Giữ làm **reserved code** (formatter + category map vẫn add cho forward-compat); KHÔNG gắn dạng dead UI trông chờ nó

- [x] A4. `reading.saved` mang diff
  - [x] Xác định nơi emit `reading.saved` hiện tại (`server/services/meter-readings/index.ts` — 3 điểm: create/bulkCreate/update; KHÔNG có file `readings-save.ts`) và nhận `previous_value` từ before-snapshot có sẵn (`existing` / `beforeMap`)
  - [x] Audit metadata schema: `{ previous_value, new_value, unit, reading_date }` qua helper `readingDiffMeta()`; formatter audit-summary render diff `prev → new (Δ)`
  - [x] Test: diff render trong `audit-summary.test.ts` (reading.saved prev→new + count fallback)

- [x] A5. `invoice.printed` emit point
  - [x] Xác định: server-side period export (`export.ts` + `[id]/export.get.ts`) VÀ client print page (`pages/billing/print/[building]/[period].vue` gọi `window.print()`) — KHÔNG dùng `BillingPrintCard.vue` window.print
  - [x] Server-side → emit `invoice.printed` trong `buildPeriodWorkbook` metadata `{ format: 'xlsx', invoice_count }` (entity period)
  - [x] Client → ping endpoint mới `POST /api/billing/periods/[id]/invoices-printed` (batch, 1 event/invoice, share correlation) — đã confirm chọn per-invoice granularity
  - [x] Emit ở mọi entry point với metadata `{ invoice_id, format }` (print) / `{ format, invoice_count }` (xlsx)

- [x] A6. Audit list API filter/search/page
  - [x] Mở rộng `server/api/billing/periods/[id]/audit.get.ts` (convention `[id]`) chấp nhận query: `actor`, `category`, `from`, `to`, `q`, `correlation_id`, `cursor`, `limit`
  - [x] Validator Zod ở `app/utils/validators/billing-audit.ts` (comma-separated actor/category, datetime, cap limit 100)
  - [x] Repository helper `listByPeriodFiltered` build query với index-safe filters (actor/action/range/correlation tại DB); q + cursor/limit ở service sau enrich
  - [x] Map category code → action codes theo design D9 (`BILLING_AUDIT_ACTION_CATEGORY` + `billingAuditActionsForCategories`)
  - [x] Test: `billing-audit-category.test.ts` — category=destructive → void/undo/unissue; reopen→status; create→issued/printed/payments; combine categories

- [x] A7. Period reopen flow (closed → collecting) — **BUILD MỚI, không phải verify**
  - [x] ⚠️ Premise cũ sai: `period.reopened` chỉ có **constant**, chưa từng emit, KHÔNG có endpoint/service. Archive `2026-06-14-monthly-operations-workspace` đã defer reopen. Xem design D11.
  - [x] Service `periods.reopen(periodId, { reason }, user)` trong `server/services/billing/periods.ts` (cạnh `close` / `unissue`): require status `closed`; reason ≥ 10 chữ sau trim; permission `billing.close`; chuyển `closed → collecting`; emit `period.reopened` metadata `{ reason, prior_status, trigger: 'manual' }`
  - [x] Endpoint `server/api/billing/periods/[id]/reopen.post.ts` (theo convention `[id]`)
  - [x] Validator Zod reason (`billingPeriodReopenSchema`, tái dùng pattern của `unissue`)
  - [x] Lỗi: `409 CONFLICT` nếu không `closed`; `422 VALIDATION_ERROR` reason ngắn (assertReason); `403 FORBIDDEN` thiếu quyền `billing.close`
  - [x] Formatter `period.reopened` thêm vào audit-summary.ts
  - [x] Test integration: reopen hợp lệ (→collecting, closed_at null, audit), reason ngắn 422, không quyền/scope 403, period chưa closed 409 (`period-service.test.ts`)

- [x] A8. QA Phase A
  - [x] `npx tsc --noEmit` pass
  - [x] `npx eslint` pass trên toàn bộ file thay đổi ở Phase A (cảnh báo `UiInput.vue` là pre-existing, ngoài scope)
  - [x] Unit test cho `audit-summary.ts` code mới (printed/undone/edited/reopened/reading diff) + category mapping; full suite `429 passed`
  - [ ] ⚠️ MANUAL trước runtime: apply 2 migration trong Supabase dashboard (`20260630120000_add_audit_correlation_id.sql`, `20260630130000_audit_correlation_rpcs.sql`) rồi `supabase gen types`
  - [ ] Smoke audit list pagination: cần dev server + migration đã apply (manual, sau khi DB ready)

## Phase B — Merge tabs (UI re-arrange)

**Mục tiêu**: Bỏ tab "Phát hành", gộp vào "Soạn kỳ" với bulk-select. Không có logic backend mới.

- [x] B1. Refactor `BillingDraftGridStep.vue`
  - [x] Mở rộng `useBillingDraftGridFilters` (hoặc composable selection có sẵn) thêm `issuableSelection` (chỉ row status=ready được select)
  - [x] Thêm sticky bottom bar component `BillingBulkActionBar.vue` (composition: `UiCard` + button + count) — hiện khi `issuableSelection.length > 0`
  - [x] Action "Phát hành (N)" mở confirm modal (reuse `BillingIssueConfirmModal.vue` từ `BillingIssueStep` nếu có)
  - [x] Sau success: clear selection, refetch grid, toast

- [x] B2. Filter pill "Sẵn sàng phát hành"
  - [x] Thêm pill vào `BillingDraftGridFilters` (component / composable hiện tại)
  - [x] Toggle filter rows status=ready

- [x] B3. Sửa `app/pages/billing/[building]/[period].vue`
  - [x] Bỏ entry `issue` khỏi `tabs` computed (giữ `draft-grid` + `payments`)
  - [x] Đơn giản hoá default tab: nếu status ≥ issued → `payments`, else `draft-grid`
  - [x] Cập nhật text các badge tab + label cho 2 tabs

- [x] B4. Promote "Chốt kỳ" ra header
  - [x] Bổ sung primary button "Chốt kỳ" trong `#actions` slot của `UiPageHeader` khi status ∈ {issued, collecting}
  - [x] Disable + tooltip "Còn N hoá đơn chưa thu" khi outstanding > 0
  - [x] Giữ entry trong menu "Hành động ▾" cho consistency

- [x] B5. Lock helper centralized
  - [x] Tạo `app/utils/billing/lock.ts` export `isPeriodLocked(period): boolean` = `period.status === 'closed'`
  - [x] Replace mọi check inline string trong components (`BillingDraftGridStep`, `BillingPaymentsStep`, `BillingChargeBreakdown`, period header)
  - [x] Type-safe: param `Pick<Period, 'status'>`

- [x] B6. Ẩn UI partial / adjustment
  - [x] PaymentsStep: bỏ filter pill `Một phần` khỏi danh sách
  - [x] PaymentsStep: payment modal validate `amount === balance` trước khi submit; remove input field nếu được, hoặc readonly
  - [x] `BillingChargeBreakdown`: prop `showAdjustments?: boolean` default false
  - [x] Row action menu trên invoice paid: bỏ "Adjustment" / "Cộng thêm" entries

- [x] B7. Giữ `BillingIssueStep.vue` 1 release
  - [x] Chưa xoá file (revert safety)
  - [x] Comment 1 dòng `// Deprecated: merged into BillingDraftGridStep — remove after one release.`
  - [x] Đảm bảo file không còn được import ở đâu (typecheck guard)

- [x] B8. QA Phase B
  - [x] `npx tsc --noEmit` pass
  - [x] `npx eslint . --max-warnings 0` pass (changed files)
  - [ ] Manual smoke: mở period draft → select rows ready → bulk Phát hành → verify status update + audit event
  - [ ] Manual smoke: mở period closed → all edits disabled
  - [ ] Visual regression: 2 tabs render đúng KPI strip không trùng

## Phase C — Auto-issue on payment (transactional, flagged)

**Mục tiêu**: 1 click "Đã thu" trên draft row → issue + pay atomic. Kèm undo.

- [x] C1. PL/pgSQL `issue_and_pay`
  - [x] Migration `supabase/migrations/20260630140000_issue_and_pay_rpc.sql`
  - [x] Function signature: `issue_and_pay(p_period_id, p_contract_id, p_actor_id, p_due_date, p_issued_at, p_payment_date, p_payment_method, p_note, p_draft, p_correlation_id) returns setof invoices` (caller passes recomputed draft as `p_draft`, same shape as `issue_period_invoices`)
  - [x] Logic: advisory lock + period FOR UPDATE → validate line-sum==total → insert invoice (status=paid) + charges → insert full-balance payment → advance period→collecting → emit `invoices.issued` + `invoice.payment_recorded` + `period.status_changed` sharing `correlation_id`
  - [x] Error: distinct codes `DRAFT_NOT_READY`, `ALREADY_ISSUED`, `PERIOD_LOCKED` (P0001 + DETAIL.error_code); P0002 for not-found

- [x] C2. REST endpoint
  - [x] `server/api/billing/periods/[id]/issue-and-pay.post.ts` (`contract_id` in body; 404 when flag off)
  - [x] Zod validator `issueAndPaySchema` ở `app/utils/validators/billing-issue-pay.ts`
  - [x] Service `server/services/billing/issue-and-pay.ts` recomputes draft + guards + wraps RPC, maps PL/pgSQL errors → API error envelope
  - [x] Permission guard: `billing.write` (real capability covering issue + payment)
  - [x] Test integration: success path, blocker path, already-issued path, closed-period path, RPC error map, not-found

- [x] C3. UI row-action "Đã thu" trên grid
  - [x] Thêm action vào `BillingDraftGridStep` row action area (render nếu `onAutoIssue` && `row.status === 'ready'` && `!isPeriodLocked` && `runtimeConfig.public.billingAutoIssueEnabled`)
  - [x] Modal compact `BillingAutoIssueModal.vue`: room/tenant context, draft total readonly, date picker, method input, note textarea
  - [x] Submit + optimistic refresh wired via `useBillingPeriodWorkspace.issueAndPay` + page-level `issueAndPayWithToast` (kept in workspace composable instead of a standalone `useAutoIssuePay.ts` — single source of period refresh)
  - [x] Sau success: grid refresh → row reflects PAID

- [x] C4. Undo payment
  - [x] Endpoint `server/api/billing/invoices/[id]/payments/[paymentId].delete.ts`
  - [x] Service `server/services/billing/undo-payment.ts`: soft delete (`deleted_at`, `deleted_by`, `delete_reason`), recompute invoice paid_amount/balance/status from active payments, emit `payment.undone` audit
  - [x] Migration `supabase/migrations/20260630150000_invoice_payments_soft_delete.sql` adds 3 soft-delete columns + partial index
  - [x] Blast radius: ALL `invoice_payments` reads live in `InvoicePaymentRepository` — added `.is('deleted_at', null)` to listByInvoice/listByInvoiceIds/sumByInvoice (+ new findById/softDelete)
  - [x] UI row-action "Hoàn tác" trên payment history trong PaymentsStep (hidden khi period closed)
  - [x] Undo submit wired via `useBillingPeriodWorkspace.undoPayment` + page-level `undoPaymentWithToast` (kept in workspace composable instead of standalone `useUndoPayment.ts`)

- [x] C5. Feature flag
  - [x] Runtime config dưới `runtimeConfig.public.billingAutoIssueEnabled` ở `nuxt.config.ts`
  - [x] Client đọc qua `useRuntimeConfig().public.billingAutoIssueEnabled`
  - [x] Default `false`
  - [x] Endpoint `issue-and-pay` check flag → 404 khi off

- [x] C6. QA Phase C
  - [x] `npx nuxi typecheck` pass
  - [x] `npx eslint` pass on all changed + new files
  - [x] Vitest integration `tests/server/billing/issue-and-pay.test.ts`: success, blocker, already-issued, closed-period, RPC error map, not-found
  - [x] Vitest integration `tests/server/billing/undo-payment.test.ts`: success (→issued), partial recompute, payment-not-on-invoice 404, closed-period block
  - [x] SQL assertion test for `issue_and_pay` migration added to `sql-rls.test.ts`
  - [ ] Manual smoke staging: flow ready row → Đã thu → modal → submit → row PAID → Hoàn tác → row issued lại (requires migrations applied + flag on)

## Phase D — Audit UI rework (frontend only)

**Mục tiêu**: Audit drawer dùng được — group, filter, search, diff, export.

- [x] D1. Refactor `BillingAuditStep.vue`
  - [x] Component split: `BillingAuditDrawer.vue` (container) + `BillingAuditFilterBar.vue` + `BillingAuditList.vue` + `BillingAuditEntry.vue`
  - [x] Composable `useBillingAuditList(periodId)` ở `app/composables/billing/` quản lý filter state, pagination, fetch via API mới (A6)

- [x] D2. Group by date
  - [x] Helper `app/utils/billing/audit-grouping.ts` group events into `{ today, yesterday, last7Days, byMonth[] }`
  - [x] `BillingAuditList` render group headers + entries

- [x] D3. Category mapping + visual
  - [x] Constant `BILLING_AUDIT_CATEGORY_MAP` ở `app/utils/constants/billing.ts` map action → category (theo design D9)
  - [x] Icon + color tone (Tailwind class) per category
  - [x] `BillingAuditEntry` render leading icon + tone background

- [x] D4. Filter bar
  - [x] Multi-select actor (reuse `UiSearchableSelect` với list profiles từ period contributors)
  - [x] Multi-chip category (5 categories)
  - [x] Date range (reuse design system date range component)
  - [x] Toggle "Chỉ critical" — chip selecting `destructive` + `status.reopened` + `status.unissued`

- [x] D5. Free-text search
  - [x] Input debounced 300ms ở filter bar
  - [x] Bind `q` param vào `useBillingAuditList` fetch

- [x] D6. Diff view cho reading.saved
  - [x] `BillingAuditEntry` detect `action === 'reading.saved'` → render inline `<prev> → <new> (<delta>)`
  - [x] Tương tự cho `payment.undone` (before.amount → 0)

- [x] D7. Correlation grouping
  - [x] Mỗi entry có correlation_id → button `Xem cùng correlation`
  - [x] Click → set `correlation_id` vào filter → list rerender chỉ events cùng correlation

- [x] D8. Quick actions
  - [x] Mỗi entry có `entity_type` + `entity_id` → button `→ Mở` link đến entity (invoice / reading / period)
  - [x] Mapping entity → route ở helper `app/utils/billing/audit-entity-link.ts`

- [x] D9. Virtualization / pagination
  - [x] Nếu > 100 events: dùng `useInfiniteScroll` hoặc nút "Tải thêm"
  - [x] Tuỳ chọn: virtual list (vue-virtual-scroller) nếu > 500

- [x] D10. Export CSV
  - [x] Button "Export CSV" trong filter bar header
  - [x] Client-side serialize events đã fetch (không fetch lại từ server)
  - [x] Columns: timestamp, actor email, action, entity_type, entity_label, summary, correlation_id, metadata (compact JSON)
  - [x] File name `audit-<periodSlug>-<yyyy-MM-dd>.csv`

- [x] D11. Drawer entry badge
  - [x] Period header `Hành động ▾` menu trigger: nếu có ≥ 1 audit event trong 24h → badge số đếm
  - [x] Composable `useRecentAuditCount(periodId)` lazy fetch khi period workspace mount

- [x] D12. QA Phase D
  - [x] `npx tsc --noEmit` pass
  - [x] `npx eslint . --max-warnings 0` pass
  - [x] Vitest component test cho `BillingAuditEntry` diff render + correlation button
  - [ ] Manual: open drawer trên period có 50+ events → group hiển thị đúng, filter category=destructive lọc đúng, search "0001" tìm đúng invoice
  - [ ] Export CSV: file mở Excel không vỡ ký tự tiếng Việt (BOM utf-8)
  - [ ] Performance: drawer mở trên period 500+ events < 500ms first paint

## Final cleanup (sau khi 4 phase ship + ổn định)

- [x] X1. Xoá `app/components/billing/BillingIssueStep.vue` (sau 1 release nếu không revert)
  - [x] Xoá component `app/components/billing/BillingIssueStep.vue`
  - [x] Trim `tests/components/billing/BillingActionSafety.spec.ts` — bỏ 2 test BillingIssueStep (component không còn tồn tại), giữ test `BillingCloseStep`
  - [x] `npx nuxi typecheck` pass
- [x] X2. Cập nhật `docs/features/billing.md` mô tả 2-tab flow + auto-issue + undo
- [x] X3. Cập nhật `openspec/project.md` nếu có note về tab count
- [x] X4. `openspec validate simplify-billing-period-workflow --strict` pass
