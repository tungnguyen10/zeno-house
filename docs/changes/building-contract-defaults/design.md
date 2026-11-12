---
type: Change Design
title: "building-contract-defaults-design"
status: draft
change_state: design-review
tags: [superpowers, change, buildings, contracts, pii, v2]
---

# PR1 — Building Defaults & Readiness

> Sub-project PR1 của [ZENO House V2 — Flow Optimization Brief](../zeno-house-v2-optimization/brief.md). Thiết kế chưa được chấp nhận hay triển khai; yêu cầu đã chấp nhận nằm ở `docs/capabilities/**`.

## 1. Mục tiêu

- Lưu hồ sơ **bên cho thuê (người ký HĐ)** và **chính sách HĐ mặc định** theo từng tòa, đủ cho mẫu `HOP_DONG_THUE_PHONG_TEMPLATE.docx`, để PR4 không phải nhập lại.
- Tính **readiness** theo dữ liệu: "Đủ thông tin lập HĐ" và "Đủ thông tin xuất hóa đơn" tách riêng.
- Bảo vệ dữ liệu cá nhân của bên cho thuê (CCCD, ngày sinh, địa chỉ thường trú).

## 2. Hiện trạng (develop)

- `buildings` chỉ có `owner_name/phone/email` (liên hệ), không có danh tính pháp lý.
- Lịch vận hành có sẵn: `billing_generation_day`, `payment_due_day`, `grace_period_days`.
- Hồ sơ hóa đơn `building_invoice_profiles` (ngân hàng, chủ TK, số TK, mẫu nội dung CK, QR) đã có; trang cài đặt hiện badge "Đã cấu hình" khi tồn tại.
- Trang cài đặt tòa có 5 mục (định danh & quyền, hồ sơ hóa đơn, quy tắc tài chính, dịch vụ mặc định, dịch vụ theo HĐ) và nạp qua `BuildingSettingsBootstrap`.
- Không có khái niệm readiness.
- Mẫu DOCX dùng placeholder `lessor.*` (cá nhân, 7 trường), `terms.*`, `payment.*`, `building.brand_name`, `contract.signed_copies`, `contract.copies_per_party`.

## 3. Quyết định đã chốt

| Câu hỏi | Quyết định |
| --- | --- |
| Loại bên cho thuê | **Chỉ cá nhân**, 7 trường theo mẫu. Doanh nghiệp để sau, khi có mẫu DOCX riêng. |
| Quyền với CCCD | Admin và owner (trong scope) xem đầy đủ và sửa; manager chỉ thấy bản che, vẫn xuất DOCX được (PR4, server tự lấy dữ liệu). Audit không chứa PII. |
| Lịch thanh toán trên HĐ | **Suy ra**, không thêm trường: X = `billing_generation_day`, Y = `payment_due_day`, Z = `payment_due_day + grace_period_days`. UI phải giải thích rõ cho owner. |
| Phí dịch vụ / phí quản lý | **Không thêm trường ở PR1.** Phí quản lý là một dịch vụ riêng của tòa (tùy chọn), đơn giá từng HĐ chỉnh trên `contract_services`. Xử lý ở PR4 (xem §8). |

## 4. Mô hình dữ liệu

Bảng mới `public.building_contract_profiles`, mỗi tòa một dòng:

- `building_id uuid primary key references public.buildings(id) on delete cascade`
- Bật RLS, **không có policy** nào; `revoke all` khỏi `anon` và `authenticated`. Chỉ service role truy cập.
- Không join vào các truy vấn `buildings` hiện có.

| Nhóm | Cột | Kiểu / ràng buộc |
| --- | --- | --- |
| Bên cho thuê | `lessor_full_name` | text 2–100, nullable |
| | `lessor_date_of_birth` | date, nullable |
| | `lessor_permanent_address` | text ≤ 255, nullable |
| | `lessor_id_number` | text, `^[0-9]{9}([0-9]{3})?$`, nullable |
| | `lessor_id_issued_date` | date ≤ `current_date`, nullable |
| | `lessor_id_issued_place` | text ≤ 150, nullable |
| | `lessor_phone` | text, dùng chung validator số điện thoại tenant, nullable |
| Hiển thị | `brand_name` | text ≤ 100, nullable; null thì dùng `buildings.name` |
| Mặc định HĐ mới | `default_term_months` | int 1–60, nullable |
| | `default_deposit_months` | numeric(3,1) 0–6, nullable |
| Điều khoản | `notice_days` | int 0–180, nullable |
| | `deposit_refund_days` | int 0–90, nullable |
| | `renewal_months` | int 0–24, nullable (0 = không tự gia hạn) |
| | `extra_occupant_fee` | numeric(12,0) ≥ 0, nullable |
| | `drilling_fee` | numeric(12,0) ≥ 0, nullable |
| | `fingerprint_reset_fee` | numeric(12,0) ≥ 0, nullable |
| Bản ký | `signed_copies` | int 1–10, not null, default 2 |
| | `copies_per_party` | int 1–5, not null, default 1; check `copies_per_party * 2 <= signed_copies` |
| Hệ thống | `updated_by` (→ auth.users), `created_at`, `updated_at` (trigger) | |

- Không đặt default cho điều khoản và phí; owner phải xác nhận. UI hiện giá trị gợi ý dạng placeholder.
- Ngân hàng lấy từ `building_invoice_profiles`, không lưu lặp.
- Thay đổi hồ sơ không hồi tố; snapshot khi xuất DOCX thuộc PR4.

## 5. Readiness, API, phân quyền

### 5.1. Capability

| Capability | Admin | Owner | Manager |
| --- | --- | --- | --- |
| `building-contract-profile.read` | ✓ | ✓ | ✓ |
| `building-contract-profile.pii.read` | ✓ | ✓ | ✗ |
| `building-contract-profile.write` | ✓ | ✓ | ✗ |

Mọi lệnh gọi kiểm tra thêm `assertBuildingScope(event, user, buildingId, 'read' | 'write')`.

### 5.2. API

- `GET /api/buildings/[id]/contract-profile` → `{ data: BuildingContractProfile | null }`.
  - Không có `pii.read`: server che trước khi trả — `lessorIdNumber` = `"*******" + 4 số cuối`, `lessorDateOfBirth` = null, `lessorPermanentAddress` = null, `lessorIdentityMasked: true`.
- `PUT /api/buildings/[id]/contract-profile` → upsert toàn bộ; validator `app/utils/validators/building-contract-profile.ts` dùng chung client/server; mọi trường cho phép trống, chỉ ràng buộc giá trị đã nhập.
- `GET /api/buildings/[id]/readiness` → `{ data: { contract: { ready, missing: ReadinessCode[] }, billing: { ready, missing: ReadinessCode[] } } }`.
- `settings-bootstrap` trả thêm `contractProfile` (đã che theo vai trò) và `readiness`.
- Luồng: route → `BuildingContractProfileService` → `BuildingContractProfileRepository`; mapper ở `app/utils/mappers/building-contract-profile.ts`; DTO ở `app/types/building-contract-profile.ts`.

### 5.3. Readiness

Hàm thuần `computeBuildingReadiness(building, contractProfile, invoiceProfile)` tại `server/services/buildings/readiness.ts`.

- `contract.ready` cần: 7 trường bên cho thuê; `default_term_months`, `default_deposit_months`; 6 trường điều khoản; `billing_generation_day` và `payment_due_day`; hồ sơ hóa đơn tồn tại.
- `billing.ready` cần: hồ sơ hóa đơn; đơn giá điện và nước khi cách tính cần đơn giá; `billing_generation_day` và `payment_due_day`.
- `missing[]` là mã ổn định, ví dụ `lessor.full_name`, `lessor.id_number`, `contract.default_term_months`, `terms.notice_days`, `billing.schedule`, `billing.electricity_rate`, `billing.water_rate`, `invoice_profile`. UI tự map sang nhãn tiếng Việt và anchor cài đặt. PR4 dùng `contract.ready` để chặn xuất DOCX.

### 5.4. Audit và lỗi

- Hành động `building.contract_profile_updated`, `metadata.changed_fields: string[]`; `before_data`/`after_data` = null.
- Lỗi validation chỉ nêu tên trường, không echo giá trị.

## 6. UI

### 6.1. Trang cài đặt tòa

- Mục mới **"Hợp đồng"** (`#contract-profile`) sau "Hồ sơ hóa đơn & thanh toán"; huy hiệu "Đủ thông tin lập HĐ" hoặc "Thiếu N mục".
- Component `BuildingContractProfileSettings.vue` (cạnh `BuildingInvoiceProfileSettings.vue`), 5 nhóm:
  1. **Bên cho thuê (người ký hợp đồng)** — 7 trường; mô tả *"Thông tin này in trên hợp đồng, khác với thông tin liên hệ chủ nhà."*
  2. **Mặc định cho hợp đồng mới** — thời hạn, số tháng cọc, tên thương hiệu.
  3. **Điều khoản** — 6 trường, mỗi trường có hint điều khoản HĐ dùng nó.
  4. **Bản ký** — số bản, số bản mỗi bên.
  5. **Lịch thanh toán trên hợp đồng (chỉ đọc)** — câu xem trước *"Trên hợp đồng: Thanh toán từ ngày X đến ngày Y hằng tháng; sau ngày Z không thanh toán, Bên A có quyền chấm dứt hợp đồng."*, mỗi số có chú thích nguồn (Ngày phát hành hóa đơn / Hạn thanh toán / + Số ngày ân hạn) và link "Sửa lịch vận hành"; thiếu cấu hình thì hiện cảnh báo. Nếu Z > 31 thì câu đổi thành *"quá N ngày sau hạn thanh toán, Bên A có quyền chấm dứt hợp đồng."* để không in ngày không tồn tại.
- Manager: chỉ đọc; CCCD dạng che; ngày sinh, địa chỉ hiện "Ẩn với vai trò quản lý"; không có nút lưu.
- Lưu bằng `PUT` qua `useFormState`, cảnh báo rời trang khi chưa lưu; sau khi lưu làm mới readiness.

### 6.2. Trang chi tiết tòa

- Khối **"Sẵn sàng vận hành"**: hai dòng "Lập hợp đồng" và "Xuất hóa đơn" (✓ hoặc "Thiếu N mục"), mở ra danh sách mục thiếu kèm link đến anchor cài đặt. Thu gọn khi đã đủ.

### 6.3. Chất lượng UI

- Theo [ui-polish-workflow](../../../.agents/skills/zeno-house/references/ui-polish-workflow.md); dùng design system và primitive sẵn có; bắt buộc `frontend-design` và Hallmark.
- Trạng thái cần rà: trống, điền dở, đủ, manager chỉ đọc, lỗi lưu, thiếu lịch thanh toán, mobile.
- Token/primitive mới chỉ khi đánh giá kỹ (vấn đề, phương án, bề mặt ảnh hưởng, lợi ích, chi phí) và được duyệt; thiết kế để tái sử dụng tối đa.

## 7. Kiểm thử và xác minh

| Lớp | File | Trọng tâm |
| --- | --- | --- |
| Validator | `tests/utils/building-contract-profile-validator.test.ts` | CCCD 9/12 số; ngày cấp không ở tương lai; các khoảng số; `copies_per_party * 2 ≤ signed_copies`; mọi trường trống vẫn hợp lệ |
| Readiness | `tests/server/buildings/readiness.test.ts` | Đủ → ready; thiếu từng nhóm → đúng mã; thiếu hồ sơ hóa đơn ảnh hưởng cả hai; cách tính điện/nước không cần đơn giá |
| Che dữ liệu | cùng file service test | Không còn CCCD gốc, ngày sinh, địa chỉ; chỉ 4 số cuối |
| Service/API | `tests/server/building-contract-profile.api.test.ts` | Admin/owner thấy đầy đủ; manager nhận bản che (assert chuỗi CCCD gốc không có trong JSON); manager PUT → 403; owner ngoài scope → 403; audit chỉ `changed_fields`; lỗi không echo giá trị |
| Bootstrap | test settings-bootstrap hiện có | Có `contractProfile` (đã che theo vai trò) và `readiness` |
| UI | `tests/pages/building-settings-contract-profile.spec.ts`, test component | Có `#contract-profile`; có câu xem trước lịch; manager chỉ đọc |

- Migration `supabase/migrations/<ts>_building_contract_profiles.sql`: bảng + check constraint, RLS bật không policy, revoke `anon`/`authenticated`, trigger `updated_at`.
- Script `supabase/verification/building_contract_profiles.sql`: `anon`/`authenticated` không `select` được; constraint chặn dữ liệu sai; xóa tòa xóa theo hồ sơ.
- Regenerate `database.types.ts`; áp dụng cloud là gate riêng.
- Lệnh: test hẹp, rồi `npm run typecheck`, `npm test`, `npm run lint`, `npm run knowledge:check`.
- PR1 độc lập với PR0; chỉ cần timestamp migration tăng dần.

## 8. Quyết định chuyển sang PR4

- Mẫu DOCX thay dòng "Phí quản lý / dịch vụ" bằng **bảng dịch vụ** của HĐ (tên, đơn giá của HĐ, đơn vị suy từ `pricing_type`, ghi chú) kèm câu *"Số người, số xe tính phí được xác định theo thực tế hằng tháng và thể hiện trên hóa đơn."*
- Bỏ câu "miễn phí N xe"; ưu đãi ghi ở `contract_services.notes`, số lượng nhập theo số xe phải trả.
- Phí quản lý là dịch vụ riêng của tòa (tùy chọn); mỗi HĐ chỉnh đơn giá riêng.
- HĐ DOCX là **bản chụp khi phát hành**: lưu snapshot + phiên bản mẫu; tải lại dùng snapshot; xuất lại trước khi ký tạo phiên bản mới kèm lý do; "Đánh dấu đã ký" khóa HĐ; thay đổi đơn giá, giá thuê, hạn, điều khoản hoặc thêm loại phí mới đi qua phụ lục (`add-contract-amendments`). Đổi số lượng người/xe, bật/tắt dịch vụ không bắt buộc sửa HĐ.
- Mẫu dùng cú pháp docxtpl (Python); cần chuyển sang cú pháp của thư viện Node được chọn.
- Danh sách xe có biển số trong mẫu chưa có dữ liệu nguồn — quyết định ở PR4.

## 9. Tài liệu

- Bundle: `index.md`, `design.md` (file này), `implementation-plan.md`, `verification.md`.
- Liên kết từ [brief](../zeno-house-v2-optimization/brief.md) và [changes index](../index.md).
- Khi chấp nhận: tạo `docs/capabilities/building-contract-profile.md`, cập nhật [buildings-ui](../../capabilities/buildings-ui.md); chuyển bundle sang `docs/history/`.

## 10. Ngoài phạm vi PR1

- Bên cho thuê là doanh nghiệp.
- Snapshot và xuất DOCX; bảng dịch vụ và sửa mẫu (PR4).
- Điền sẵn `default_term_months` / `default_deposit_months` vào form tạo HĐ (PR4).
- Readiness trên danh sách tòa.
