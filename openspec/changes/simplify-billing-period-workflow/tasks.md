# Tasks

Tách 4 phase để ship dần và dễ revert. Mỗi phase ship được độc lập, không phá luồng cũ.

## Phase A — Audit data foundation (backend additive)

**Mục tiêu**: Mở rộng audit data để Phase C và D có dữ liệu mà render. Không user-facing.

- [ ] A1. Migration `correlation_id`
  - [ ] Tạo migration `supabase/migrations/<ts>_add_audit_correlation_id.sql` thêm cột `correlation_id uuid null` trên `billing_audit_events`
  - [ ] Index `(period_id, correlation_id) where correlation_id is not null`
  - [ ] Cập nhật `app/types/database.types.ts` qua `supabase gen types`

- [ ] A2. Service emit correlation
  - [ ] Helper `server/utils/billing/correlation.ts` export `newCorrelationId()` dùng `uuidv7` (npm `uuidv7`)
  - [ ] Sửa `server/services/billing/invoices.ts` (issue path — KHÔNG có file `period-issue.ts`) để bulk issue và adjacent events nhận chung correlation
  - [ ] Sửa `server/services/billing/payments.ts` (KHÔNG có file `bulk-payments.ts`) để parent `payments.bulk_recorded` + children `invoice.payment_recorded` share correlation
  - [ ] Sửa void + reissue trong `server/services/billing/invoices.ts` để 2 events share correlation

- [ ] A3. Bổ sung action codes mới
  - [ ] Cập nhật `app/utils/constants/billing.ts` `BILLING_AUDIT_ACTIONS` thêm `payment.undone`, `payment.edited`, `invoice.printed`
  - [ ] Cập nhật `server/services/billing/audit-summary.ts` formatter cho 3 code mới
  - [ ] Cập nhật `app/utils/format/billing.ts` (nếu có) icon/label client-side
  - [ ] Lưu ý: `payment.edited` **không có emit point** trong change này (đã bỏ edit/partial/adjustment flow). Giữ làm **reserved code** (formatter + category map vẫn add cho forward-compat); KHÔNG gắn dạng dead UI trông chờ nó

- [ ] A4. `reading.saved` mang diff
  - [ ] Xác định nơi emit `reading.saved` hiện tại (`server/services/billing/drafts.ts` hoặc service readings tương đương — KHÔNG có file `readings-save.ts`) và nhận `previous_value` từ payload hoặc tự fetch trước update
  - [ ] Audit metadata schema: `{ previous_value, new_value, unit, reading_date }`
  - [ ] Test integration: save 1 reading → metadata có previous + new

- [ ] A5. `invoice.printed` emit point
  - [ ] Xác định print/export hiện tại: server-side (`server/services/billing/export.ts` + `[id]/export.get.ts`) hay client-only (`BillingPrintCard.vue` gọi `window.print()`)
  - [ ] Nếu server-side → emit `invoice.printed` ngay tại endpoint export
  - [ ] Nếu client-only → cần ping endpoint mới (vd `POST /api/billing/invoices/[id]/printed`) để emit (không budget sẵn trong design — confirm trước khi làm)
  - [ ] Emit ở mọi entry point với metadata `{ invoice_id, format }`

- [ ] A6. Audit list API filter/search/page
  - [ ] Mở rộng `server/api/billing/periods/[id]/audit.get.ts` (convention `[id]`, KHÔNG `[periodId]`) chấp nhận query: `actor`, `category`, `from`, `to`, `q`, `correlation_id`, `cursor`, `limit`
  - [ ] Validator Zod ở `app/utils/validators/billing-audit.ts`
  - [ ] Repository helper `server/repositories/billing-audit.ts` build query với index-safe filters
  - [ ] Map category code → action codes theo design D9
  - [ ] Test: filter category=destructive trả về void/undo/reopen/unissue; q="0001" trả về events có invoice_code match

- [ ] A7. Period reopen flow (closed → collecting) — **BUILD MỚI, không phải verify**
  - [ ] ⚠️ Premise cũ sai: `period.reopened` chỉ có **constant**, chưa từng emit, KHÔNG có endpoint/service. Archive `2026-06-14-monthly-operations-workspace` đã defer reopen. Xem design D11.
  - [ ] Service `periods.reopen(periodId, { reason }, user)` trong `server/services/billing/periods.ts` (cạnh `close` / `unissue`): require status `closed`; reason ≥ 10 chữ sau trim; permission `billing.close`; chuyển `closed → collecting`; emit `period.reopened` metadata `{ reason, prior_status, trigger: 'manual' }`
  - [ ] Endpoint `server/api/billing/periods/[id]/reopen.post.ts` (theo convention `[id]`)
  - [ ] Validator Zod reason (tái dùng pattern của `unissue`)
  - [ ] Lỗi: `409 NOT_CLOSED` nếu không `closed`; `400 VALIDATION_ERROR` reason ngắn; `403 FORBIDDEN` thiếu quyền
  - [ ] Test integration: reopen hợp lệ, reason ngắn bị chặn, không quyền 403, period chưa closed 409

- [ ] A8. QA Phase A
  - [ ] `npx tsc --noEmit` pass
  - [ ] `npx eslint . --max-warnings 0` pass
  - [ ] Unit test cho `audit-summary.ts` 3 code mới
  - [ ] Smoke: chạy `scripts/billing-readability-smoke.mjs` (hoặc tạo mới) verify audit list pagination

## Phase B — Merge tabs (UI re-arrange)

**Mục tiêu**: Bỏ tab "Phát hành", gộp vào "Soạn kỳ" với bulk-select. Không có logic backend mới.

- [ ] B1. Refactor `BillingDraftGridStep.vue`
  - [ ] Mở rộng `useBillingDraftGridFilters` (hoặc composable selection có sẵn) thêm `issuableSelection` (chỉ row status=ready được select)
  - [ ] Thêm sticky bottom bar component `BillingBulkActionBar.vue` (composition: `UiCard` + button + count) — hiện khi `issuableSelection.length > 0`
  - [ ] Action "Phát hành (N)" mở confirm modal (reuse `BillingIssueConfirmModal.vue` từ `BillingIssueStep` nếu có)
  - [ ] Sau success: clear selection, refetch grid, toast

- [ ] B2. Filter pill "Sẵn sàng phát hành"
  - [ ] Thêm pill vào `BillingDraftGridFilters` (component / composable hiện tại)
  - [ ] Toggle filter rows status=ready

- [ ] B3. Sửa `app/pages/billing/[building]/[period].vue`
  - [ ] Bỏ entry `issue` khỏi `tabs` computed (giữ `draft-grid` + `payments`)
  - [ ] Đơn giản hoá default tab: nếu status ≥ issued → `payments`, else `draft-grid`
  - [ ] Cập nhật text các badge tab + label cho 2 tabs

- [ ] B4. Promote "Chốt kỳ" ra header
  - [ ] Bổ sung primary button "Chốt kỳ" trong `#actions` slot của `UiPageHeader` khi status ∈ {issued, collecting}
  - [ ] Disable + tooltip "Còn N hoá đơn chưa thu" khi outstanding > 0
  - [ ] Giữ entry trong menu "Hành động ▾" cho consistency

- [ ] B5. Lock helper centralized
  - [ ] Tạo `app/utils/billing/lock.ts` export `isPeriodLocked(period): boolean` = `period.status === 'closed'`
  - [ ] Replace mọi check inline string trong components (`BillingDraftGridStep`, `BillingPaymentsStep`, `BillingChargeBreakdown`, period header)
  - [ ] Type-safe: param `Pick<Period, 'status'>`

- [ ] B6. Ẩn UI partial / adjustment
  - [ ] PaymentsStep: bỏ filter pill `Một phần` khỏi danh sách
  - [ ] PaymentsStep: payment modal validate `amount === balance` trước khi submit; remove input field nếu được, hoặc readonly
  - [ ] `BillingChargeBreakdown`: prop `showAdjustments?: boolean` default false
  - [ ] Row action menu trên invoice paid: bỏ "Adjustment" / "Cộng thêm" entries

- [ ] B7. Giữ `BillingIssueStep.vue` 1 release
  - [ ] Chưa xoá file (revert safety)
  - [ ] Comment 1 dòng `// Deprecated: merged into BillingDraftGridStep — remove after one release.`
  - [ ] Đảm bảo file không còn được import ở đâu (typecheck guard)

- [ ] B8. QA Phase B
  - [ ] `npx tsc --noEmit` pass
  - [ ] `npx eslint . --max-warnings 0` pass
  - [ ] Manual smoke: mở period draft → select rows ready → bulk Phát hành → verify status update + audit event
  - [ ] Manual smoke: mở period closed → all edits disabled
  - [ ] Visual regression: 2 tabs render đúng KPI strip không trùng

## Phase C — Auto-issue on payment (transactional, flagged)

**Mục tiêu**: 1 click "Đã thu" trên draft row → issue + pay atomic. Kèm undo.

- [ ] C1. PL/pgSQL `issue_and_pay`
  - [ ] Migration `supabase/migrations/<ts>_issue_and_pay_rpc.sql`
  - [ ] Function signature: `issue_and_pay(p_contract_id uuid, p_period_id uuid, p_payment_date date, p_method text, p_note text, p_actor uuid) returns invoices`
  - [ ] Logic: advisory lock (cùng pattern `issue_period_invoices`) → validate ready → insert invoice + lines → insert payment full balance → update invoice status → emit 2 audit events sharing `correlation_id` (uuidv7 generated in function)
  - [ ] Error: raise distinct error codes `DRAFT_NOT_READY`, `ALREADY_ISSUED`, `PERIOD_LOCKED`

- [ ] C2. REST endpoint
  - [ ] `server/api/billing/periods/[id]/issue-and-pay.post.ts` (convention `[id]`; `contract_id` truyền trong body, khớp proposal `periods/<id>/issue-and-pay.post.ts`)
  - [ ] Zod validator `IssueAndPayInputSchema` ở `app/utils/validators/billing-issue-pay.ts`
  - [ ] Service `server/services/billing/issue-and-pay.ts` wrap RPC, map PL/pgSQL errors → API error envelope
  - [ ] Permission guard: `billing.issue` + `billing.payment.write`
  - [ ] Test integration: success path, blocker path, already-issued path, closed-period path

- [ ] C3. UI row-action "Đã thu" trên grid
  - [ ] Thêm action vào `BillingDraftGridStep` row action area (chỉ render nếu `row.status === 'ready'` && `!isPeriodLocked` && `featureFlag.autoIssue`)
  - [ ] Modal compact `BillingAutoIssueModal.vue`: room/tenant context, draft total readonly, date picker, method selector, note textarea
  - [ ] Composable `useAutoIssuePay.ts` ở `app/composables/billing/` quản lý submit + optimistic update + error handling
  - [ ] Sau success: grid row update inplace status `PAID`, action area chuyển sang Hoàn tác/In/→ Thu tiền

- [ ] C4. Undo payment
  - [ ] Endpoint `server/api/billing/invoices/[id]/payments/[paymentId].delete.ts` (khớp proposal + convention `invoices/[id]/payments.*` đã có; KHÔNG dùng `invoice-payments/[paymentId]`)
  - [ ] Service `server/services/billing/undo-payment.ts`: soft delete (`deleted_at`, `deleted_by`, `delete_reason`), recompute invoice paid_amount/balance/status, emit `payment.undone` audit
  - [ ] Migration thêm 3 columns soft-delete trên `invoice_payments` (đã verify: **chưa có** trong `database.types.ts` → chắc chắn cần)
  - [ ] Blast radius: grep MỌI nơi đọc `invoice_payments` (`server/api/billing/invoices/[id]/payments.get.ts`, `bulk-payments.post.ts`, recompute trong `services/billing/payments.ts`) thêm `.is('deleted_at', null)`
  - [ ] UI row-action "Hoàn tác" trên invoice paid trong PaymentsStep + grid (sau auto-issue success)
  - [ ] Composable `useUndoPayment.ts` — 1 click, toast confirm; optional reason (chưa required MVP)

- [ ] C5. Feature flag
  - [ ] Runtime config `BILLING_AUTO_ISSUE_ENABLED` ở `nuxt.config.ts` — **PHẢI đặt dưới `runtimeConfig.public`** (client cần đọc để gate row-action; private config không tới client → nút không bao giờ render)
  - [ ] Client đọc qua `useRuntimeConfig().public.billingAutoIssueEnabled`
  - [ ] Default `false`; staging deploy `true` để test ≥ 1 tuần
  - [ ] Endpoint `issue-and-pay` cũng check flag (server đọc từ `runtimeConfig.public` hoặc private mirror) — flag off → 404 (không phải 503, tránh leak)

- [ ] C6. QA Phase C
  - [ ] `npx tsc --noEmit` pass
  - [ ] `npx eslint . --max-warnings 0` pass
  - [ ] Vitest integration `tests/server/billing/issue-and-pay.test.ts`: success, blocker, already-issued, closed-period, concurrent
  - [ ] Vitest integration undo-payment: success, closed-period block, undo deleted payment 404
  - [ ] Manual smoke staging: flow ready row → Đã thu → modal → submit → row PAID → Hoàn tác → row issued lại

## Phase D — Audit UI rework (frontend only)

**Mục tiêu**: Audit drawer dùng được — group, filter, search, diff, export.

- [ ] D1. Refactor `BillingAuditStep.vue`
  - [ ] Component split: `BillingAuditDrawer.vue` (container) + `BillingAuditFilterBar.vue` + `BillingAuditList.vue` + `BillingAuditEntry.vue`
  - [ ] Composable `useBillingAuditList(periodId)` ở `app/composables/billing/` quản lý filter state, pagination, fetch via API mới (A6)

- [ ] D2. Group by date
  - [ ] Helper `app/utils/billing/audit-grouping.ts` group events into `{ today, yesterday, last7Days, byMonth[] }`
  - [ ] `BillingAuditList` render group headers + entries

- [ ] D3. Category mapping + visual
  - [ ] Constant `BILLING_AUDIT_CATEGORY_MAP` ở `app/utils/constants/billing.ts` map action → category (theo design D9)
  - [ ] Icon + color tone (Tailwind class) per category
  - [ ] `BillingAuditEntry` render leading icon + tone background

- [ ] D4. Filter bar
  - [ ] Multi-select actor (reuse `UiSearchableSelect` với list profiles từ period contributors)
  - [ ] Multi-chip category (5 categories)
  - [ ] Date range (reuse design system date range component)
  - [ ] Toggle "Chỉ critical" — chip selecting `destructive` + `status.reopened` + `status.unissued`

- [ ] D5. Free-text search
  - [ ] Input debounced 300ms ở filter bar
  - [ ] Bind `q` param vào `useBillingAuditList` fetch

- [ ] D6. Diff view cho reading.saved
  - [ ] `BillingAuditEntry` detect `action === 'reading.saved'` → render inline `<prev> → <new> (<delta>)`
  - [ ] Tương tự cho `payment.undone` (before.amount → 0)

- [ ] D7. Correlation grouping
  - [ ] Mỗi entry có correlation_id → button `Xem cùng correlation`
  - [ ] Click → set `correlation_id` vào filter → list rerender chỉ events cùng correlation

- [ ] D8. Quick actions
  - [ ] Mỗi entry có `entity_type` + `entity_id` → button `→ Mở` link đến entity (invoice / reading / period)
  - [ ] Mapping entity → route ở helper `app/utils/billing/audit-entity-link.ts`

- [ ] D9. Virtualization / pagination
  - [ ] Nếu > 100 events: dùng `useInfiniteScroll` hoặc nút "Tải thêm"
  - [ ] Tuỳ chọn: virtual list (vue-virtual-scroller) nếu > 500

- [ ] D10. Export CSV
  - [ ] Button "Export CSV" trong filter bar header
  - [ ] Client-side serialize events đã fetch (không fetch lại từ server)
  - [ ] Columns: timestamp, actor email, action, entity_type, entity_label, summary, correlation_id, metadata (compact JSON)
  - [ ] File name `audit-<periodSlug>-<yyyy-MM-dd>.csv`

- [ ] D11. Drawer entry badge
  - [ ] Period header `Hành động ▾` menu trigger: nếu có ≥ 1 audit event trong 24h → badge số đếm
  - [ ] Composable `useRecentAuditCount(periodId)` lazy fetch khi period workspace mount

- [ ] D12. QA Phase D
  - [ ] `npx tsc --noEmit` pass
  - [ ] `npx eslint . --max-warnings 0` pass
  - [ ] Vitest component test cho `BillingAuditEntry` diff render + correlation button
  - [ ] Manual: open drawer trên period có 50+ events → group hiển thị đúng, filter category=destructive lọc đúng, search "0001" tìm đúng invoice
  - [ ] Export CSV: file mở Excel không vỡ ký tự tiếng Việt (BOM utf-8)
  - [ ] Performance: drawer mở trên period 500+ events < 500ms first paint

## Final cleanup (sau khi 4 phase ship + ổn định)

- [ ] X1. Xoá `app/components/billing/BillingIssueStep.vue` (sau 1 release nếu không revert)
- [ ] X2. Cập nhật `docs/features/billing.md` mô tả 2-tab flow + auto-issue + undo
- [ ] X3. Cập nhật `openspec/project.md` nếu có note về tab count
- [ ] X4. `openspec validate simplify-billing-period-workflow --strict` pass
