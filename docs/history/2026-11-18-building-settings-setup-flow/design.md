---
type: Change Design
title: "building-settings-setup-flow-design"
status: deprecated
change_state: completed
tags: [superpowers, change, buildings, settings, ui, v2]
---

# Cài đặt tòa nhà theo luồng thiết lập

> Sắp xếp lại trang `/dashboard/buildings/[slug]/settings` theo luồng thiết lập của
> [ZENO House V2](../../changes/zeno-house-v2-optimization/brief.md). Thiết kế chưa được chấp nhận hay triển khai.

## 1. Mục tiêu

Chủ nhà mở trang cài đặt và thấy việc thiết lập theo đúng trình tự, biết ngay mục nào còn thiếu để lập được hợp đồng đầu tiên, và dùng được thoải mái trên mobile.

Tiêu chí thành công:

- Đầu trang cho biết "sẵn sàng lập hợp đồng" hay còn thiếu bước nào, và dẫn thẳng tới bước đó.
- Mọi thiết lập của tòa nhà nằm một nơi; không còn phải sang `edit.vue` để sửa lịch vận hành.
- Mỗi lúc chỉ một bước mở, trang không còn là một cuộn dài gồm 7 form.
- Không đổi API, quyền, validator hay dữ liệu.

## 2. Hiện trạng

- `settings.vue` dài khoảng 1700 dòng, 7 mục theo thứ tự: Định danh và phân quyền, Nhận diện và thanh toán, Hợp đồng, Nội thất mẫu, Quy tắc vận hành, Dịch vụ mặc định, Dịch vụ theo phòng.
- Thứ tự không theo luồng thiết lập; trạng thái sẵn sàng chỉ hiện trong mục Hợp đồng.
- Thông tin cơ bản, giá điện nước và lịch vận hành nằm ở trang riêng `edit.vue` (dùng `BuildingForm`).
- Thanh tab mobile bị che dưới header cố định và không khớp mục đang xem.
- Readiness (`app/utils/constants/readiness.ts`, `server/services/buildings/readiness.ts`) đã tồn tại và gồm các mã `lessor.*`, `contract.*`, `terms.*`, `billing.*`, `invoice_profile`.

## 3. Quyết định đã chốt

| Câu hỏi | Quyết định |
| --- | --- |
| Hướng sắp xếp | Theo luồng thiết lập, một cột các bước thu gọn được |
| Trang `edit.vue` | Gộp vào bước 1 của trang cài đặt; `/edit` chuyển hướng về `settings#basics` |
| Kiểu trình bày | Danh sách bước có dòng tóm tắt, mở ra để sửa, chỉ một bước mở cùng lúc |
| Phần tài chính (chi phí cố định, quỹ dự phòng, nhắc chi, trả trước) | Giữ nguyên là một khối trong Nâng cao, chỉ bọc lại, chưa tách nhỏ |

## 4. Cấu trúc trang

Đầu trang: `UiPageHeader` như cũ, thay 4 ô số liệu bằng **thẻ sẵn sàng** ("Sẵn sàng lập hợp đồng · n/3 bước" kèm thanh tiến độ; chỉ tính 3 bước bắt buộc: thông tin và lịch vận hành, thanh toán trên hóa đơn, hợp đồng). Chưa đủ thì có nút dẫn tới bước còn thiếu đầu tiên; đủ thì chuyển trạng thái thành công kèm nút "Lập hợp đồng".

Danh sách bước (một cột, desktop và mobile giống nhau, bỏ menu bên trái và thanh tab):

| # | Bước | Neo | Tính vào tiến độ |
| --- | --- | --- | --- |
| 1 | Thông tin và lịch vận hành | `basics` | Có (`billing.*`) |
| 2 | Thanh toán trên hóa đơn | `invoice-profile` | Có (`invoice_profile`) |
| 3 | Dịch vụ mặc định | `service-defaults` | Cảnh báo, không chặn |
| 4 | Nội thất mẫu | `inventory-template` | Tùy chọn |
| 5 | Hợp đồng | `contract-profile` | Có (`lessor.*`, `contract.*`, `terms.*`) |
| — | Nâng cao | `advanced` | Không |

Nâng cao gồm: mã tòa nhà, managers, quy tắc vận hành tài chính, dịch vụ theo hợp đồng; mỗi mục con cũng thu gọn được.

Mỗi hàng gồm số thứ tự hoặc dấu hoàn tất, tên bước, một dòng tóm tắt, nhãn trạng thái và nút "Sửa".

## 5. Hành vi

- Khi tải trang mở sẵn bước còn thiếu đầu tiên; nếu URL có hash thì mở đúng bước đó.
- Chỉ một bước mở cùng lúc.
- Lưu xong thì bước tự đóng, dòng tóm tắt và thẻ sẵn sàng cập nhật, bước còn thiếu kế tiếp được nhấn mạnh.
- Có thay đổi chưa lưu mà mở bước khác thì hỏi "Bỏ thay đổi?"; rời trang cũng được bảo vệ.
- Bước người dùng không có quyền xem thì không hiển thị; manager thấy tóm tắt và form chỉ đọc như hiện nay.
- Link cũ: `/edit` chuyển về `settings#basics`; `#invoice-profile`, `#contract-profile` mở đúng bước; `READINESS_LABELS` đổi `anchor: 'edit'` thành `basics`.

## 6. Kiến trúc

```
app/pages/dashboard/buildings/[id]/settings.vue   tải bootstrap, danh sách bước, openStepId đồng bộ route.hash
app/components/buildings/settings/
  SettingsStepList.vue        vỏ danh sách: hàng, tóm tắt, trạng thái, vùng mở rộng
  SettingsReadinessCard.vue   thẻ sẵn sàng
  steps/BasicsStep.vue        BuildingForm (tái sử dụng) + giá điện nước + lịch vận hành
  steps/InvoiceProfileStep.vue  hồ sơ thanh toán + email hóa đơn
  steps/ServicesStep.vue      BuildingServiceSettings + modal dịch vụ riêng + đồng bộ
  steps/InventoryStep.vue     InventoryItemsEditor + InventoryApplyModal
  steps/ContractStep.vue      BuildingContractProfileSettings
  AdvancedSection.vue         khối nâng cao (phần tài chính giữ nguyên, bọc lại)
app/utils/building-setup-steps.ts   hàm thuần deriveSetupSteps(settings)
```

- Mỗi bước tự gọi composable của nó (`useBuildingContractProfile`, `useBuildingServices`, `useInventoryTemplate`, ...). Trang cha không giữ state từng bước.
- Composable trong `app/composables/buildings/*` giữ nguyên API.
- `deriveSetupSteps` nhận dữ liệu bootstrap và quyền, trả về danh sách bước (id, tên, tóm tắt, trạng thái `ready | missing | optional`, số mục thiếu). Thẻ sẵn sàng và các dòng tóm tắt cùng đọc từ đây.
- Sau khi lưu mỗi bước gọi lại bootstrap để đồng bộ.
- Báo thay đổi chưa lưu: mỗi bước báo `dirty` lên trang cha; tái sử dụng hoặc tổng quát hóa cơ chế sẵn có (`usePortalUnsavedChanges`) thay vì viết mới.
- Server không đổi: không thêm endpoint, không đổi quyền hay validator.

## 7. Xử lý lỗi và trạng thái

Mỗi bước tự có trạng thái tải, lỗi, lưu (`UiAlert`, toast như hiện nay); một bước lỗi không ảnh hưởng bước khác. Phải bao phủ các trạng thái trống, tải, lỗi, chỉ đọc, đang lưu, thu gọn, mở, focus-visible và reduced motion.

## 8. Kiểm thử

TDD theo thứ tự:

1. `deriveSetupSteps`: đủ, thiếu một phần, tùy chọn, không có quyền, tòa nhà mới chưa có hồ sơ.
2. `SettingsStepList`: chỉ một bước mở, tự mở bước thiếu đầu tiên, theo hash, hỏi khi bỏ thay đổi chưa lưu.
3. Từng bước: chuyển các test hiện có (`building-settings-contract-profile.spec.ts`, `building-settings-prepaid-delete.spec.ts`, `building-inventory-pages.spec.ts`) sang component mới, không giảm độ phủ.
4. Redirect `/edit` và các neo cũ.
5. Thủ công trên trình duyệt: desktop và mobile 390px, tòa `qa-v2-flow`, trạng thái thẻ sẵn sàng khi thiếu và khi đủ.

## 9. Thứ tự triển khai

Mỗi bước một thay đổi nhỏ, ứng dụng vẫn chạy được:

1. `deriveSetupSteps` kèm test, `SettingsStepList`, `SettingsReadinessCard`.
2. Tách `ContractStep`, `InventoryStep`, `ServicesStep`.
3. Gộp `edit.vue` vào `BasicsStep`, thêm redirect.
4. Tách `InvoiceProfileStep`.
5. Bọc phần tài chính và dịch vụ theo hợp đồng vào `AdvancedSection`.
6. Dọn `settings.vue`, cập nhật `docs/**` và capability `buildings-ui`, chạy `typecheck`, `test`, `lint`, `knowledge:check`.

## 10. Ngoài phạm vi

- Tách nhỏ các component và composable của phần tài chính.
- Đổi dữ liệu, API, quyền, catalog dịch vụ.
- Wizard thiết lập từng bước cho tòa nhà mới.
- Thay đổi hệ thống thiết kế hay primitive mới.
