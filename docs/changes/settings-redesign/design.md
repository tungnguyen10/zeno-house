---
type: Change Design
title: "settings-redesign-design"
status: draft
change_state: implemented
tags: [superpowers, change, settings, ux, ui, navigation]
---

# Thiết kế lại khu Cài đặt

> Thay cho bản nháp `settings-ux-foundation` (chưa commit, đã bỏ). Bản đó chủ yếu là refactor và sửa chính tả, gần như không đổi gì người dùng nhìn thấy, nên không đạt mục tiêu polish. Mockup đã duyệt nằm trong phiên brainstorm (`.superpowers/brainstorm/**`, không commit): `settings-shell.html` (phương án A), `users-page.html` (phương án A), `other-pages.html`.

## 1. Mục tiêu

Biến các trang quản trị rời rạc, mỗi trang một kiểu, thành một khu **Cài đặt** thống nhất, gọn, dùng tốt trên điện thoại:

- Một nơi duy nhất cho tài khoản cá nhân, quản trị hệ thống và lối vào cài đặt từng tòa nhà, với mọi vai trò.
- Mọi trang dùng chung một khuôn: tiêu đề, đúng một hành động chính căn mép phải nội dung, toolbar nếu cần, rồi danh sách.
- Hành động nguy hiểm không bao giờ là thứ nổi nhất trang.
- Không lỗi tràn ngang, không form chiếm hết màn hình đầu trên mobile.

Tiêu chí thành công: ở 390px và 1280px, sáng và tối, mọi trang trong khu Cài đặt không tràn ngang; hành động chính thấy ngay ở màn hình đầu; chỉ một vị trí đặt hành động chính; thuật ngữ thống nhất; đủ trạng thái loading, rỗng, lỗi, đang xử lý.

Ràng buộc: giữ token, font, màu trạng thái và các primitive hiện có ([design system](../../ui-patterns/design-system.md)). Không tạo primitive dùng chung mới. Không đổi API, quyền hay quy tắc nghiệp vụ, trừ chỗ ghi rõ ở mục 9.

## 2. Hiện trạng (đã kiểm chứng trên trình duyệt và mã nguồn)

- Sidebar có một mục "Quản trị" (chỉ admin/owner) dẫn vào 5 tab ngang `AppSettingsSubNav`. Hồ sơ và đổi mật khẩu nằm ở `/dashboard/profile/**`, chỉ vào được qua menu avatar. Cài đặt tòa nhà nằm trong trang chi tiết từng tòa.
- Tab ngang bị cắt ở 390px, không có dấu hiệu còn tab khác.
- `UiPageHeader` luôn chừa `lg:pr-44`, nên nút hành động chính và ô lọc lơ lửng giữa trang, không thẳng mép bảng.
- Quản lý người dùng: form tạo luôn mở, chiếm hết màn hình đầu trên mobile; mỗi thẻ user luôn hiện 4 control; chữ viết tắt avatar lấy 2 ký tự đầu ("BÙ") thay vì chữ cái đầu họ và tên ("BL").
- Tài khoản người thuê: bảng tràn ngang ở 390px, nút ⋮ bị cắt; nút "Gỡ" đỏ đặc ở mọi dòng; phần tài khoản mồ côi chiếm nửa màn hình khi không có lỗi.
- Yêu cầu truy cập: tên tab "Yêu cầu truy cập" nhưng H1 "Yêu cầu tài khoản"; lọc trạng thái bằng dropdown.
- Nhật ký hoạt động: câu lặp chữ ("cập nhật quỹ quỹ dự phòng", "tài liệu hợp đồng hợp đồng"), lộ mã thô ("water_input · water_input"), badge lặp động từ, email người thao tác lặp mọi dòng.
- Hồ sơ: ô kéo thả ảnh đại diện quá lớn; email và vai trò là input bị khoá nhưng trông như sửa được.
- Chính tả lẫn lộn "Xoá/Xóa", "toà/tòa" ngay trong các trang này.

## 3. Quyết định đã chốt

| Câu hỏi | Quyết định |
| --- | --- |
| Phạm vi | Cá nhân + Quản trị + lối vào cài đặt tòa nhà. Wizard cài đặt từng tòa là sub-project riêng. |
| Khung điều hướng | Hai cột trên desktop: nav cài đặt dọc nhóm Cá nhân / Quản trị / Tòa nhà cạnh nội dung. Mobile: trang danh mục, chạm để đi sâu, có nút quay lại. |
| Trang Người dùng | Danh sách gọn + ngăn chi tiết (`UiDrawer`, bottom sheet trên mobile). Thêm người dùng bằng modal. |
| Điểm vào | Sidebar "Quản trị" đổi thành "Cài đặt", mọi vai trò đều thấy. Menu avatar trỏ tới Hồ sơ mới. |
| Route cá nhân | `/dashboard/settings/profile`, `/dashboard/settings/security`; route cũ chuyển hướng. |
| Chính tả | Theo đa số trong `app/**`: "xoá", "hoá đơn", "tòa nhà". |

## 4. Kiến trúc thông tin và route

| Nhóm | Mục | Route | Ai thấy |
| --- | --- | --- | --- |
| Cá nhân | Hồ sơ | `/dashboard/settings/profile` (mới) | Mọi vai trò dashboard |
| Cá nhân | Bảo mật | `/dashboard/settings/security` (mới) | Mọi vai trò dashboard |
| Quản trị | Người dùng | `/dashboard/settings/managers` (giữ) | admin, owner |
| Quản trị | Tài khoản người thuê | `/dashboard/settings/tenant-accounts` (giữ) | admin, owner |
| Quản trị | Yêu cầu truy cập | `/dashboard/settings/access-requests` (giữ) | admin |
| Quản trị | Hiển thị tòa nhà | `/dashboard/settings/buildings` (giữ) | admin |
| Quản trị | Nhật ký hoạt động | `/dashboard/settings/history` (giữ) | admin |
| Tòa nhà | Cài đặt tòa nhà | `/dashboard/settings/building-settings` (mới) | Mọi vai trò dashboard, danh sách theo phạm vi tòa nhà của API hiện có |

- Nhóm không còn mục nào sau khi lọc theo vai trò thì không hiển thị (manager chỉ thấy Cá nhân và Tòa nhà).
- Định nghĩa nhóm và mục nằm trong `app/utils/constants/navigation.ts`, thay `NAV_SETTINGS_ITEMS` bằng danh sách có `group`. Quyền hiển thị vẫn dùng `isNavItemVisible`; middleware từng trang và server vẫn là nơi quyết định quyền thật.
- `/dashboard/profile` → `/dashboard/settings/profile`, `/dashboard/profile/password` → `/dashboard/settings/security` (chuyển hướng, giữ link cũ hoạt động).
- `/dashboard/settings`:
  - Dưới `lg`: trang danh mục theo nhóm (mỗi dòng một mục, có badge khi có).
  - Từ `lg`: thay route bằng mục đầu tiên người dùng được thấy (client-side, `replace`), vì nav dọc đã hiển thị cùng danh mục. Trong lúc chuyển, vùng nội dung hiện skeleton.
- Sidebar: mục "Quản trị" thành "Cài đặt" (`/dashboard/settings`, `activeMatch: '/dashboard/settings'`), không giới hạn vai trò. Trên mobile, mục này nằm trong sheet "Thêm" như hiện nay. Link hồ sơ ở footer sidebar và menu avatar trỏ tới `/dashboard/settings/profile`.

## 5. Khung trang Cài đặt

Một trang cha `app/pages/dashboard/settings.vue` chứa khung và `<NuxtPage />`; các trang con giữ file hiện có. `AppSettingsSubNav` được thay bằng component nav dọc của khu Cài đặt (component cấp app, không phải primitive `Ui*`).

**Desktop (`lg+`)**
- Hàng đầu của khung: chữ "Cài đặt" bên trái, chừa khoảng bên phải (`lg:pr-44`) cho cụm nút toàn cục của `AppHeader` vốn nổi ở góc trên phải. Hai cột bắt đầu bên dưới hàng này, nên tiêu đề và hành động của trang con không bị cụm nút đó đè.
- Cột trái khoảng 13rem: tiêu đề nhóm nhỏ, viết hoa, màu muted; mục đang chọn nền surface với vạch accent bên trái và `aria-current="page"`. Cột này dính khi cuộn (sticky).
- Mục "Yêu cầu truy cập" có badge số yêu cầu đang chờ (màu cảnh báo, `99+` khi quá 99, ẩn khi 0, đang tải hoặc lỗi; có nhãn `sr-only` "N yêu cầu đang chờ duyệt"). Chỉ gọi API khi người dùng là admin. Badge làm mới sau khi duyệt hoặc từ chối.
- Cột phải: nội dung trang con, chiều rộng tối đa vừa đọc (danh sách dài vẫn trải đủ cột).

**Mobile (`< lg`)**
- `/dashboard/settings` là danh mục nhóm dạng danh sách. Trang con không hiện nav dọc; header app hiện nút quay lại về danh mục (đặt qua `backTo` của `UiPageHeader`, link quay lại trong trang chỉ hiện dưới `lg`) và tiêu đề thu gọn khi cuộn như hiện nay.

**Khuôn tiêu đề trang con**
- `UiPageHeader` thêm hai tuỳ chọn, mặc định giữ nguyên hành vi cũ: `reserveGlobalActions` (mặc định bật, tắt trong khu Cài đặt để hành động chính thẳng mép phải nội dung) và `backMobileOnly` (mặc định tắt).
- Mỗi trang có tối đa một nút hành động chính (primary). Lọc và tìm kiếm nằm ở toolbar ngay dưới tiêu đề, không nằm trong header.

## 6. Từng trang

### 6.1 Người dùng (`managers`)

- Header: "Người dùng", mô tả theo vai trò như hiện tại, nút chính "Thêm người dùng".
- Toolbar: ô tìm theo tên hoặc email (`UiSearchInput`) và lọc vai trò Tất cả / Chủ nhà / Quản lý (`UiTabs` biến thể `segmented`, có số đếm). Owner chỉ thấy quản lý nên không có bộ lọc vai trò. Lọc thực hiện phía client trên danh sách đã tải.
- Mỗi dòng: avatar chữ cái đầu của từ đầu và từ cuối trong tên (một từ thì 2 ký tự đầu; không có tên thì dùng email), tên, email, chip vai trò, và chip "N tòa" hoặc nhãn cảnh báo "Chưa có tòa". Cả dòng là nút mở ngăn chi tiết; dòng mà người xem không được quản lý (owner xem owner khác) không mở được ngăn và không có hành động.
- Cảnh báo "tòa nhà chưa có quản lý" hiện có giữ nguyên nội dung, hiển thị bằng `UiAlert` phía trên danh sách.
- **Modal "Thêm người dùng"** (`UiModal`): email, mật khẩu (`autocomplete="new-password"`), họ tên tuỳ chọn, vai trò, tòa nhà tuỳ chọn (chip chọn nhiều như hiện nay). Lỗi hiển thị trong modal; thành công đóng modal, toast "Đã tạo người dùng. Hãy gửi email và mật khẩu cho họ." Modal giữ dữ liệu đã nhập khi lỗi.
- **Ngăn chi tiết** (`UiDrawer`):
  - Đầu ngăn: avatar, tên, email, vai trò.
  - "Thông tin": chế độ xem mặc định; nút "Sửa" chuyển thành form ngay trong ngăn (email, mật khẩu mới tuỳ chọn, họ tên, vai trò khi là admin), với "Lưu" và "Huỷ".
  - "Tòa nhà phụ trách": mỗi tòa một dòng gồm tên, mã, công tắc "Cho xoá dữ liệu" và nút "Bỏ gán" (ghost). Cuối danh sách là "Gán tòa nhà": chọn tòa (chỉ tòa chưa gán) rồi "Gán". Trạng thái rỗng: "Chưa được gán tòa nhà nào."
  - "Vùng nguy hiểm": nút "Xoá người dùng" chuyển thành bước xác nhận ngay trong ngăn (câu nêu hệ quả thu hồi đăng nhập, nút "Xoá vĩnh viễn" màu nguy hiểm và "Huỷ"). Không dùng `UiConfirmModal` ở đây vì `UiModal` (z-50) nằm dưới `UiDrawer` (z-65). Xoá thành công đóng ngăn.
  - Mọi thao tác trong ngăn có trạng thái đang xử lý riêng và toast thành công/thất bại; danh sách phía sau cập nhật ngay.

### 6.2 Tài khoản người thuê (`tenant-accounts`)

- Header: "Tài khoản người thuê", nút chính "Cấp tài khoản" (modal hiện có).
- Toolbar: ô tìm theo tên, mã hoặc email (lọc phía client).
- Danh sách: tên, mã và email ở dòng phụ, trạng thái liên kết; mọi hành động (Khoá/Mở lại, Đặt lại mật khẩu, Gỡ quyền truy cập hoặc Dọn liên kết) nằm trong menu ⋯, mục nguy hiểm màu đỏ và đứng cuối. Không tràn ngang ở 320px.
- Tài khoản mồ côi: khi không có lỗi và không có mục nào, hiển thị một dòng trạng thái "Không có tài khoản Auth mồ côi" kèm nút "Kiểm tra lại"; khi có mục thì mở rộng thành danh sách như hiện nay; khi lỗi thì `UiAlert`.
- Các modal xác nhận hiện có giữ nguyên, chỉ chuẩn hoá thuật ngữ.

### 6.3 Yêu cầu truy cập (`access-requests`)

- H1 "Yêu cầu truy cập" (khớp nav).
- Lọc trạng thái bằng `UiTabs` (`segmented` trên mobile): Chờ duyệt (có số đếm), Cần tiếp tục, Đã duyệt, Đã từ chối.
- Mỗi dòng: avatar, tên, email, nguồn và thời gian gửi ở dòng phụ, trạng thái; hành động Từ chối (ghost) và Duyệt/Tiếp tục (primary, nhỏ). Email chưa xác minh: nhãn cảnh báo thay cho nút Duyệt bị vô hiệu không giải thích.
- Modal duyệt và từ chối giữ nguyên hành vi.

### 6.4 Nhật ký hoạt động (`history`)

- Sửa cách ghép câu trong `app/utils/audit/display.ts` để không lặp danh từ (ví dụ "Cập nhật quỹ" + "Quỹ dự phòng" → "cập nhật Quỹ dự phòng").
- Không hiển thị mã kỹ thuật thô (khoá như `water_input`); chỉ hiển thị giá trị có nhãn tiếng Việt, còn lại ẩn.
- Bỏ badge lặp động từ đã có trong câu. Hiển thị tên người thao tác; email chỉ trong `title` hoặc phần chi tiết.
- Giữ nhóm theo ngày, bộ lọc tòa nhà và loại, phân trang hoặc tải thêm như hiện nay.

### 6.5 Hiển thị tòa nhà (`buildings`)

- Bỏ tiêu đề nhóm "Toà nhà" lặp lại tiêu đề trang; đưa trạng thái "N/M đang hiển thị" vào mô tả.
- Công tắc, cập nhật lạc quan và các trạng thái hiện có giữ nguyên.

### 6.6 Hồ sơ (`settings/profile`)

- Ảnh đại diện thành một dòng: avatar, nhãn và ràng buộc tệp, nút "Đổi ảnh" và "Xoá ảnh". Kéo thả vẫn hoạt động trên vùng dòng này. Lỗi xoá ảnh hiện toast lỗi (hiện đang im lặng).
- Tên hiển thị là input; email và vai trò là danh sách định nghĩa chỉ đọc (`UiDefinitionList`), không phải input bị khoá.
- Nút "Lưu thay đổi" chỉ bật khi có thay đổi, như hiện nay.

### 6.7 Bảo mật (`settings/security`)

- Form đổi mật khẩu hiện có chuyển sang đây, giữ validation, `autocomplete` và hành vi sau khi đổi thành công (ở lại trang Bảo mật và báo thành công, thay vì chuyển về hồ sơ).

### 6.8 Cài đặt tòa nhà (`settings/building-settings`)

- Danh sách tòa nhà trong phạm vi người dùng (API `GET /api/buildings` hiện có): tên, địa chỉ, link "Mở cài đặt" tới `buildingSettingsPath(building)`.
- Trạng thái rỗng: "Chưa có tòa nhà nào trong phạm vi của bạn." Không hiển thị độ sẵn sàng (cần API mới, ngoài phạm vi).

## 7. Thuật ngữ và phản hồi

- Chính tả: "xoá", "hoá đơn", "tòa nhà" trên mọi trang trong khu Cài đặt và component nav.
- Động từ: **Xoá** = xoá vĩnh viễn; **Bỏ gán** = gỡ người dùng khỏi một tòa, không xoá người dùng; **Gỡ quyền truy cập** = thu hồi portal của khách thuê; **Dọn liên kết** = dọn dòng người thuê mất tài khoản Auth; **Xử lý tài khoản** = xử lý tài khoản Auth mồ côi.
- Toast: thành công "Đã <động từ> <đối tượng>.", thất bại ưu tiên thông điệp từ `getApiErrorMessage` với dự phòng "Không thể <động từ> <đối tượng>.". Bổ sung dự phòng còn thiếu ở tài khoản người thuê (khoá/mở lại, đặt lại mật khẩu, gỡ quyền truy cập), gán/bỏ gán tòa nhà và xoá ảnh đại diện.
- Bảng thuật ngữ ghi vào `docs/ui-patterns/design-system.md`.

## 8. Trạng thái, khả năng truy cập, responsive

- Mỗi trang có loading (`UiSkeleton`), rỗng (`UiEmptyState` hoặc dòng trạng thái), lỗi (`UiAlert` kèm "Thử lại" khi có thể), và trạng thái đang xử lý trên đúng control đang thao tác.
- Nav cài đặt là `<nav aria-label="Cài đặt">`, nhóm có tiêu đề; mục hiện tại `aria-current="page"`. Dòng mở ngăn là `<button>` có tên truy cập đầy đủ; ngăn trả focus về dòng khi đóng.
- Không tràn ngang ở 320, 375, 390, 768, 1280px; vùng chạm tối thiểu 44px trên mobile; tôn trọng `prefers-reduced-motion` (ngăn và bottom sheet dùng chuyển động sẵn có của primitive).
- Cả giao diện sáng và tối.

## 9. Thay đổi so với yêu cầu đã chấp nhận

Khi được duyệt và xác minh, cập nhật:

- [admin-shell](../../capabilities/admin-shell.md): mục "Quản trị" chỉ cho admin/owner và điều hướng bằng `AppSettingsSubNav` được thay bằng mục "Cài đặt" cho mọi vai trò và nav dọc nhóm theo Cá nhân / Quản trị / Tòa nhà.
- [manager-assignment-ui](../../capabilities/manager-assignment-ui.md): gán, bỏ gán và quyền xoá dữ liệu thực hiện trong ngăn chi tiết người dùng; tạo người dùng qua modal.
- [scoped-user-management](../../capabilities/scoped-user-management.md), [tenant-account-provisioning](../../capabilities/tenant-account-provisioning.md), [entity-audit-log](../../capabilities/entity-audit-log.md): chỉ cập nhật phần mô tả giao diện nếu có.
- Không đổi API, quyền server hay dữ liệu.

## 10. Ngoài phạm vi

- Wizard cài đặt từng tòa nhà (`/dashboard/buildings/[id]/settings`) và `FinanceRulesSection`.
- Độ sẵn sàng cài đặt trên danh sách tòa nhà (cần API gom).
- Đếm số cho các trạng thái yêu cầu truy cập ngoài "Chờ duyệt".
- Nút chat AI nổi (chỉ bật ở dev hoặc theo cờ).
- Đổi token, font, primitive dùng chung.

## 11. Kiểm thử và xác minh

- Unit: hàm nhóm và lọc mục nav theo vai trò; chữ viết tắt avatar; ghép câu nhật ký không lặp danh từ và không lộ mã thô; chuyển hướng route cũ.
- Component: nav cài đặt (nhóm, ẩn nhóm rỗng, `aria-current`, badge 0/null/3/140); trang Người dùng (tìm kiếm, lọc, mở ngăn, gán, bỏ gán, công tắc, xoá); tài khoản người thuê (menu ⋯, dòng mồ côi); hồ sơ (lỗi xoá ảnh).
- Cập nhật các test hiện có bị ảnh hưởng (`AppSettingsSubNav`, `AppSidebar`, `route-namespaces`, các spec trang settings).
- `npm run knowledge:check`, `npm run typecheck`, `npm test`, `npm run lint`.
- QA trình duyệt ở 390px và 1280px, sáng và tối, với tài khoản admin, owner và manager; ghi bằng chứng vào `verification.md`. Đây là gate riêng, không suy ra từ test tĩnh.

## 12. Rủi ro

| Rủi ro | Giảm thiểu |
| --- | --- |
| Link cũ tới `/dashboard/profile/**` bị gãy | Trang chuyển hướng và test route |
| Đổi `UiPageHeader` ảnh hưởng trang khác | Chỉ thêm tuỳ chọn, giữ mặc định; kiểm tra lại các trang không thuộc Cài đặt |
| Xác nhận xoá trong ngăn bị bấm nhầm | Hai bước rõ ràng, nút xác nhận màu nguy hiểm, focus chuyển về "Huỷ" khi mở bước xác nhận |
| Chuyển hướng `/dashboard/settings` trên desktop gây nháy | Skeleton trong vùng nội dung, `replace` để không thêm lịch sử |
| Manager lần đầu thấy mục "Cài đặt" | Chỉ hiển thị Cá nhân và Tòa nhà; server giữ nguyên quyền |
