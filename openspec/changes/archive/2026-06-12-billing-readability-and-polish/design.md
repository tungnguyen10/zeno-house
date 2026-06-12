## Context

`monthly-operations-workspace` đã giao bộ khung billing đầy đủ: 6 bảng DB, 7 service, 7 repo, 6 step UI, draft grid hoàn thiện 95% chức năng. Khi user thử trên máy thật, phát hiện 2 nhóm vấn đề chặn production:

- **Readability**: `BillingPaymentsStep` render `{{ row.contractId }}` (UUID) ở cột "Hợp đồng"; `BillingAuditStep` render `{{ row.actorId }}` UUID ở cột "Người thực hiện" và `metadata` dump dạng `due_date=…, invoice_ids=…, issued_count=2`. Không ai đọc được.
- **Information architecture**: 6 tab trộn lẫn 3 vai trò (thông tin / hành động / tham chiếu). Tab `Tổng quan` chỉ là KPI read-only — bấm tab thì không còn ở chỗ đang làm việc; tab `Nhật ký` mất context tab đang xem khi bấm vào; `Chốt kỳ` chỉ click 1 lần / kỳ mà chiếm 1 slot tab.

Pattern enrichment đã có sẵn ở `BillingDraftGridRow` (có `tenantName`, `roomNumber`, `contractCode`) và `BillingPeriodSummary` (có `buildingName`). Tức là nhóm code biết cách làm — chỉ là quên áp cho `Invoice`/`BillingAuditEvent`/`InvoicePayment`.

Constraint: `monthly-operations-workspace` chưa archive. Change này phải đặt sau khi nó archive HOẶC viết delta trên `billing-ui-readiness` (đã có trong main specs).

## Goals / Non-Goals

**Goals:**
- Mọi cột chính trong UI (Hợp đồng, Người thực hiện, Đối tượng audit) hiển thị tên người + số phòng + label thay UUID.
- Mọi audit row có cột "Chi tiết" đọc được như câu Việt, không phải dump key-value.
- Workspace từ 6 tab xuống 3 tab. Sticky KPI luôn hiện. Nhật ký mở/đóng không rời page.
- Không thay đổi schema DB — thuần enrichment + IA refactor.
- Giữ raw UID trong DTO để có thể click vào audit/payment row → navigate hoặc copy debug info.

**Non-Goals:**
- Không snapshot tên người/entity vào DB (giữ lazy resolver). Nếu sau này cần "audit là historical fact", chuyển sang snapshot bằng migration thêm cột `actor_name_snapshot` v.v. — out of scope.
- Không thêm filter / pagination cho audit (xử lý ở change power-features hoặc phase sau).
- Không tạo i18n framework — câu Việt hardcode trong formatter.
- Không thay đổi flow nghiệp vụ (issue/void/reissue/adjustment/payment) — chỉ render/IA.

## Decisions

### D1 — Resolver-on-list (lazy enrichment), không snapshot

Lựa chọn:
- **A. Snapshot lúc append**: `audit.append()` truyền sẵn `actor_name`, `entity_label` vào row. 0 join lúc đọc, append-site phức tạp, audit là "historical fact" giữ tên cũ kể cả khi đổi tên.
- **B. Resolve lúc list (chosen)**: list endpoint join thêm. N event → 3-5 batch query (gom theo entity_type). Append site đơn giản. Tên đổi → audit hiện tên mới.
- **C. Lai**: snapshot tên + resolve link động.

Chọn **B** vì:
- v1 mỗi period vài chục audit event, batch query rẻ.
- Append site đã có 11+ chỗ trong service, đụng vào hết là risk regression.
- Migration 0 cột mới → triển khai nhanh, dễ rollback.
- Sau này muốn chuyển C: thêm cột snapshot, list ưu tiên snapshot, fallback resolve. Backward-compatible.

### D2 — Shape DTO enriched

`Invoice`:
```ts
interface Invoice {
  // ... fields cũ giữ nguyên (id, contractId, roomId, tenantId, status, amounts, ...)

  // THÊM (server enrich)
  tenantName: string | null
  roomNumber: string | null
  contractCode: string | null  // hợp đồng có code/short id user-facing nếu có
}
```

`InvoicePayment`:
```ts
interface InvoicePayment {
  // ... fields cũ
  recordedByName: string | null
}
```

`BillingAuditEvent`:
```ts
interface BillingAuditEvent {
  // ... fields cũ (id, action, entityType, entityId, actorId, metadata, ...)

  // THÊM
  actorName: string | null
  actorEmail: string | null         // tooltip
  entityLabel: string | null        // "Hoá đơn P01 · Võ Chí Linh"
  entitySubLabel: string | null     // "06/2026 · 1.500.000đ"
  entityHref: string | null         // /billing/X/2026-06 hoặc null nếu entity bị xoá
  summary: string                   // "Phát hành 2 hoá đơn, hạn 25/06/2026"
}
```

Field cũ (`actorId`, `entityId`, `metadata`) giữ nguyên cho navigation, copy debug, advanced view.

### D3 — Summary formatter là pure function ở server

Đặt tại `server/services/billing/audit-summary.ts`:
```ts
export function formatAuditSummary(action: string, metadata: Record<string, unknown>): string
```

Switch theo `action`. Mỗi action có format Việt riêng. Fallback "Hành động: <action>" khi không khớp.

Test được dễ (pure function). Khi cần đổi câu chữ, chỉ sửa 1 chỗ, không phải đụng append site.

Examples:
| Action | Summary |
|---|---|
| `period.opened` | "Mở kỳ vận hành" |
| `period.status_changed` | "Đổi trạng thái: {from} → {to}" |
| `period.closed` | "Chốt kỳ vận hành" |
| `reading.saved` | "Lưu {count} chỉ số" |
| `utility.override_saved` | "Ghi đè chỉ số {meterType}, lý do {reason}" |
| `invoices.issued` | "Phát hành {issued_count} hoá đơn{', hạn ' + due_date if due_date}" |
| `invoice.voided` | "Huỷ hoá đơn — {reason}" |
| `invoice.reissued` | "Phát hành lại hoá đơn" |
| `invoice.adjustment_created` | "Tạo điều chỉnh {label} {amount}đ" |
| `payment.recorded` | "Ghi thu {amount}đ{' bằng ' + payment_method if payment_method}" |
| `invoice.issue_attempted` | "Thử phát hành — {blocked_count} hoá đơn bị chặn" |

### D4 — Workspace IA mới: 3 tab + sticky KPI + drawer + header overflow

Layout:
```
┌─ UiPageHeader ──────────────────────────────────┐
│ Kỳ 06/2026 — Tan Binh   [status]  [⋯] [Nhật ký] │
└─────────────────────────────────────────────────┘
┌─ Sticky KPI strip ──────────────────────────────┐
│ Chỉ số 12/12 │ Sẵn sàng 12 │ Lỗi 0 │ Đã PH 24M  │
└─────────────────────────────────────────────────┘
┌─ UiTabs ────────────────────────────────────────┐
│ [Chỉ số & hoá đơn nháp] [Phát hành] [TT&CN]     │
└─────────────────────────────────────────────────┘
┌─ Tab content (full width) ──────────────────────┐
│ ...                                              │
└─────────────────────────────────────────────────┘
```

Component đổi:
- `app/pages/billing/[building]/[period].vue` — sticky strip + tabs gọn + header overflow + nút mở drawer
- `BillingOverviewStep.vue` → reuse logic làm sticky strip component (`BillingKpiStrip.vue`); component cũ có thể xoá hoặc ngừng dùng
- `BillingAuditStep.vue` → render bên trong drawer (component giữ nguyên, chỉ đổi nơi mount)
- `BillingCloseStep.vue` → render bên trong modal mở từ header overflow

header overflow action (đề xuất):
- "Chốt kỳ" (admin only, disable nếu không đủ điều kiện đóng)
- "Mở nhật ký" (alternative cho nút bên cạnh)
- Sau này: "Hủy phát hành kỳ" (cấp ở change `billing-power-features`)

### D5 — UiDrawer primitive mới

Cần thêm primitive `UiDrawer` (right-side overlay):
- Width: `w-96` desktop, full screen mobile
- Backdrop click hoặc Esc đóng
- Slot `header` (title + close button), `default` (body), `footer` (actions)
- Aria: `role="dialog"`, `aria-modal="true"`, focus trap khi mở
- Animation: slide-in từ phải, 200ms

Reuse cho audit drawer trong change này, sau này có thể dùng cho invoice detail, override modal full-form, ...

### D6 — Toast notification

Cần composable `useToast()` hoặc reuse `UiAlert` floating. Đề xuất: tạo `UiToastHost` mount ở root layout + composable `useToast({ severity, message })`. Không tự xây framework — chỉ wrapper đủ dùng.

Trigger toast ở các mutation:
- Phát hành: "Đã phát hành N hoá đơn"
- Ghi thu: "Đã ghi {amount}đ cho hoá đơn {label}"
- Huỷ HĐ: "Đã huỷ hoá đơn"
- Phát hành lại, điều chỉnh, override: tương tự
- Lỗi server: severity `danger`, message từ `error.message`

### D7 — Adjustment modal: select invoice thay vì gõ UID

Hiện tại `reference_invoice_id` là text input UID. Thay bằng `UiCombobox` với options là danh sách invoice đã phát hành của period (label: "{room} · {tenant} · {amount}đ"). Optional (cho phép null) vì adjustment không bắt buộc reference.

### D8 — Discrepancy callout: hướng dẫn manager khi draft ≠ issued

**Vấn đề:** Sau khi override điện/nước, draft total đổi (vd `3.638.000đ`) nhưng invoice đã phát hành giữ nguyên (vd `3.725.000đ`) vì rule immutable. Manager không biết phải làm gì → tưởng "override không ăn".

**Quyết định:** Render callout trong row expanded của `BillingDraftGridStep` khi:
- Hợp đồng có `existingInvoice` (status không phải `void`)
- `|draft.draftTotal − existingInvoice.totalAmount| ≥ 1.000đ` (threshold tránh noise do làm tròn)

Component mới `BillingDraftDiscrepancyCallout.vue`:
- Severity `warning`.
- Title: "Draft mới khác hoá đơn đã phát hành".
- Body: "Hoá đơn hiện tại {issued}đ — Draft sau override {draft}đ — Chênh **{delta:+}đ**".
- 2 CTA primary (chỉ khi `period.status` không phải `closed`):
  - **Tạo điều chỉnh** — emit `intent:adjustment` với `{ invoiceId, amount: -delta, label: "Điều chỉnh do override tiêu thụ" }`. Page parent chuyển tab `payments`, mở adjustment modal pre-fill.
  - **Hủy + Phát hành lại** — emit `intent:void-reissue` với `{ invoiceId }`. Page chuyển tab `payments`, mở void modal; sau khi void thành công, toast hint "Vào tab Chỉ số & hoá đơn nháp để phát hành lại".
- Rule disable CTA:
  - Invoice có ≥ 1 successful payment → disable "Hủy + Phát hành lại" (server đã chặn, UI cảnh báo trước). Tooltip: "Hoá đơn đã có thanh toán, dùng Điều chỉnh".
  - Invoice paid đủ → vẫn cho phép Adjustment (giảm thì hoàn/giữ làm prepaid; tăng thì khách phải thu thêm).

**Vị trí render:** Trong `BillingDraftGridStep.vue` — row expand panel, sát section warnings, trên section lines table. Khi không có `existingInvoice` hoặc delta < 1.000đ → component không render gì.

**Tính delta ở client:** Dùng `draft.draftTotal` và `existingInvoice.totalAmount` trên `BillingDraftGridRow`. Server vẫn expose `existingInvoice: { id, totalAmount, paidAmount, status } | null` trên `BillingDraftInvoice`, rồi `BillingDraftGridService` chuyển field này sang row model để callout có đủ context ngay trong expanded row.

**Không tự động hoá:** Không có nút "Tự động đồng bộ" — luôn yêu cầu manager confirm hành động (adjustment hay void+reissue) vì có ý nghĩa nghiệp vụ với khách thuê.

## Risks / Trade-offs

- **[Lazy resolver làm chậm list endpoint]** → Mitigation: batch query gom theo entity_type, tổng 3-5 query thêm; không gọi N+1; cache trong cùng request bằng Map.
- **[Tên đổi thì audit cũ hiện tên mới — mất tính "fact at time"]** → Mitigation: ghi vào risk log, sau này nếu cần chuyển snapshot model thì không phá API cũ. v1 ưu tiên consistency UI.
- **[3 tab có thể không đủ cho phase sau khi power-features thêm bulk/unissue]** → Mitigation: header overflow action đã chuẩn bị slot. Bulk select không cần tab riêng. Unissue đặt vào header overflow. Không cần thêm tab.
- **[UiDrawer chưa có trong design system]** → Mitigation: D5 thêm primitive này; spec `billing-ui-readiness` MODIFIED ghi nhận có drawer.
- **[Toast framework là cross-cutting]** → Mitigation: scope nhỏ — 1 host + 1 composable, không state machine, không queue priority. Đủ dùng cho billing.
- **[Component cũ `BillingOverviewStep`, `BillingCloseStep` còn ở repo nhưng không reachable]** → Mitigation: dọn ở task cuối change; nếu không kịp, để lại 1 task `cleanup` cho follow-up. Đừng xoá vội nếu chưa chắc không có ai import.

## Migration Plan

1. **Server enrichment trước**: thêm DTO field mới (optional), enrich resolver. UI cũ vẫn render UID — không gãy gì.
2. **UI Readability**: cập nhật `BillingPaymentsStep`, `BillingAuditStep` dùng field mới. UI hiện tên thay UID.
3. **UiDrawer + Toast primitive**: thêm vào `app/components/ui/`. Showcase ở `/ui-showcase`.
4. **IA refactor**: cập nhật page `[period].vue`. Bỏ tab cũ, thêm sticky strip + drawer + header overflow.
5. **Cleanup**: xoá file/component không còn dùng (`BillingOverviewStep` nếu logic chuyển hết sang strip).

Rollback: mỗi bước commit riêng. Bước (4) là big bang nhất nhưng chỉ thay 1 page file — git revert nhanh.

## Open Questions

- Adjustment modal có cần search invoice cross-period (vd điều chỉnh kỳ trước) hay chỉ same-period? → Đề xuất same-period cho v1, mở rộng sau khi cần.
- Toast position: top-right hay bottom-right? → Đề xuất top-right desktop, bottom-center mobile (chuẩn industry).
- Mobile: drawer audit chiếm full screen có ổn không? → Đề xuất có (full screen overlay), close button ở header.
