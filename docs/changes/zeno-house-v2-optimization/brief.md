---
type: change-brief
title: "ZENO House V2 — Flow Optimization Brief"
status: draft
version: "1.0"
date: "2026-11-10"
repository: "tungnguyen10/zeno-house"
base_branch: develop
reviewed_develop_commit: "999dc929d9a205cec9df40aa904453dce6b32dd7"
owner: "ZENO HOUSE"
---

# ZENO House V2 — Flow Optimization Brief

> **Mục tiêu:** Đơn giản hóa luồng vận hành nhà cho thuê trên nền V1, **không viết lại module đã hoạt động tốt**. Setup tòa nhà/phòng một lần; khi có khách mới, quản lý chỉ cần **chọn phòng → chọn/thêm khách → xác nhận điều khoản → tạo và xuất HĐ DOCX**.

## 1. Baseline và phạm vi xác minh

- Repository: [`tungnguyen10/zeno-house`](https://github.com/tungnguyen10/zeno-house/tree/develop).
- Branch: `develop`, HEAD được review: `999dc929d9a205cec9df40aa904453dce6b32dd7` (10/11/2026).
- Đã đối chiếu cấu trúc module, UI, service/API, validators, migrations, tests và các tài liệu `docs/**` liên quan.
- **Giới hạn:** Đây là source/design review. Chưa chạy full test suite, E2E trên phiên đăng nhập thật hoặc xác nhận toàn bộ migration mới đã được triển khai lên cloud tại thời điểm viết brief. Các trạng thái "đã có source", "đã xác minh DB" và "đã triển khai app" phải được phân biệt.

## 2. Nguyên tắc sản phẩm

1. **Không nhập hai lần:** Building → Room → Tenant → Contract kế thừa dữ liệu mặc định; chỉ nhập phần thay đổi.
2. **Progressive disclosure:** Chỉ bắt buộc dữ liệu đủ cho nghiệp vụ hiện tại. Không ép hoàn thiện hồ sơ Tenant trước khi tạo khách nhanh; nhưng phải có đủ trường theo template trước khi xuất HĐ.
3. **Reuse V1:** Giữ CRUD, phân quyền/scoping, service catalog, Billing, Payment ledger, Renewal/Checkout đang ổn.
4. **Snapshot khi phát hành:** Thay đổi dữ liệu Building/Room/Tenant sau này không sửa nội dung hợp đồng hoặc hóa đơn đã chốt.
5. **An toàn dữ liệu:** Các thao tác nhiều bản ghi có thể thất bại từng phần phải có cơ chế giao dịch/rollback hoặc workflow phục hồi minh bạch; chống trùng và idempotency ở backend/DB.
6. **Không phát sinh UI dư:** Không thêm wizard hoặc bước bắt buộc mới khi có thể dùng giá trị mặc định, component hiện hữu hoặc bước tùy chọn.

## 3. Flow mục tiêu

### 3.1. Setup lần đầu

```text
Building Setup (một lần)
  Thông tin tòa + bên cho thuê + ngân hàng/QR + dịch vụ + chính sách HĐ
       ↓
Room Setup (một lần)
  Tạo phòng theo tầng/hàng loạt + giá mặc định + danh sách nội thất cơ bản
       ↓
SẴN SÀNG CHO THUÊ
```

Cho phép tạo Building chỉ với trường tối thiểu hiện có rồi hoàn thiện cấu hình khi cần. Trên Building hiển thị trạng thái "Đủ thông tin lập HĐ" và "Đủ thông tin xuất hóa đơn" riêng, không đánh đồng với việc bản ghi đã được tạo.

### 3.2. Khách thuê mới

```text
Chọn phòng còn trống
  → Tìm/chọn Tenant cũ HOẶC thêm nhanh (Tên + SĐT)
  → Xác nhận: ngày bắt đầu/kết thúc, giá, cọc, điều khoản, chỉ số bàn giao
  → Hoàn thiện các trường mà template HĐ yêu cầu (nếu thiếu)
  → Tạo HĐ + xuất DOCX
```

- CCCD/VNeID AI Autofill là lối tắt **tùy chọn**, không chặn luồng nhập tay.
- Roommate và dịch vụ cho phép mở rộng/chỉnh sau; không buộc đi qua màn hình trống.
- **Không bỏ chỉ số điện/nước bàn giao**: V1 đang dùng `create_contract_with_handover` để tạo HĐ và 2 baseline readings trong một transaction; UX có thể tự điền số mới nhất nhưng phải xác nhận số thực tế.
- Có thể tách "lưu hợp đồng" và "xuất DOCX" về mặt kỹ thuật, nhưng giao diện cần dẫn dắt liền mạch; không xuất HĐ với thông tin pháp lý thiếu hoặc không đúng template.

### 3.3. Vận hành hằng tháng

```text
Chọn tòa/tháng → Nhập điện nước → Review tiền → Phát hành hóa đơn → Thu tiền/đối soát
```

Giữ Billing V1 và hiện trạng ledger. Auto bank reconciliation là phase riêng **sau V2 core**, chỉ ưu tiên khi có nhu cầu vận hành thực tế; không lồng vào PR Contract.

### 3.4. Gia hạn / Trả phòng

```text
Gia hạn: dùng lại khách + phòng + người ở + dịch vụ + số cọc; chỉ sửa điều khoản thay đổi
Trả phòng: chỉ số cuối → final bill → quyết toán cọc → ghi nhận hoàn tiền → trả phòng
```

Không làm lại core renewal/checkout. Kiểm chứng tình trạng migration và các tình huống tiền cọc trước khi mở rộng UX.

## 4. Đánh giá hiện trạng và gap cần xử lý

| Module | Source `develop` đang có | Gap / quyết định V2 |
| --- | --- | --- |
| **Building** | CRUD, owner/contact, cấu hình điện nước, lịch vận hành, service settings, invoice payment profile (ngân hàng/QR), màn hình tạo phòng nhanh | Thiếu profile **bên ký HĐ** và chính sách HĐ mặc định; setup đang chia nhiều nơi; cần trạng thái readiness theo nghiệp vụ. Không làm lại cấu hình invoice profile. |
| **Room** | CRUD, giá/diện tích, trạng thái, bulk status, giá mặc định khi tạo Contract | Chưa thấy cấu trúc inventory/nội thất trong Room; bulk create trong flow Building tạo từng room bằng request riêng, chưa atomic. |
| **Tenant** | CRUD, ảnh giấy tờ riêng tư, import/export, scoped authorization, identity uniqueness/hardening đã có kiểm chứng DB | Thiếu `TenantQuickCreate` dùng lại từ Room/Contract; Claude OCR hiện là kế hoạch, **không coi là đã ship**. |
| **Contract** | 3-step wizard (HĐ → roommate → dịch vụ), prefills rent từ Room, services từ Building, handover readings, amendments, renewals, checkout | Chưa thấy DOCX template/generator; tạo roommate sau tạo HĐ bằng các request độc lập có thể partial success; nhiều trường/step chưa cần thiết cho tạo nhanh. |
| **Billing** | Meter → draft/review → issue → payment → close/reopen; atomic close migration và SQL verification đã có bằng chứng | Giữ core; đối soát rollout và đóng các hồ sơ change/reconciliation trước khi tuyên bố hoàn tất. |
| **Payment** | Contract payments + invoice payments, QR/ngân hàng cho hóa đơn | Auto bank reconciliation chưa thấy trong scope hiện tại; không gộp vào V2 core. |
| **Renew / Checkout** | Atomic renewal migration, chuyển dữ liệu roommate/service/deposit; final bill, settlement và refund recording | Giữ core; verify migration tiền cọc và mã hóa đơn checkout mới nhất, không coi Git migration là production deployment. |

### Các vấn đề source xác nhận trực tiếp

1. `app/composables/buildings/useBuildingForm.ts` tạo Building rồi `Promise.all` nhiều `POST /api/rooms`; lỗi có thể để lại dữ liệu một phần; room mặc định `floor: 1`.
2. `app/pages/dashboard/buildings/create.vue` có preview bulk room nhưng cấu trúc preview tái tạo từ computed state; cần kiểm tra/sửa hành vi chỉnh giá riêng và số tầng thực tế.
3. `app/pages/dashboard/contracts/create.vue` tạo HĐ rồi `Promise.allSettled` thêm roommate. Khi một request thất bại, HĐ đã tồn tại và UI cảnh báo cần thêm lại bằng tay.
4. `app/components/contracts/ContractForm.vue` đã lấy `monthlyRent` từ Room, đọc meter readings mới nhất; giữ lại thay vì code lại.
5. `docs/changes/tenant-v2/spec-and-implementation-plan.md` đang chia Tenant V2 thành B (hardening hoàn thành) → A (quick create) → C (Claude identity autofill). **Không lập lại change B.**
6. Các migration `20261110090000_contract_deposit_single_source.sql` và `20261110100000_checkout_invoice_sequential_code.sql` có trong `develop`; cần kiểm tra rollout, đặc biệt tiền cọc và reconciliation.

## 5. Thiết kế tối thiểu từng module

### 5.1. Building Setup V2

**Kế thừa dữ liệu đang có:** tên/địa chỉ, thông tin chủ sở hữu/liên hệ, bảng giá điện nước, service defaults, lịch billing, invoice bank/QR.

**Bổ sung đúng phần thiếu:**

- `lessor_profile` / cấu hình bên **ký hợp đồng**: loại chủ thể (cá nhân/doanh nghiệp), tên pháp lý, mã số định danh hoặc MST tùy loại, địa chỉ liên hệ, đại diện/chức danh (nếu có). **Không đồng nhất mặc định `owner_name` với người ký HĐ.**
- Chính sách HĐ mặc định: thời hạn, ngày thanh toán, chính sách đặt cọc, điều khoản áp dụng, template DOCX mặc định.
- Readiness theo nghiệp vụ: `contract_ready` (đủ trường bắt buộc của template), `billing_ready` (đủ ngân hàng/QR và cấu hình hóa đơn). Readiness **được tính theo dữ liệu**, không nhất thiết lưu cột trạng thái.
- Trường mặc định phải cho phép contract-level override; thay đổi defaults không hồi tố hợp đồng cũ.

**Không làm:** quản lý nhiều ngân hàng phức tạp, nhiều bên ký / owner revenue sharing, engine rule tổng quát ở phase này, hoặc thay thế invoice profile.

### 5.2. Room Setup V2

- Tạo nhanh theo `building → floor → room_number`, preview toàn bộ phòng trước lưu, chỉnh giá/diện tích riêng từng phòng.
- Chống trùng `(building_id, room_number)` tại DB/service, backend kiểm tra building scope.
- Danh sách nội thất tối giản `{name, quantity, condition, note?}` theo Room; cho phép clone/snapshot vào biên bản bàn giao hoặc Contract khi cần.
- Không tạo asset lifecycle, serial number bắt buộc, khấu hao hoặc kho vật tư.

### 5.3. Tenant Quick Create

- Component dùng chung `TenantPickerWithQuickCreate` (tên cụ thể có thể điều chỉnh theo convention hiện tại).
- Chế độ `search existing | manual quick create | identity image autofill (future)`.
- Nhập tay tối thiểu theo validator hiện tại: **họ tên + số điện thoại**; không ép CCCD ngay khi tạo Tenant.
- Search/duplicate check chỉ trả về hồ sơ trong scope được phép; ngoài scope không lộ PII.
- Sau khi tạo/chọn, trả `tenant_id` và giữ nguyên Room/Contract draft; không điều hướng sang Tenant Detail.
- Các trường pháp lý thiếu được yêu cầu bổ sung **trước khi xuất HĐ**, không phải trước khi lưu tenant nhanh.

### 5.4. Contract Quick Create + DOCX

- Dữ liệu điền sẵn từ Building + Room + Tenant + service defaults; quản lý xác nhận `start/end date`, rent, deposit, payment due day/overrides; giữ baseline meter readings.
- Roommate/services/notes được nhóm trong tùy chọn mở rộng. Nếu người dùng thêm roommate **trong giao dịch tạo HĐ**, không để trạng thái partial không thể tự phục hồi; hoặc dùng atomic batch, hoặc chuyển bổ sung roommate thành bước hậu tạo với trạng thái rõ và retry idempotent.
- **Một DOCX template chuẩn**, versioned, placeholder mapping tường minh; không sửa trực tiếp file mẫu tại runtime.
- Phải validate field bắt buộc theo template, không trộn thông tin người ký với dữ liệu nhận tiền ngân hàng, không đoán thông tin pháp lý.
- Sinh DOCX server-side; lưu metadata `template_version`, `generated_at`, `source_snapshot` (được giới hạn PII/permission phù hợp), link tải từ vùng lưu trữ private nếu cần lưu; tránh nhúng dữ liệu pháp lý vào audit log hoặc public URL.
- Template được thay đổi sau này không được âm thầm thay thế bản HĐ đã phát hành.
- Không triển khai e-sign, workflow phê duyệt pháp lý phức tạp, hay các loại hợp đồng tùy biến trong V2 core.

### 5.5. Billing / Payment / Renewal

- Không đổi công thức tính tiền, sự kiện thanh toán và sổ ghi nhận hiện tại nếu không có lỗi chứng minh được.
- Đối chiếu migration/RPC cloud cho `renew_contract_atomic`, `close_billing_period_atomic`, `reopen_billing_period_atomic` và 2 migration ngày 10/11.
- Test cạnh tranh, retry, rollback, closed-period locks, chuyển roommate/services/deposit và xử lý invoice checkout code.
- Phân tách: tiền cọc **cam kết trên hợp đồng** khác số tiền thực **đã thu**; mọi báo cáo và quyết toán cần diễn giải rõ, đặc biệt sau migration `contract_deposit_single_source`.

## 6. Kế hoạch triển khai theo PR

| PR | Phạm vi | Điều kiện hoàn thành |
| --- | --- | --- |
| **PR0 — Quick Room Data Integrity** | Sửa flow create Building + nhiều Rooms theo giao dịch an toàn hoặc cơ chế bù có thể phục hồi; thêm floor/preview và retry guard | Không có building/rooms "tạo dở" không được phản ánh rõ; lỗi không tạo trùng khi retry; kiểm tra permission và rollback |
| **PR1 — Building Defaults & Readiness** | Lessor profile, contract policy defaults, readiness và UX setup tối giản; reuse invoice settings hiện tại | Một Building setup được tái sử dụng khi lập HĐ mà không nhập lại dữ liệu ký HĐ/cấu hình dịch vụ |
| **PR2 — Room Setup & Inventory Lite** | Bulk rooms theo tầng + giá, nội thất cơ bản, handover snapshot (nếu cần ở Contract) | Tạo hàng loạt không trùng; chỉnh giá từng phòng được giữ; inventory không phát sinh nghiệp vụ thừa |
| **PR3 — Tenant Quick Create (Change A)** | Picker/tạo nhanh tại Contract và các entry point phù hợp, chống trùng trong scope, return `tenant_id` | Thêm khách xong ở lại form HĐ, không mất room/date/draft; không lộ PII ngoài scope |
| **PR4 — Contract Quick Create & DOCX** | Prefill + confirm summary, optional roommate/services, validation theo template, DOCX generator versioned | Từ phòng trống tạo HĐ, bàn giao và xuất DOCX đúng placeholder; không có flow partial không xử lý được |
| **PR5 — Claude CCCD/VNeID Autofill (Change C)** | Vision structured extraction, user review, privacy, security, quota, fallback | OCR là suggestion, không tự ghi đè; cho phép manual; kiểm tra false match/privacy/cost. Chỉ triển khai khi privacy gate đạt |

**Thứ tự:** PR0 → PR1 → PR2 → PR3 → PR4; PR5 độc lập về UX sau PR3 và **không chặn** PR4 nếu chưa phê duyệt privacy. Nếu PR0 và PR2 dùng chung endpoint bulk room, thiết kế API/DB ngay từ PR0 để tránh làm hai lần.

**Tách scope rõ:** Mỗi PR có spec + implementation plan trong `docs/changes/<change-name>/`, cập nhật `docs/capabilities/**` khi chấp nhận; PR vào `develop`, không đẩy thẳng `main`.

- PR0: [atomic-building-room-setup](../atomic-building-room-setup/index.md)
- PR1: [building-contract-defaults](../building-contract-defaults/index.md)

## 7. Acceptance scenarios (bắt buộc)

1. **First setup:** Tạo Building, cấu hình đủ để ký HĐ và nhận tiền mà không trùng dữ liệu giữa form và settings.
2. **Bulk rooms:** Tạo nhiều phòng trải trên nhiều tầng; chỉnh giá từng phòng; lỗi một phòng không âm thầm để lại batch dở, retry không sinh bản ghi trùng.
3. **Tenant existing:** Tìm/chọn khách cũ thuộc phạm vi được phép, không tạo tenant mới.
4. **Tenant new:** Nhập tên + SĐT từ Contract; sau lưu vẫn giữ room và các trường hợp đồng đã nhập.
5. **Permission/PII:** Tìm trùng CCCD/SĐT ngoài scope không trả thông tin nhạy cảm; manager/owner chỉ thao tác trong building được phép.
6. **Contract minimum:** Tự điền giá thuê và service defaults, xác nhận chỉ số bàn giao; tạo HĐ hợp lệ chỉ khi các trường bắt buộc được nhập.
7. **DOCX:** Render đúng tên người ký, tenant, room, ngày, tiền thuê/cọc và điều khoản từ template; không để placeholder chưa thay; template upgrade không sửa HĐ cũ.
8. **Roommate:** Lỗi thêm roommate không khiến UI thông báo HĐ hoàn tất sai; người dùng có hướng retry rõ ràng hoặc transaction rollback.
9. **V1 regression:** Billing preview/issue/pay/close, renewal, checkout, invoice history vẫn chạy đúng; kiểm chứng số dư cọc và migration mới trên môi trường phù hợp.
10. **Mobile:** Luồng Room → Tenant → Contract hoạt động trên mobile viewport thông dụng; nhập/chọn CCCD chỉ thử với dữ liệu giả lập trước privacy approval.

## 8. Definition of Done chung

- Có tests cho validators, services/APIs, migration SQL, permission/scope, UI journey và retry/rollback.
- `npm run typecheck`, `npm test`, `npm run lint`, `npm run knowledge:check` đều đạt trong CI (hoặc ghi rõ blocker không thuộc PR).
- Migration cần áp dụng được kiểm tra staging/cloud, regenerate database types theo quy trình; không chỉnh generated types bằng tay.
- QA tối thiểu desktop/mobile; không rò CCCD/PII trong public assets, logs, audit metadata hoặc lỗi API.
- Cập nhật source-of-truth `docs/**`; không tạo lại cấu trúc `knowledge/**`, `openspec/**` hoặc `docs/superpowers/**`.
- Chỉ merge vào `develop` sau review; `main` và production rollout là quyết định riêng.

## 9. Việc cần xác minh trước khi code PR0–PR4

- Trạng thái cloud/schema, quyền và dữ liệu legacy của `atomic_contract_renewal`, `atomic_billing_close` và hai checkout migrations ngày 10/11.
- Trường ký hợp đồng thực tế trong DOCX template đã chốt (bên cho thuê cá nhân hay doanh nghiệp, người ký, địa chỉ, số định danh, điều khoản).
- Thiết kế nguồn dữ liệu giá/điều khoản `Building → Room → Contract`, quy tắc fallback và snapshot.
- Lựa chọn rollback toàn batch vs. lưu thành công một phần có retry có kiểm soát cho bulk room. **Khuyến nghị nguyên tử** cho setup một lần.
- Cách lưu/giao HĐ DOCX: download-only trước, hay lưu bản phát hành private kèm version/audit; không cần e-sign ở V2.

## 10. Ngoài phạm vi V2 Core

- Xây lại Billing hoặc ledger Payment.
- Hệ thống đối soát ngân hàng tự động, tích hợp SePay, nhiều tài khoản/ngân hàng theo tỷ lệ owner (để phase sau).
- eKYC/NFC/xác minh CCCD thật giả, e-sign, nhận diện khuôn mặt.
- Engine quy tắc HĐ nhiều nhánh hoặc trình dựng template động.
- Asset management/khấu hao/kho vật tư đầy đủ.
- Refactor tổng thể UI/design system chỉ để đổi phong cách.

## 11. Ưu tiên cuối cùng

**P0:** Sửa lỗi integrity bulk Building/Room và xác nhận migration tài chính mới nhất.

**P1:** Building defaults + Room bulk + Tenant Quick Create + Contract DOCX.

**P2:** Claude OCR sau privacy gate; auto payment reconciliation là roadmap riêng.

**KPI mục tiêu sản phẩm** (đề xuất, cần đo baseline V1 trước khi chốt): từ một Room đã sẵn sàng, người quản lý hoàn thành tạo Tenant + Contract + DOCX trong **một luồng liên tục**, không phải nhập lại thông tin Building/Room, không cần mở trang Tenant riêng. Đo thời gian hoàn tất, số trường phải tự nhập, lỗi validate và tỉ lệ bỏ dở trước/sau V2.

---

**Tài liệu đối chiếu chính trong repo:**

- [`docs/features/property-operations.md`](https://github.com/tungnguyen10/zeno-house/blob/develop/docs/features/property-operations.md)
- [`docs/features/contracts.md`](https://github.com/tungnguyen10/zeno-house/blob/develop/docs/features/contracts.md)
- [`docs/features/billing.md`](https://github.com/tungnguyen10/zeno-house/blob/develop/docs/features/billing.md)
- [`docs/changes/tenant-v2/spec-and-implementation-plan.md`](https://github.com/tungnguyen10/zeno-house/blob/develop/docs/changes/tenant-v2/spec-and-implementation-plan.md)
- [`docs/history/2026-11-09-harden-tenant-identity-data/verification.md`](https://github.com/tungnguyen10/zeno-house/blob/develop/docs/history/2026-11-09-harden-tenant-identity-data/verification.md)
- [`app/composables/buildings/useBuildingForm.ts`](https://github.com/tungnguyen10/zeno-house/blob/develop/app/composables/buildings/useBuildingForm.ts)
- [`app/pages/dashboard/contracts/create.vue`](https://github.com/tungnguyen10/zeno-house/blob/develop/app/pages/dashboard/contracts/create.vue)
- [`docs/changes/atomic-contract-renewal/`](https://github.com/tungnguyen10/zeno-house/tree/develop/docs/changes/atomic-contract-renewal)
- [`docs/changes/atomic-billing-close/`](https://github.com/tungnguyen10/zeno-house/tree/develop/docs/changes/atomic-billing-close)