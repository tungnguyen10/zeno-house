---
type: Change Design
title: "contract-documents-design"
status: draft
change_state: design-review
tags: [superpowers, change, contracts, documents, docx, pii, v2]
---

# PR4b — Contract Documents (DOCX)

> Sub-project PR4b của [ZENO House V2 — Flow Optimization Brief](../zeno-house-v2-optimization/brief.md). Phụ thuộc PR1 (hồ sơ bên cho thuê, điều khoản), PR2 (nội thất bàn giao), PR4a ([contract-quick-create](../contract-quick-create/design.md): xe, người ở, dịch vụ). Quyết định nền đã ghi ở [PR1 §8](../building-contract-defaults/design.md#8-quyết-định-chuyển-sang-pr4).

## 1. Mục tiêu

- Phát hành hợp đồng DOCX từ một mẫu chuẩn có phiên bản, điền đúng placeholder, không còn placeholder thừa.
- Lưu **file đã phát hành** trong private Storage (không ghi đè) + metadata + snapshot JSON; tải lại đúng file đó.
- Vòng đời tài liệu: bản xem trước (không lưu) → phát hành → đã ký; sai sót → hủy (`voided`) + phát hành bản thay thế. Không sửa, không xóa.
- Phụ lục (từ `contract_amendments`) là tài liệu riêng, cùng quy trình.
- Chặn phát hành khi thiếu thông tin pháp lý của bên cho thuê, khách đứng tên **và mọi người ở cùng**.

## 2. Hiện trạng

- `public/templates/HOP_DONG_THUE_PHONG_TEMPLATE.docx`: cú pháp docxtpl/Jinja (`{{ a.b }}`, `{%tr for … %}`), chưa có Phụ lục 1, có dòng "Miễn phí N xe" và một dòng "phí quản lý / dịch vụ".
- Không có thư viện DOCX trong `package.json` (có `exceljs`, `pdfkit`).
- Không có hàm đọc số tiền bằng chữ.
- Storage private đã dùng cho `building-invoice-assets` (upload `upsert: false`, signed URL ngắn hạn, không policy cho client).
- Worker định kỳ: `pg_cron` + `pg_net` gọi `/api/internal/**` với header bí mật lấy từ Vault (ví dụ `contracts/amendments/apply-due`).
- `contract_amendments` có trạng thái `draft | scheduled | applied | cancelled`, nội dung `title`, `public_content`, `effective_date`, `changes`, `before_terms`, `after_terms`.

## 3. Quyết định đã chốt

| Câu hỏi | Quyết định |
| --- | --- |
| Lưu bản phát hành | File `.docx` vào bucket private, không ghi đè; DB lưu đường dẫn, `sha256`, phiên bản mẫu, người và thời điểm phát hành, kèm snapshot JSON (tìm kiếm, báo cáo, phát hành lại). |
| Tải về | Signed URL ngắn hạn, kiểm tra quyền ở server. |
| Phụ lục | Tài liệu riêng (`type = 'appendix'`, gắn `contract_id` + `amendment_id`), cùng quy trình; không sửa file hợp đồng gốc. |
| Sai sót | Không sửa/xóa; đánh dấu `voided` (kèm lý do) và phát hành bản thay thế (`replaces_document_id`). |
| Bản nháp | Sinh tại chỗ để xem/tải, không ghi Storage/DB. |
| Lỗi giữa chừng | Lỗi insert/finalize → xóa file ngay; job định kỳ dọn file mồ côi. |
| Người ở cùng | Bắt buộc đủ giấy tờ cho **tất cả** người ở; thiếu → chặn phát hành. |
| Xe | Bảng xe trong mẫu lấy từ `contract_vehicles` (PR4a). |
| Dịch vụ | Bảng dịch vụ (tên, đơn giá HĐ, đơn vị theo `pricing_type`, ghi chú) + câu "Số người, số xe tính phí được xác định theo thực tế hằng tháng và thể hiện trên hóa đơn."; bỏ "miễn phí N xe". |
| Quyền với PII | Manager xuất được DOCX (server tự lấy dữ liệu đầy đủ); API không trả snapshot cho client. |

## 4. Mẫu tài liệu

### 4.1. Thư viện và cú pháp

- `docxtemplater` + `pizzip` (server-side, Nitro). **Cần duyệt cài dependency trước khi code.**
- Delimiter `{{ }}`; parser tự viết hỗ trợ đường dẫn chấm (`lessor.full_name`) và khoảng trắng; vòng lặp hàng bảng `{{#occupants}} … {{/occupants}}` (docxtemplater tự lặp hàng khi thẻ mở/đóng nằm trong cùng một hàng); `paragraphLoop: true`; `nullGetter` ném lỗi để không bao giờ in placeholder rỗng/thừa.
- Không dùng parser biểu thức (không cần `angular-expressions`).

### 4.2. Tệp mẫu

- Nguồn: `server/assets/contract-templates/hop-dong-thue-phong/v1.docx`, `server/assets/contract-templates/phu-luc-hop-dong/v1.docx`, kèm `manifest.ts` khai báo `{ key, version, requiredPaths[] }`.
- Tệp `public/templates/HOP_DONG_THUE_PHONG_TEMPLATE.docx` giữ nguyên (không còn là nguồn sinh).
- Thay đổi so với bản gốc khi chuyển sang v1:
  1. Đổi `{%tr for x in y %}` → `{{#y}}`, `{%tr endfor %}` → `{{/y}}`, `{{ loop.index }}` → `{{index}}`.
  2. Thay dòng "Đơn giá phí quản lý / dịch vụ …" và dòng "Đơn giá chỗ để xe: Miễn phí …" bằng bảng dịch vụ `{{#services}} {{index}} | {{name}} | {{unit_price_display}} | {{unit_label}} | {{note}} {{/services}}` + câu số lượng theo thực tế.
  3. Thêm **Phụ lục 1 — Danh sách tài sản bàn giao**: bảng `{{#inventory}} {{index}} | {{name}} | {{quantity}} | {{condition_label}} | {{unit_value_display}} | {{note}} {{/inventory}}` + tổng giá trị `{{inventory_total_display}}`; khi rỗng in "Không có tài sản bàn giao kèm theo."
  4. Giữ nguyên toàn bộ điều khoản và nội quy.
- Phiên bản mẫu bất biến: thay nội dung → thêm `v2.docx` + tăng `version` trong manifest; tài liệu đã phát hành giữ `template_version` cũ và file cũ.

### 4.3. Dữ liệu điền (`ContractDocumentData`)

| Nhóm | Trường | Nguồn |
| --- | --- | --- |
| `contract` | `number`, `signed_date_text`, `start_date`, `end_date`, `handover_date`, `monthly_rent_display`, `deposit_display`, `deposit_words`, `deposit_months_equiv`, `occupant_count`, `vehicle_count`, `signed_copies`, `copies_per_party` | `contracts`, ngày ký nhập khi phát hành, PR1 |
| `building` | `brand_name`, `address` | `buildings`, PR1 `brand_name` |
| `lessor` | 7 trường | PR1 (bản không che, chỉ ở server) |
| `tenant` | 7 trường (`full_name`, `date_of_birth`, `permanent_address`, `id_number`, `id_issued_date`, `id_issued_place`, `phone`) | `tenants` |
| `room` | `number` | `rooms` |
| `services` (mảng) | `name`, `unit_price_display`, `unit_label`, `note` | `contract_services` đang bật + `service_catalog` |
| `services` (điện/nước) | `electricity_price_display`, `water_price_display`, `water_unit` | `buildings` |
| `occupants` (mảng) | khách đứng tên + người ở cùng đang ở: 6 trường | `contract_occupants` + `tenants` |
| `vehicles` (mảng) | `owner_name`, `plate_number`, `note` (loại xe + ghi chú) | `contract_vehicles` |
| `inventory` (mảng) | `name`, `quantity`, `condition_label`, `unit_value_display`, `note`; `inventory_total_display` | bàn giao theo chuỗi gia hạn (PR2) |
| `payment` | `due_day_start`, `due_day_end`, `overdue_day` (hoặc câu thay thế khi > 31), `account_holder`, `account_number`, `bank_name`, `transfer_content` | PR1 `formatPaymentWindow`, `building_invoice_profiles` |
| `terms` | `notice_days`, `extra_occupant_fee_display`, `drilling_fee_display`, `fingerprint_reset_fee_display`, `deposit_refund_days`, `renewal_months` | PR1 |

- Ngày in `DD/MM/YYYY`; tiền `formatCurrencyNumber`; tiền bằng chữ qua hàm mới `vndToWords` ("Ba triệu đồng chẵn").
- Điện bậc thang: `electricity_price_display` = "Theo bậc thang của tòa nhà" (không liệt kê bậc).
- `payment.transfer_content`: áp mẫu nội dung CK của tòa với `{building_code}`, `{room_number}`; `{invoice_code}`, `{period}` thay bằng "mã hóa đơn", "kỳ".

### 4.4. Kiểm tra thiếu dữ liệu

`collectMissing(data)` trả mã ổn định: `lessor.*`, `tenant.*`, `occupant[{i}].{field}` (kèm tên người), `invoice_profile`, `billing.schedule`, `terms.*`. Có mã nào → **không phát hành, không cho xem trước**; UI liệt kê và dẫn link sửa (khách → trang sửa khách; bên cho thuê/điều khoản → cài đặt tòa nếu có quyền, ngược lại "Liên hệ chủ nhà để bổ sung").

## 5. Dữ liệu, Storage, RPC

### 5.1. Bucket

`contract-documents`: private, 10 MB, MIME `application/vnd.openxmlformats-officedocument.wordprocessingml.document`; không policy cho client. Đường dẫn `{building_id}/{contract_id}/{document_id}.docx`; upload `upsert: false`.

### 5.2. Bảng `contract_documents`

| Cột | Ghi chú |
| --- | --- |
| `id uuid pk` | |
| `contract_id → contracts on delete restrict` | Tài liệu pháp lý không mất theo HĐ |
| `building_id uuid` | Tra phạm vi, đường dẫn |
| `type text check in ('contract','appendix')` | |
| `amendment_id → contract_amendments null` | Bắt buộc khi `appendix` |
| `version_no int` | Tăng theo `(contract_id, type, amendment_id)` |
| `status text check in ('pending','issued','signed','voided')` | |
| `template_key text`, `template_version int` | |
| `storage_path text null`, `sha256 text null`, `size_bytes int null` | Null khi `pending` chưa upload xong |
| `snapshot jsonb not null` | Dữ liệu đã điền (chứa PII; không trả cho client) |
| `signed_date date` | Ngày ký in trên tài liệu |
| `issued_by`, `issued_at`, `signed_by`, `signed_at`, `voided_by`, `voided_at`, `void_reason`, `replaces_document_id`, `created_at` | |

- Unique partial: một tài liệu đang hiệu lực (`status in ('pending','issued','signed')`) cho mỗi `(contract_id, type, coalesce(amendment_id, zero_uuid))`.
- Trigger chặn sửa cột nội dung (`snapshot`, `storage_path`, `sha256`, `template_*`, `version_no`, `type`, `contract_id`) sau khi `status <> 'pending'`; chỉ cho chuyển trạng thái `pending → issued`, `issued → signed`, `issued|signed → voided`. Chặn `delete` trừ dòng `pending` (dọn mồ côi).
- RLS bật, không policy, chỉ `service_role`.

### 5.3. RPC

- `reserve_contract_document(p_contract_id, p_type, p_amendment_id, p_template_key, p_template_version, p_snapshot, p_signed_date, p_actor_id, p_replaces_document_id) returns public.contract_documents` — khóa theo HĐ; nếu đang có tài liệu hiệu lực và `p_replaces_document_id` khác id đó → `CONTRACT_DOCUMENT_ACTIVE_EXISTS`; nếu có `p_replaces_document_id` → đánh dấu bản cũ `voided` (cần lý do — xem 5.4) trong cùng transaction; tính `version_no`; insert `pending`.
- `finalize_contract_document(p_document_id, p_storage_path, p_sha256, p_size_bytes) returns public.contract_documents` — `pending → issued`, `issued_at = now()`.
- `mark_contract_document_signed(p_document_id, p_actor_id)`; `void_contract_document(p_document_id, p_reason, p_actor_id)` (lý do ≥ 10 ký tự).
- `claim_stale_contract_documents(p_older_than interval) returns setof public.contract_documents` — trả các dòng `pending` quá hạn để worker xóa file rồi xóa dòng.

### 5.4. Luồng phát hành

1. Server dựng `ContractDocumentData` → `collectMissing` → có thiếu thì 422 `CONTRACT_DOCUMENT_INCOMPLETE` + `details.missing`.
2. Render DOCX trong bộ nhớ (kiểm tra không còn `{{`).
3. `reserve_contract_document` (nếu thay thế: truyền `replaces_document_id` + `void_reason`, bản cũ chuyển `voided` cùng transaction).
4. Upload file vào `{building_id}/{contract_id}/{document_id}.docx`. Lỗi → xóa dòng `pending` (`delete … where id and status='pending'`).
5. `finalize_contract_document`. Lỗi → xóa file và dòng `pending`.
6. Audit `contract.document.issued` (`document_id`, `type`, `version_no`, `template_version`, `sha256`) — không PII.

Thay thế khi bản cũ đã `signed`: chỉ admin/owner; bản thay thế trên tài liệu đã ký thường nên là **phụ lục** — UI hiện cảnh báo này trước khi cho hủy.

### 5.5. Worker dọn mồ côi

`POST /api/internal/contract-documents/cleanup` (header `x-contract-documents-cleanup-secret`, runtime config `contractDocumentsCleanupSecret`): gọi `claim_stale_contract_documents('30 minutes')`, xóa object Storage nếu có, xóa dòng. `pg_cron` mỗi 15 phút theo mẫu `apply-due` (base URL + secret trong Vault). Ngoài ra quét object trong bucket không có dòng DB khớp (đường dẫn chứa `document_id` không tồn tại) và xóa nếu cũ hơn 1 giờ.

## 6. API và quyền

| Capability | Admin | Owner | Manager |
| --- | --- | --- | --- |
| `contract-documents.read` (danh sách, tải) | ✓ | ✓ | ✓ |
| `contract-documents.issue` (xem trước, phát hành) | ✓ | ✓ | ✓ |
| `contract-documents.sign` (đánh dấu đã ký) | ✓ | ✓ | ✗ |
| `contract-documents.void` (hủy + thay thế) | ✓ | ✓ | ✗ |

Mọi route kiểm tra `assertBuildingScope(contract.buildingId)`.

| Route | Mô tả |
| --- | --- |
| `GET /api/contracts/[id]/documents` | Danh sách metadata (không `snapshot`, không `storage_path`) |
| `POST /api/contracts/[id]/documents/check` | `{ type, amendment_id? }` → `{ ready, missing[] }` |
| `POST /api/contracts/[id]/documents/preview` | `{ type, amendment_id?, signed_date }` → file DOCX tải về, header `Content-Disposition`, **không lưu** |
| `POST /api/contracts/[id]/documents` | `{ type, amendment_id?, signed_date, request_id, replaces_document_id?, void_reason? }` → metadata; idempotent theo `request_id` (khóa `contract.document:<id>`) |
| `GET /api/contract-documents/[docId]/download` | Kiểm tra quyền → `{ url, expiresIn }` signed URL 60 giây |
| `POST /api/contract-documents/[docId]/sign` | |
| `POST /api/contract-documents/[docId]/void` | `{ reason }` |

Phụ lục chỉ phát hành cho amendment `scheduled` hoặc `applied`.

## 7. UI

- Chi tiết HĐ: mục mới **"Tài liệu"** (`#documents`, sau `overview`): danh sách phiên bản (loại, số phiên bản, trạng thái, mẫu, người/thời điểm phát hành, người ký), hành động: Tải, Đánh dấu đã ký, Hủy & phát hành lại.
- Hộp thoại **"Xuất hợp đồng"** (`ContractDocumentIssueDialog`): chọn ngày ký (mặc định hôm nay); gọi `check`; thiếu → danh sách mục thiếu + link; đủ → "Xem trước (không lưu)" và "Phát hành". Dùng chung cho phụ lục (mở từ dòng phụ lục trong `ContractAmendmentsSection`).
- Màn hoàn tất tạo HĐ (PR4a) bật nút "Xuất hợp đồng (DOCX)" mở hộp thoại này.
- Theo [ui-polish-workflow](../../../.agents/skills/zeno-house/references/ui-polish-workflow.md); bắt buộc `frontend-design` + Hallmark; primitive sẵn có; token/primitive mới chỉ khi đánh giá kỹ và được duyệt. Trạng thái: chưa có tài liệu, thiếu dữ liệu, đang sinh, đã phát hành, đã ký, đã hủy, lỗi upload, mobile.

## 8. Kiểm thử

| Lớp | Trọng tâm |
| --- | --- |
| `vndToWords` | 0, 1.000, 1.500.000, 10.000.000, 1.000.000.000, "lẻ", "mốt", "lăm", "tư" |
| Builder | Đủ trường đúng nguồn; điện bậc thang; câu Z > 31; kế thừa nội thất theo chuỗi gia hạn; người ở chỉ người đang ở |
| `collectMissing` | Thiếu từng nhóm; người ở cùng thiếu CCCD → mã có chỉ số + tên |
| Renderer | Fixture dữ liệu giả → DOCX mở được (unzip), không còn `{{`/`}}`, chứa tên/biển số/tổng nội thất; lỗi placeholder thiếu → ném lỗi |
| Template manifest | Mọi `requiredPaths` tồn tại trong XML của mẫu |
| Service | Thiếu dữ liệu → 422; luồng reserve → upload → finalize; upload lỗi → xóa pending; finalize lỗi → xóa file + pending; thay thế → bản cũ voided; replay `request_id`; manager không ký/hủy |
| SQL verification | Unique hiệu lực; trigger bất biến; chuyển trạng thái hợp lệ; `claim_stale`; grant |
| API | Không trả `snapshot`/`storage_path`; download kiểm tra scope; preview không ghi DB/Storage |
| Worker | Secret sai → 403; dọn đúng dòng quá hạn |
| UI | Dialog thiếu dữ liệu; phát hành; danh sách phiên bản; hủy cần lý do |

Không dùng dữ liệu cá nhân thật trong fixture.

## 9. Tài liệu

- Bundle `index.md`, `design.md`, `implementation-plan.md`, `verification.md`; link từ brief, changes index.
- Khi chấp nhận: tạo `docs/capabilities/contract-documents.md`; cập nhật [contracts-ui](../../capabilities/contracts-ui.md), [contracts-api](../../capabilities/contracts-api.md), [supabase-scheduled-workers](../../capabilities/supabase-scheduled-workers.md).

## 10. Ngoài phạm vi

- Ký điện tử, phê duyệt pháp lý nhiều bước, nhiều loại mẫu HĐ, trình dựng mẫu động.
- PDF.
- Bên cho thuê là doanh nghiệp.
- Liệt kê bậc thang điện trong HĐ.
