## Context

Period view hiện ở `app/pages/billing/[building]/[period].vue` dùng 3 tab thông qua `UiTabs` driven bởi `tabs` computed. Tab "Phát hành" disable khi period status ≥ issued/closed; tab "Thanh toán" default khi period status ≥ issued — bản thân code đã ngầm thừa nhận 3 tab không đồng đẳng.

Lock model hiện tại:
- Period status `closed` → khoá ở mức `BillingDraftGridStep.periodEditable` computed.
- Invoice `partial`/`paid` → cản một số action UI (vd dropdown chọn voided invoices); backend cho phép adjustment.
- Adjustment có cả audit code (`invoice.adjustment_created`) và UI riêng trong PaymentsStep.

Audit hiện tại (`BillingAuditStep`): bảng flat 4 cột, JSON raw expand, không filter/search/group. Backend `audit-summary.ts` đã hỗ trợ 14 action codes nhưng `payment.undone` / `payment.edited` / `invoice.printed` chưa có. Bulk payment merge thành 1 event tổng, mất chi tiết per-invoice.

Đã có sẵn endpoint `period.unissued` + `period.reopened` action codes — escape hatch cho destructive operations đã tồn tại.

## Goals / Non-Goals

**Goals:**
- Giảm period view xuống 2 tab; bỏ "Phát hành" như màn hình riêng.
- Auto-issue khi user bấm "Đã thu" trên row nháp — 1 click cho luồng phổ biến nhất.
- Đơn giản hoá lock: chỉ period closed mới khoá; mọi action khác có audit là đủ.
- Audit log trở thành tool thực sự dùng được cho manager (group, filter, search, diff, export).
- Reuse component có sẵn — không tạo abstraction mới khi chưa có 2+ chỗ dùng.

**Non-Goals:**
- Không drop DB columns / data của partial/adjustment. Backend giữ tương thích.
- Không build undo UI trong Audit log entry (rủi ro UX cao — undo phải đi qua entity).
- Không cross-period view ở phase này (đã thuộc proposal `add-invoices-browse-page`).
- Không thay đổi flow trong `app/pages/billing/index.vue` (period list).
- Không animate / transition phức tạp ở rework Audit drawer.

## Decisions

### D1. Phase tách 4 bước trong tasks.md (cùng 1 proposal)

```
Phase A: Audit data (backend-only, additive, low risk)
   ↓ deploy + verify
Phase B: Merge tabs (UI re-arrange, no logic change)
   ↓ deploy + verify
Phase C: Auto-issue on payment (transactional backend, feature-flag)
   ↓ flag-off → staging test → flag-on
Phase D: Audit UI rework (frontend-only)
```

**Vì sao**: Tách phase trong tasks giúp ship dần, dễ revert. Đặt audit data trước (A) vì Phase C đẻ ra `payment.undone` cần audit kịp ghi. Audit UI (D) đợi A xong mới có data để render.

### D2. Auto-issue → `issue_and_pay` RPC, không phải 2 endpoint riêng

**Chọn**: 1 PL/pgSQL function `issue_and_pay(contract_id, period_id, payment_input)` chạy trong 1 transaction, emit 2 audit events cùng `correlation_id`. Endpoint REST wrap mỏng.

**Alternative xét**:
- Frontend gọi 2 endpoint tuần tự (issue rồi pay): nguy hiểm vì fail nửa chừng để lại invoice đã issued nhưng chưa pay; rollback từ client không khả thi.
- Endpoint REST kết hợp 2 service call trong transaction TS-side: phức tạp hơn PL/pgSQL, advisory lock khó hơn; pattern `issue_period_invoices` hiện đang ở PL/pgSQL → giữ nhất quán.

### D3. Undo payment = soft delete + recompute

**Chọn**: `DELETE invoice_payments WHERE id = X` (hoặc soft delete với `deleted_at`), recompute `invoices.paid_amount = sum(remaining payments)`, recompute `invoices.status` theo công thức hiện tại, emit `payment.undone` audit.

**Soft vs hard delete**: Chọn **soft delete** (`deleted_at`, `deleted_by`, `delete_reason`) — giữ được history, audit query bằng JOIN dễ dàng, vẫn có thể "undo undo" nếu cần.

### D4. Partial + adjustment: ẩn UI, giữ backend

**Chọn**: Component vẫn render partial state cho legacy data nhưng:
- Modal "Ghi thanh toán" KHÔNG cho nhập số tiền < tổng (validate UI). Backend vẫn accept (legacy compat).
- Component `BillingChargeBreakdown` ẩn section adjustment khỏi default render; có prop `showAdjustments?: boolean` cho legacy preview (false mặc định).
- Filter pill "Một phần" bỏ khỏi PaymentsStep UI; backend vẫn hỗ trợ filter status=partial.

**Vì sao không drop hẳn**: data hiện tại có thể có partial/adjustment; drop UI mà data còn → render lỗi. Drop hẳn phải đợi 6+ tháng zero usage, qua proposal riêng `cleanup-billing-partial-adjustment-legacy`.

### D5. Lock check: chỉ check period.status === 'closed' ở 1 chỗ

**Chọn**: Tạo helper `isPeriodLocked(period)` trong `app/utils/billing/lock.ts` — chỉ return `period.status === 'closed'`. Mọi component dùng helper này, không tự check status string khắp nơi.

**Vì sao**: Hiện tại có nhiều check rải rác (status === 'issued', status === 'collecting'). Tập trung 1 chỗ giúp future refactor dễ. Backend cũng nên có check tương tự ở service layer.

### D6. Filter pill "Sẵn sàng phát hành" thay tab Phát hành

**Chọn**: Trong tab Soạn kỳ, filter pill "Sẵn sàng" lọc rows status=`ready`. Bottom bar "Phát hành (N)" hiện khi có selection rows ready.

**Alternative xét**:
- Auto-show pill "Sẵn sàng" tự active khi mount: làm ngầm filter, user dễ nhầm "không có dữ liệu". Bỏ.
- Tab Phát hành thành modal: thử lần đầu, nhưng modal phải có search + chi tiết blockers → quá nặng. Bỏ.

### D7. Header CTA "Chốt kỳ" promote ra ngoài

**Chọn**: Hiện "Chốt kỳ" trong menu "Hành động ▾". Promote thành nút primary ngoài header khi period status ∈ {issued, collecting} và outstanding == 0. Khi outstanding > 0, vẫn hiện nhưng disabled với tooltip "Còn N hoá đơn chưa thu".

### D8. Audit drawer width và mode

**Chọn**: Giữ drawer (không promote thành full page). Tăng width sm:w-[52rem]; nội dung group + filter + virtualize.

**Vì sao**: Promote thành tab thứ 3 mâu thuẫn mục tiêu "giảm tab". Promote thành full page tách context — user mất trạng thái period view. Drawer enrich là sweet spot.

### D9. Audit action category mapping

Mapping cố định (cho icon + color + filter):
```
Tạo (green):    invoices.issued, invoice.payment_recorded,
                payments.bulk_recorded, invoice.printed
Sửa (yellow):   reading.saved, utility_override.saved,
                payment.edited, invoice.adjustment_created
Phá (red):      invoice.voided, payment.undone,
                period.unissued
Trạng thái (blue): period.opened, period.closed, period.reopened,
                   period.status_changed
Khác (gray):    invoice.issue_attempted, invoice.reissued
```

### D10. correlation_id sử dụng UUID v7 (time-ordered)

**Chọn**: UUID v7 cho dễ debug — sort by id gần như sort by time. Field `correlation_id UUID NULL` trên `billing_audit_events`.

**Use cases**:
- `void` + `reissue` chia sẻ correlation_id → audit drawer group lại như 1 entry
- `issue_and_pay`: `invoices.issued` + `invoice.payment_recorded` chia sẻ
- `payments.bulk_recorded`: 1 parent + N children chia sẻ

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Auto-issue transaction phức tạp, fail edge cases khó debug | PL/pgSQL với advisory lock + invariant check; test integration kỹ; feature flag `BILLING_AUTO_ISSUE_ENABLED` mặc định off; staging chạy ≥ 1 tuần trước khi default on |
| Undo payment trên invoice đã issued nhiều ngày → khách đã đối soát, sai biên lai | Audit log đủ thông tin để truy; manager tự chịu trách nhiệm; v0.x không thêm friction (sẽ track usage; nếu > X% undo sau 24h → add confirm + reason) |
| Bỏ UI adjustment làm user mất khả năng xử lý case "khách đòi lại tiền điện sai" | Document workflow workaround: tạo invoice tháng sau có line item "Bù tháng trước" thủ công; nếu phổ biến → đề xuất proposal riêng "credit note" |
| Bỏ UI partial → khách trả nhiều lần khó track | Document: chờ thu đủ rồi bấm "Đã thu"; cộng số tiền ngoài hệ; v0.x persona chấp nhận trade-off |
| Phase C feature flag default off → ship Phase B trước thì user thấy Soạn kỳ có bulk Phát hành nhưng không có inline "Đã thu" | Acceptable — Phase B đã là cải thiện so với hiện tại; inline "Đã thu" là enhancement |
| Audit metadata diff cho `reading.saved` cần đọc previous value khi save → thêm 1 query | Acceptable cost; previous value đã được fetch ở grid response, có thể truyền vào payload save |
| `correlation_id` migration: existing rows NULL → group view bị "lẻ" | OK — chỉ events mới có correlation; old data hiển thị độc lập như cũ |
| Promote "Chốt kỳ" ra ngoài header → user vô tình bấm | Confirm modal hiện có giữ nguyên; thêm warning "Sẽ khoá toàn bộ thao tác trong kỳ" |
| `BillingIssueStep` remove → import vẫn còn ở `[period].vue` → typecheck fail | Cleanup theo task order; có thể keep file 1 phase trước khi remove hẳn |

## Migration Plan

**Phase A — Audit data** (backend additive):
1. Migration thêm cột `correlation_id UUID NULL`.
2. Service emit action codes mới ở các trigger điểm (printed: từ print endpoint; undone: ở DELETE payment endpoint, đẻ sau Phase C).
3. `reading.saved` payload bổ sung `previous_value`.
4. `payments.bulk_recorded` viết child events cùng correlation.
5. Audit list API bổ sung filter/search/page params (UI tận dụng ở D).
6. Ship — không user-facing.

**Phase B — Merge tabs** (frontend re-arrange):
1. Refactor `BillingDraftGridStep` integrate bulk-select + sticky action bar (reuse logic từ `BillingIssueStep`).
2. Remove tab "Phát hành" khỏi `tabs` computed; default tab logic đơn giản hoá.
3. Filter pill "Sẵn sàng" thêm.
4. Update spec `billing-client` "Invoice issue UI" → integrated requirement.
5. Keep `BillingIssueStep.vue` file (chưa remove) phòng cần revert nhanh.
6. Ship — feature complete, không phá luồng nào.

**Phase C — Auto-issue** (transactional, flagged):
1. PL/pgSQL `issue_and_pay` migration.
2. Endpoint REST + service.
3. UI row-action "Đã thu" trên grid, gated by feature flag.
4. Endpoint `undo_payment` + UI button "Hoàn tác".
5. Feature flag default off; staging A/B ≥ 1 tuần.
6. Flag-on cho production.

**Phase D — Audit UI rework** (frontend):
1. Refactor `BillingAuditStep` với group/filter/search.
2. Diff view cho reading.saved.
3. Quick action mỗi entry.
4. Virtualize + pagination.
5. Export CSV.
6. Ship.

**Rollback per phase**:
- A: drop column (nếu cần), revert service emit code. Data tự xoá theo CASCADE nếu set ON DELETE rules.
- B: revert frontend PR; `BillingIssueStep.vue` còn nguyên → restore tab.
- C: flag off; nếu PL/pgSQL có bug → drop function (chấp nhận data đã commit là final).
- D: revert frontend PR; audit drawer về flat table cũ.

## Open Questions

- "Chốt kỳ" mặc định disable khi outstanding > 0 hay vẫn cho phép với warning? **Tao đề xuất**: disable + tooltip — giảm misclick. Cần confirm ở spec.
- Undo payment trên kỳ status `collecting` luôn OK; nhưng nếu khoảng cách thời gian > X ngày (vd 30) → có nên thêm friction? **Đề xuất**: phase 1 không; chỉ log + audit.
- Audit export CSV → format thế nào (rộng — chi tiết kỹ thuật, hay hẹp — readable)? **Đề xuất**: 2 cột bonus `metadata_json` cho export rộng; default readable.
- Print action có cần required `print_target` (in-house printer / PDF / email)? **Đề xuất**: phase 1 chỉ ghi log "đã in", không tracking target.
