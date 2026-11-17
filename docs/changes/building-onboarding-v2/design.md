---
type: Change Design
title: "building-onboarding-v2-design"
status: draft
change_state: design-review
tags: [superpowers, change, buildings, settings, contracts, onboarding, v2]
---

# Building onboarding V2

> Biến việc thiết lập tòa nhà mới thành một mạch liền từ "tạo tòa" tới "lập hợp đồng đầu tiên",
> và dọn các chỗ trùng lặp dữ liệu/readiness. Thiết kế chưa được chấp nhận hay triển khai.

## 1. Mục tiêu và tiêu chí thành công

Người dùng chọn hai mục tiêu (2026-11-17): **onboarding tòa mới** và **dọn nhất quán**. Vận hành tòa đã có không thuộc đợt này.

- Tạo tòa xong, người dùng được dẫn thẳng vào thiết lập; không quay về danh sách rồi tự tìm lại tòa.
- Thông tin chủ nhà chỉ nhập **một nơi** (Bên cho thuê).
- Giá điện nước và lịch billing chỉ sửa **một nơi** (bước "Thông tin và lịch vận hành").
- Readiness có một nguồn quy tắc (server) và một chỗ ánh xạ mã thiếu → bước (client).
- Từ khi bấm "Tạo tòa nhà" đến khi bấm "Lập hợp đồng đầu tiên" chỉ đi qua **một trang thiết lập**.

## 2. Quyết định đã chốt

| # | Quyết định | Lựa chọn |
| --- | --- | --- |
| D1 | Chủ sở hữu vs bên cho thuê | Gộp một nguồn: **Bên cho thuê** (`building_contract_profiles`) |
| D2 | Sau khi tạo tòa | Chuyển vào `settings?setup=1` (chế độ Thiết lập) |
| D3 | Form tạo tòa | Chỉ tên, địa chỉ, mô tả, trạng thái + tạo phòng nhanh |
| D4 | Thứ tự bước | Bên cho thuê → Điều khoản hợp đồng → Thông tin & lịch → Hóa đơn → Dịch vụ → Nội thất; 4 bước đầu bắt buộc |
| D5 | Hướng triển khai | Mở rộng trang Cài đặt hiện có, không tạo trang/wizard mới |
| D6 | Bước "Hợp đồng" hiện tại | Tách thành hai bước bắt buộc: **Bên cho thuê** và **Điều khoản hợp đồng** (thay đổi so với 3 bước của `building-settings-setup-flow`) |

## 3. Hiện trạng (source tại `develop` 5f1714a0)

- [create.vue](../../../app/pages/dashboard/buildings/create.vue) dùng `BuildingForm` gồm thông tin, giá điện nước, lịch billing, chủ sở hữu và bộ sinh phòng; tạo xong `navigateTo('/dashboard/buildings')` ([useBuildingForm.ts](../../../app/composables/buildings/useBuildingForm.ts)).
- `BuildingForm` được dùng ở 3 nơi: trang tạo, modal sửa nhanh trên danh sách, `BasicsStep` trong Cài đặt.
- `owner_name/phone/email` (bảng `buildings`) chỉ được form tòa, trang chi tiết, repository và RPC `create_building_with_rooms` dùng; hóa đơn và DOCX không đọc.
- Lessor nằm ở `building_contract_profiles` (7 trường, PII: ngày sinh, địa chỉ, CCCD bị che với manager).
- Giá điện nước và lịch billing đã nullable khi tạo; [readiness.ts](../../../server/services/buildings/readiness.ts) đã báo thiếu.
- Readiness hiển thị bằng hai component: `BuildingReadinessCard` (trang chi tiết) và `SettingsReadinessCard` (Cài đặt).
- `BuildingCard`: `sm:p-4` ghi đè `pl-12` ở chế độ chọn nhiều, checkbox đè tên tòa.
- Bước "Hợp đồng" trong Cài đặt cao khoảng 1.680px, 19 ô nhập, 15 mục bắt buộc; trộn danh tính bên cho thuê (PII), mặc định hợp đồng, 6 điều khoản, bản ký và lịch thanh toán chỉ đọc.
- Ô điều khoản có placeholder 30/7/6 nhưng giá trị null, readiness vẫn đếm thiếu.
- `PUT /api/buildings/[id]/contract-profile` ghi đè toàn bộ hồ sơ (validator mặc định null, service upsert cả hàng).
- Trang chi tiết tòa lặp tên, địa chỉ, mô tả; "Thiếu 15 mục" không bấm được; header có "Chỉnh sửa" (thực ra mở Cài đặt) và "Dịch vụ" trùng bước Cài đặt.
- Trang tạo hợp đồng liệt kê phòng trống của mọi tòa, không lọc theo tòa.

## 4. Dữ liệu và migration

### 4.1 Schema

- `building_contract_profiles` thêm `lessor_email text` (nullable, check định dạng email, ≤ 254 ký tự). Không tính vào readiness, không phải PII bị che.
- Validator `buildingContractProfileSchema`, mapper, DTO và form hồ sơ hợp đồng thêm `lessor_email`.

### 4.2 Gộp owner → lessor (một migration, một transaction)

Với mỗi tòa có ít nhất một trong `owner_name`, `owner_phone`, `owner_email` khác rỗng:

1. Nếu chưa có dòng `building_contract_profiles` → chèn dòng chỉ chứa trường lessor tương ứng.
2. Nếu đã có → chỉ điền trường lessor **đang null**; không bao giờ ghi đè.
3. Chỉ chép giá trị qua ràng buộc sẵn có: tên `trim` dài 2–100, SĐT dài 8–20, email khớp định dạng. Giá trị không hợp lệ bị bỏ qua.

Ánh xạ: `owner_name → lessor_full_name`, `owner_phone → lessor_phone`, `owner_email → lessor_email`.

### 4.3 Cột `owner_*`

- Giữ cột trong đợt này; ứng dụng ngừng đọc và ghi.
- `buildingBaseSchema`, `BuildingFormData`, `building-form` mapper, `buildings` mapper và DTO bỏ `owner*`.
- RPC `create_building_with_rooms` không cần sửa: payload không gửi `owner_*` nên giá trị là null.
- Xóa cột ở migration sau khi xác nhận không còn nơi đọc (ngoài phạm vi).

### 4.4 Lưu từng phần hồ sơ hợp đồng

- Thêm `PATCH /api/buildings/[id]/contract-profile`: validator là `buildingContractProfileSchema` dạng partial **không có default**; chỉ các khóa có trong body được cập nhật, phần còn lại giữ giá trị hiện có.
- Service hợp nhất với hàng hiện tại rồi upsert; audit ghi `changed_fields` như cũ.
- Trường PII đã bị che (manager) không bao giờ được gửi lại: form "Bên cho thuê" chỉ gửi khi người dùng có `building-contract-profile.pii.read`; form "Điều khoản" không chứa trường PII.
- `PUT` giữ nguyên cho tương thích; UI mới chỉ dùng `PATCH`.

### 4.5 Quyền

- Thông tin chủ nhà nay thuộc quyền `building-contract-profile.read/write`, không còn đi theo quyền sửa tòa.
- Manager vẫn xem tên, SĐT, email bên cho thuê nếu có quyền đọc hồ sơ hợp đồng; PII (ngày sinh, địa chỉ, CCCD) tiếp tục bị che.

## 5. Form tạo tòa và luồng sau khi tạo

- `BuildingForm` thêm prop `variant: 'create' | 'basics'`.
  - `create`: tên, địa chỉ, mô tả, trạng thái + slot `extras` (tạo phòng nhanh).
  - `basics`: thông tin cơ bản + giá điện nước + lịch billing + tháng bắt đầu vận hành. Dùng cho `BasicsStep` và modal sửa nhanh trên danh sách.
  - Cả hai bỏ nhóm "Chủ sở hữu".
- Mặc định khi tạo giữ `per_kwh`/`per_m3`, các đơn giá và lịch để trống.
- Mô tả trang tạo: "Khai báo tòa nhà và phòng. Bên cho thuê, giá điện nước, thanh toán sẽ thiết lập ở bước tiếp theo."
- RPC tạo tòa + phòng, `request_id`, bản nháp, xử lý phòng trùng giữ nguyên.
- `useBuildingForm.submitCreate` sau khi thành công:
  - đi tới `buildingPath(building) + '/settings?setup=1'`;
  - nếu không có quyền vào Cài đặt (cùng điều kiện trang Cài đặt dùng) thì đi tới trang chi tiết tòa;
  - toast "Đã tạo tòa nhà. Tiếp tục thiết lập để sẵn sàng cho thuê."
- `/edit → settings#basics` và `[id]/rooms/batch.vue` giữ nguyên.

## 6. Chế độ Thiết lập trong Cài đặt

### 6.1 Thứ tự bước (áp dụng cả ngoài chế độ thiết lập)

| # | Bước (`id`) | Nội dung | Mã readiness | Bắt buộc |
| --- | --- | --- | --- | --- |
| 1 | Bên cho thuê (`lessor-profile`) | 7 trường danh tính + email | `lessor.*` | Có |
| 2 | Điều khoản hợp đồng (`contract-terms`) | Thời hạn, cọc, 6 điều khoản, thương hiệu, bản ký, lịch thanh toán chỉ đọc | `contract.*`, `terms.*` | Có |
| 3 | Thông tin và lịch vận hành (`basics`) | Giá điện nước, lịch billing | `billing.*` | Có |
| 4 | Thanh toán trên hóa đơn (`invoice-profile`) | Ngân hàng, QR, nhận diện | `invoice_profile` | Có |
| 5 | Dịch vụ mặc định (`service-defaults`) | | | Không |
| 6 | Nội thất mẫu (`inventory-template`) | | | Không |

Anchor cũ `#contract-profile` được chuyển hướng tới `#lessor-profile` để link cũ không gãy. Hai bước 1–2 cùng đọc một `contractProfile` từ `settings-bootstrap`.

### 6.2 Hành vi khi có `?setup=1`

- Header: "Thiết lập tòa nhà · {tên}", mô tả "Hoàn tất 4 bước bắt buộc để lập hợp đồng".
- Mở sẵn bước đầu còn thiếu (đã có qua `nextStepId`).
- Nút lưu của mỗi bước đổi thành **"Lưu và tiếp"**; lưu xong mở và cuộn tới bước kế tiếp do `nextSetupStepId(flow, currentId)` chọn: ưu tiên bước bắt buộc còn thiếu, nếu hết thì bước tùy chọn kế tiếp theo thứ tự, nếu hết thì không mở bước nào.
- Bước tùy chọn có **"Bỏ qua"**. `ServicesStep` lưu từng dòng nên chỉ có **"Tiếp"**.
- Đủ 4 bước bắt buộc: `SettingsReadinessCard` chuyển sang trạng thái hoàn tất với CTA chính **"Lập hợp đồng đầu tiên"** (`/dashboard/contracts/create?building_id=…`, thêm `room_id` khi tòa chỉ có đúng một phòng trống) và CTA phụ "Xem tòa nhà".
- "Thoát thiết lập" bỏ `?setup=1`; dữ liệu đã lưu giữ nguyên.
- Chặn rời trang khi có thay đổi chưa lưu giữ nguyên hành vi hiện có.

### 6.3 Bước thiếu quyền

Bước người dùng không xem được (ví dụ thiếu `building-contract-profile.read`) vẫn tính vào tiến độ, hiển thị dạng khóa với chú thích "Cần chủ tòa hoàn tất". "Lưu và tiếp" bỏ qua bước khóa.

### 6.4 Nội thất mẫu với phòng đã có

- `settings-bootstrap` trả thêm `roomIdsWithoutInventory: string[]` (phòng của tòa chưa có dòng `room_inventory_items`, theo scope hiện có).
- Sau khi lưu mẫu, nếu danh sách khác rỗng: hiện gợi ý "Áp dụng cho N phòng chưa có nội thất", gọi `POST /api/buildings/[id]/inventory-template/apply` với `mode: 'merge'`.

### 6.5 Tổ chức code

- `nextSetupStepId(flow, currentId)` và `summarizeRequiredSteps(readiness)`: hàm thuần trong [building-setup-steps.ts](../../../app/utils/building-setup-steps.ts).
- `useBuildingSetupMode()`: đọc query, "Lưu và tiếp", "Bỏ qua", thoát. `settings.vue` chỉ nối composable vào các bước.

## 7. Dọn nhất quán

- **Readiness:** quy tắc giữ ở server. Client chỉ ánh xạ mã thiếu → bước trong `building-setup-steps.ts`. `READINESS_LABELS.anchor` đổi theo bảng 6.1: `lessor.*` → `lessor-profile`, `contract.*`/`terms.*` → `contract-terms`.
- **Trang chi tiết tòa:** bỏ `BuildingReadinessCard`, thay bằng dải tóm tắt dùng chung phần hiển thị với `SettingsReadinessCard`:
  - chưa sẵn sàng: "Thiết lập x/4 · Còn thiếu: …" + **"Tiếp tục thiết lập"** → `settings?setup=1`;
  - sẵn sàng: "Sẵn sàng lập hợp đồng" + link tạo hợp đồng.
- **Trang chi tiết tòa:** mục "Tên chủ nhà / SĐT / Email" đổi thành "Bên cho thuê", đọc từ hồ sơ hợp đồng theo quyền đọc hiện có.
- **`BuildingCard`:** khi `selectable` dùng `pl-12 sm:pl-12` để checkbox không đè tên tòa.

## 7b. UI/UX

Theo [UI polish workflow](../../../.agents/skills/zeno-house/references/ui-polish-workflow.md): giữ design system, token, Inter và primitive hiện có; không thêm primitive mới.

- **Bước Bên cho thuê:** chỉ 7 trường danh tính + email, nhóm "Danh tính" (họ tên, ngày sinh, CCCD, ngày cấp, nơi cấp) và "Liên hệ" (SĐT, email, địa chỉ thường trú). Manager không có quyền PII thấy bước ở dạng chỉ đọc với giá trị đã che.
- **Bước Điều khoản hợp đồng:** khi hồ sơ chưa có giá trị, form **khởi tạo** bằng gợi ý: thời hạn 12 tháng, cọc 1 tháng, báo trước 30 ngày, hoàn cọc 7 ngày, tự gia hạn 6 tháng. Ba khoản phí để trống. Gợi ý chỉ là giá trị ban đầu của form; readiness chỉ đạt sau khi lưu. Bản ký và lịch thanh toán chỉ đọc nằm cuối, thu gọn mặc định.
- **Trang tạo tòa:** khối "Phòng" hiển thị sẵn (bỏ checkbox "Bật tạo phòng nhanh"); để trống vẫn tạo được tòa không có phòng. Nút submit đổi nhãn theo số phòng: "Tạo tòa nhà" / "Tạo tòa nhà và N phòng". Xác minh và gộp hai bộ nút "Huỷ / Tạo tòa nhà" nếu trùng ở cùng breakpoint.
- **Trang chi tiết tòa:** tên chỉ ở tiêu đề trang; địa chỉ và mô tả chỉ ở một chỗ; header chỉ còn "Thêm phòng" và "Cài đặt" (bỏ "Chỉnh sửa", "Dịch vụ"); dải readiness như mục 7.
- **Trang thêm phòng:** link "Thiết lập nội thất mẫu" mở `settings#inventory-template`.
- **Trang tạo hợp đồng:** nhận `?building_id=`; bộ chọn phòng lọc phòng trống của tòa đó (server search đã có), người dùng vẫn đổi được tòa bằng cách xóa bộ lọc.
- **Trạng thái phải có:** loading bootstrap, lỗi lưu (giữ nguyên dữ liệu đã nhập), đang lưu (nút disabled + spinner), bước khóa vì quyền, hoàn tất, link cũ `#contract-profile`.
- **Kiểm tra trình duyệt:** 390 / 768 / 1280px, sáng và tối; focus-visible và thứ tự tab qua "Lưu và tiếp"; reduced motion khi cuộn tới bước kế tiếp.

## 8. Kiểm thử

- **Migration:** test cấu hình (transaction, chỉ điền khi null, lọc ràng buộc, thêm `lessor_email`); `supabase/verification/building_owner_to_lessor.sql` chạy và rollback: không ghi đè, giá trị không hợp lệ bị bỏ qua, quyền không đổi.
- **Server:** validator tòa không còn `owner_*`; hồ sơ hợp đồng nhận/trả `lessor_email`; `PATCH contract-profile` chỉ cập nhật khóa được gửi, không xóa trường khác, chặn manager ghi PII; `settings-bootstrap` trả `roomIdsWithoutInventory` đúng scope.
- **Client:** thứ tự 6 bước và mapping mã readiness → bước; `nextSetupStepId`, `summarizeRequiredSteps`; giá trị gợi ý của bước Điều khoản; `submitCreate` điều hướng theo quyền; `BuildingForm` theo `variant`; `useBuildingSetupMode`; redirect `#contract-profile`; trang tạo hợp đồng lọc theo `building_id`; class padding của `BuildingCard`.
- **Trình duyệt (390 / 768 / 1280px, sáng và tối):** tạo tòa → 4 bước → "Lập hợp đồng đầu tiên" mở đúng tòa; bỏ dở rồi quay lại từ trang chi tiết; manager thấy bước Bên cho thuê chỉ đọc/khóa; danh sách ở chế độ chọn nhiều.
- `npm run typecheck`, `npm test`, `npm run lint`, `npm run knowledge:check`.

## 9. Ngoài phạm vi

- Xóa cột `owner_*`.
- Badge "Đang thiết lập" trên thẻ danh sách tòa.
- Chặn readiness ở lối tạo hợp đồng từ trang phòng hoặc danh sách hợp đồng.
- Tối ưu vận hành tòa đã có.

## 10. Rollout

- Migration (schema + gộp dữ liệu) chạy theo cloud gate: dry-run → push → SQL verification → regenerate types.
- Ứng dụng deploy sau migration; bản ứng dụng cũ vẫn chạy được trên schema mới vì chỉ thêm cột và dữ liệu.
- Sau nghiệm thu: cập nhật `buildings-ui` và `buildings-api` trong `docs/capabilities/**`, chuyển bundle sang `docs/history/**`.
