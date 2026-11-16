---
type: Change Design
title: "tenant-quick-create-design"
status: draft
change_state: design-review
tags: [superpowers, change, tenants, contracts, v2]
---

# PR3 — Tenant Quick Create (Tenant V2 change A)

> Sub-project PR3 của [ZENO House V2 — Flow Optimization Brief](../zeno-house-v2-optimization/brief.md) và là **change A** trong [Tenant V2](../tenant-v2/spec-and-implementation-plan.md). Dựa trên change B đã hoàn thành ([harden-tenant-identity-data](../../history/2026-11-09-harden-tenant-identity-data/index.md)). Không bao gồm OCR (change C / PR5).

## 1. Mục tiêu

- Chọn khách cũ hoặc thêm khách mới **ngay trong luồng lập hợp đồng**, không rời trang, không mất dữ liệu đang nhập.
- Bắt buộc tối thiểu họ tên + SĐT; cho nhập giấy tờ tùy chọn để khỏi quay lại khi xuất DOCX (PR4).
- Dùng lại cơ chế chống trùng của change B để đề xuất "Dùng khách này" thay vì tạo trùng; không lộ PII ngoài phạm vi.

## 2. Hiện trạng (develop)

- `ContractForm.vue` và `ContractOccupantForm.vue` chọn khách bằng `UiCombobox`, tải sẵn `GET /api/tenants?limit=200&available=true` rồi lọc phía client; không có lối tạo khách tại chỗ.
- `create.vue` tải thêm `allTenantsData` (200 khách) chỉ để hiện tên người ở cùng.
- `UiCombobox` đã hỗ trợ `remoteSearch`, `allowCustom`, `createOption`, `customOptionLabel`.
- `GET /api/tenants` hỗ trợ `q`, `available`, `excludeContractId`; khách quyền `basic` chỉ trả `id, code, fullName, phone, status`.
- `POST /api/tenants` bắt buộc `full_name`, `phone`. Trùng với khách quyền `full` → `409 TENANT_DUPLICATE` + `details.existingTenantId`, `details.fieldErrors`; trùng ngoài phạm vi → 409 thông báo chung, có giới hạn tần suất và audit.
- Nút "Tạo hợp đồng" trên phòng (`RoomDetailHero`, trang chi tiết phòng) mở `/dashboard/contracts/create?room_id=${room.code}`, nhưng `create.vue` gán thẳng vào `room_id` (form tìm theo uuid) → phòng có thể không được chọn sẵn.

## 3. Quyết định đã chốt

| Câu hỏi | Quyết định |
| --- | --- |
| Điểm vào | Ô khách khi tạo HĐ; bước thêm người ở cùng; "Thêm người ở" ở chi tiết HĐ; nút "Tạo hợp đồng" trên phòng (sửa chọn sẵn phòng). Không thêm "thêm nhanh" ở danh sách khách. |
| Trường | Họ tên + SĐT bắt buộc; khối thu gọn "Thông tin giấy tờ (không bắt buộc)": CCCD, ngày sinh, ngày cấp, nơi cấp, địa chỉ thường trú. Không lưu vào localStorage. |
| Backend | Không đổi API, không migration. |

## 4. Thiết kế

### 4.1. `TenantPicker.vue` (`app/components/tenants/`)

- Bọc `UiCombobox` với `remote-search`, `allow-custom`, `custom-option-label="Thêm khách mới:"`.
- Props: `modelValue: string | null`, `label`, `excludeTenantIds?: string[]`, `excludeContractId?`, `disabled?`, `error?`, `required?`, `id?`.
- Emits: `update:modelValue` (tenant id | null), `selected` (`TenantSummary | null`).
- Tìm kiếm: `GET /api/tenants?q=&available=true&limit=20[&excludeContractId=]`, debounce 250 ms; kết quả loại `excludeTenantIds`.
- Chọn dòng tùy chỉnh → mở `TenantQuickCreateDialog` với giá trị điền sẵn: chuỗi trông như SĐT (`normalizeTenantPhone` ≠ null) → ô SĐT, ngược lại → ô họ tên.
- Chỉ bật `allow-custom` khi `authStore.can('tenants.create')`.
- Giữ `TenantSummary` của lựa chọn hiện tại để hiển thị khi `modelValue` đã có từ bản nháp (tải một lần qua `GET /api/tenants/{id}` nếu chưa có trong kết quả).

### 4.2. `TenantQuickCreateDialog.vue`

- `UiModal` (`mobile-fullscreen`), trường họ tên + SĐT; `UiFormSection` thu gọn "Thông tin giấy tờ (không bắt buộc)".
- Validate bằng `tenantCreateSchema`; gửi qua `useTenantQuickCreate()`.
- Kết quả:
  - **Thành công** → emit `created(TenantSummary)`, đóng dialog.
  - **`TENANT_DUPLICATE`** → trạng thái "Đã có khách với {SĐT|CCCD} này": tải `GET /api/tenants/{existingTenantId}`, hiện tên, SĐT, mã; nút **"Dùng khách này"** (emit `created`); nếu `hasActiveContract` hoặc `activeAssignment` → nút tắt, lý do "Khách đang ở theo hợp đồng khác".
  - **409 chung** → hiện nguyên thông báo của change B; không hành động thêm.
  - **Lỗi khác** → giữ dữ liệu, cho bấm lại.
- Nút lưu khóa khi đang gửi; DB unique index là chốt cuối; request thứ hai nhận `TENANT_DUPLICATE` và tự vào luồng "Dùng khách này".
- Đóng/hủy → reset toàn bộ state trong bộ nhớ. Không ghi localStorage/sessionStorage.

### 4.3. `useTenantQuickCreate()` (`app/composables/tenants/`)

```ts
type QuickCreateResult =
  | { kind: 'created'; tenant: TenantSummary }
  | { kind: 'duplicate'; existingTenantId: string; fields: ('phone' | 'id_number')[] }
  | { kind: 'conflict'; message: string }
  | { kind: 'error'; message: string; fieldErrors?: Record<string, string[]> }
```

`TenantSummary = Pick<Tenant, 'id' | 'code' | 'fullName' | 'phone'>` thêm vào `app/types/tenants.ts`.

### 4.4. Điểm gắn

| Điểm | Thay đổi |
| --- | --- |
| `ContractForm.vue` ô "Khách thuê" | `TenantPicker` thay `UiCombobox`; bỏ `useFetch('/api/tenants')`; `excludeTenantIds` = người ở cùng đang chờ (prop mới). Chế độ chỉ đọc (`relationReadonly`) dùng `TenantSummary` nhận từ picker hoặc tải theo id. |
| `ContractOccupantForm.vue` | `TenantPicker` thay `UiCombobox`; emit thêm `tenantName` trong payload submit để nơi gọi khỏi tải danh sách. |
| `contracts/create.vue` | Bỏ `allTenantsData`; dùng `tenantName` từ form người ở; nhận `room_id` dạng uuid **hoặc** code: không phải uuid → `GET /api/rooms/{code}` lấy id rồi gán. |
| Chi tiết HĐ (thêm người ở) | Dùng `ContractOccupantForm` đã đổi; không đổi gì thêm. |

### 4.5. Quyền

- Dòng "Thêm khách mới" chỉ khi có `tenants.create` (manager không có).
- Tìm kiếm cần `tenants.read` (đã có ở mọi vai trò tạo HĐ).
- Server giữ nguyên scope và rút gọn dữ liệu quyền `basic` (change B).

## 5. UI

- Theo [ui-polish-workflow](../../../.agents/skills/zeno-house/references/ui-polish-workflow.md); bắt buộc `frontend-design` và Hallmark; dùng primitive sẵn có (`UiCombobox`, `UiModal`, `UiInput`, `UiDatePicker`, `UiFormSection`, `UiAlert`, `UiButton`). Token/primitive mới chỉ khi đánh giá kỹ và được duyệt.
- Trạng thái: đang tìm, không kết quả, dòng thêm mới, đang tạo, trùng có quyền, trùng ngoài phạm vi, khách đang bận, lỗi, mobile (fullscreen, `inputmode="tel"` cho SĐT, `inputmode="numeric"` cho CCCD).

## 6. Kiểm thử

| Lớp | File | Trọng tâm |
| --- | --- | --- |
| Composable | `tests/composables/useTenantQuickCreate.test.ts` | 4 loại kết quả; không gọi `localStorage.setItem` |
| Picker | `tests/components/tenants/TenantPicker.test.ts` | Query `q/available/limit`; debounce; loại `excludeTenantIds`; dòng thêm mới theo quyền; điền sẵn SĐT/tên; tự chọn khách vừa tạo |
| Dialog | `tests/components/tenants/TenantQuickCreateDialog.test.ts` | Khối giấy tờ thu gọn; validate; trùng → thẻ + "Dùng khách này"; khách bận → nút tắt; 409 chung không hành động; đóng → reset |
| Trang | `tests/pages/contract-create-tenant-picker.spec.ts` | Không còn `allTenantsData`; dùng `TenantPicker`; xử lý `room_id` dạng code |
| Chọn sẵn phòng | `tests/composables/contract-room-prefill.test.ts` | code → uuid; uuid giữ nguyên; code không tồn tại → bỏ trống, không lỗi |
| Quyền | test API tenants hiện có | `GET /api/tenants?q=` với quyền `basic` không có `idNumber`, `dateOfBirth`, `permanentAddress` |

Lệnh: test hẹp, rồi `npm run typecheck`, `npm test`, `npm run lint`, `npm run knowledge:check`.

## 7. Tài liệu

- Bundle `index.md`, `design.md`, `implementation-plan.md`, `verification.md`; link từ brief, changes index và [tenant-v2](../tenant-v2/spec-and-implementation-plan.md).
- Khi chấp nhận: cập nhật [tenants-ui](../../capabilities/tenants-ui.md), [tenants-client](../../capabilities/tenants-client.md), [contracts-ui](../../capabilities/contracts-ui.md), [contract-occupants-client](../../capabilities/contract-occupants-client.md).

## 8. Ngoài phạm vi

- OCR (PR5); lỗi người ở cùng thành công một phần khi tạo HĐ (PR4); thêm nhanh ở danh sách khách; đổi chính sách trùng SĐT; yêu cầu bổ sung trường để xuất DOCX (PR4).
