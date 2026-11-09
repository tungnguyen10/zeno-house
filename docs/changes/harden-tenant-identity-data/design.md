---
type: Change Design
title: "2026-11-09-harden-tenant-identity-data-design"
status: draft
change_state: implementation-verified-rollout-pending
tags: [superpowers, change, migration, security, tenants]
---

> Thiết kế đã thống nhất ngày 2026-11-09; source, migration và test đã được triển khai. Cloud rollout được theo dõi riêng trong implementation-plan.md.

# Gia cố dữ liệu định danh Tenant (Tenant V2 — change B)

## Bối cảnh

[Tenant V2](../tenant-v2/spec-and-implementation-plan.md) được tách thành ba change theo thứ tự:

1. **B — change này:** chống trùng ở DB, không lộ dữ liệu khi trùng, bỏ PII khỏi bản nháp và audit.
2. A — Tenant Quick Create trong luồng Room/Contract, dùng mã lỗi 409 của change này để đề xuất dùng lại khách.
3. C — Tự điền từ ảnh CCCD bằng Claude, bị chặn bởi duyệt pháp lý và benchmark.

Mô hình nghiệp vụ: một doanh nghiệp, nhiều tòa nhà, owner/manager bị giới hạn theo tòa. Mỗi người có một hồ sơ Tenant dùng lại, nên SĐT và CCCD phải duy nhất **trên toàn hệ thống**. Vì vậy mọi phản hồi "trùng" đều ngầm xác nhận giá trị đã tồn tại; change này giảm mức lộ xuống tối thiểu chứ không loại bỏ hoàn toàn.

## Hiện trạng (nhánh `develop`)

- `tenants.phone`, `tenants.id_number` là `text` thường, không có unique index. Unique duy nhất là `tenants_code_uq`.
- Validator chỉ giới hạn `max(20)` cho `phone` và `id_number`, không chuẩn hóa.
- `TenantService.create/update` gọi `TenantRepository.findByPhone/findByIdNumber` trên toàn bảng rồi trả `throwConflict('Số điện thoại đã tồn tại' | 'Số CMND/CCCD đã tồn tại')`.
- `bulkCreate` dùng `findExistingIdentifiers` toàn bảng, trả lý do `duplicate_phone` / `duplicate_id_number` cho từng dòng.
- `TenantProfileService.update` (cổng khách thuê) kiểm tra trùng CCCD với thông báo cụ thể và **không kiểm tra trùng SĐT**.
- `useTenantForm` → `useLocalFormDraft` lưu toàn bộ form vào `localStorage` (`tenant-form:create`, `tenant-form:edit:<id>`).
- `AuditService.append` nhận nguyên đối tượng tenant ở `before_data`/`after_data`; trang `/dashboard/settings/history` in JSON thô.
- Đã có bộ giới hạn tần suất lưu trên DB: bảng `ai_rate_limit_buckets`, RPC `consume_ai_rate_limit` (`server/repositories/ai/rate-limits.ts`).

## Quyết định đã chốt

1. **Thứ tự B → A → C**, mỗi change có proposal/design/plan riêng.
2. **CCCD trùng với hồ sơ ngoài phạm vi quyền:** trả 409 với thông báo chung "Không thể tạo hồ sơ với thông tin này; liên hệ quản trị viên", không nói trùng trường nào, không lộ tên/tòa/ID, có giới hạn tần suất. Admin gắn khách thủ công.
3. **SĐT:** vẫn duy nhất, được chuẩn hóa, có unique index ở DB, dùng cùng quy tắc thông báo chung như CCCD.
4. **Dữ liệu trùng sẵn có:** chạy preflight chỉ đọc, admin dọn tay; migration tự dừng nếu còn trùng.
5. **Quy tắc SĐT:** ưu tiên số VN, vẫn nhận số quốc tế, lưu giá trị đã chuẩn hóa ngay trong cột `phone`.
6. **Cách đảm bảo không trùng:** unique index ở DB làm chốt cuối, service kiểm tra trước để trả lỗi thân thiện, và chuyển `23505` thành 409. Không dùng RPC tạo tenant hay advisory lock.

## 1. Dữ liệu và migration

### 1.1 Chuẩn hóa

`app/utils/tenant-identity.ts` (dùng chung client/server):

- `normalizeTenantPhone(input: string): string | null`
  - Bỏ khoảng trắng, `.`, `-`, `(`, `)`.
  - `+84` hoặc `84` theo sau đúng 9 chữ số → `0` + 9 chữ số.
  - Bắt đầu bằng `0` và gồm 10 chữ số → giữ nguyên.
  - Bắt đầu bằng `+` (không phải `+84`) và gồm 8–15 chữ số sau dấu `+` → giữ nguyên dạng `+<chữ số>`.
  - Trường hợp khác → `null` (validator báo "Số điện thoại không hợp lệ").
- `normalizeTenantIdNumber(input: string | null | undefined): string | null`
  - Trim, bỏ khoảng trắng, viết hoa. Chuỗi rỗng → `null`.
  - Không ép định dạng 9/12 chữ số vì khách nước ngoài dùng hộ chiếu. Giữ `max(20)` hiện có.

Validator `tenantCreateSchema`, `tenantUpdateSchema`, schema import và `tenantProfileUpdateSchema` dùng `transform` qua hai hàm này. `emergency_contact_phone` không thuộc phạm vi.

### 1.2 Hàm SQL tương ứng

- `public.normalize_tenant_phone(text) returns text` và `public.normalize_tenant_id_number(text) returns text`, `immutable`, cùng quy tắc với TypeScript. SQL dùng tập khoảng trắng ECMAScript tường minh và collation Unicode gốc `pg_catalog."und-x-icu"` để tránh phụ thuộc locale; fixture chung gồm NBSP, BOM, EM SPACE, tab/CRLF và uppercase Unicode. Với SĐT không hợp lệ, hàm SQL trả lại chuỗi đã bỏ ký tự ngăn cách (không trả `null`) để không làm mất dữ liệu cũ; validator ở server chặn giá trị mới không hợp lệ.
- Một bộ dữ liệu mẫu dùng chung (fixture) được test qua cả TypeScript và SQL để đảm bảo cùng kết quả.

### 1.3 Preflight chỉ đọc

`supabase/verification/tenant-identity-duplicates.sql`: nhóm theo `normalize_tenant_phone(phone)` và `normalize_tenant_id_number(id_number)`, chỉ xuất `kind`, `group_no`, `tenant_id`, `code`, `group_size`. Không xuất tên, SĐT, CCCD.

### 1.4 Migration

Thứ tự trong một migration:

1. Tạo hai hàm chuẩn hóa.
2. Đếm nhóm trùng sau chuẩn hóa; nếu > 0 thì `raise exception` với số nhóm của từng loại, không kèm giá trị.
3. `update tenants` ghi giá trị đã chuẩn hóa cho `phone` và `id_number`.
4. `create unique index tenants_phone_uq on tenants (phone)`.
5. `create unique index tenants_id_number_uq on tenants (id_number) where id_number is not null`.
6. Trigger `before insert or update of phone, id_number` gọi hai hàm chuẩn hóa, để mọi đường ghi (service, cổng khách thuê, SQL admin) đều đi qua cùng quy tắc.

Quy trình cloud: preflight → admin dọn tay → migration → kiểm tra index tồn tại → tạo lại `database.types.ts` bằng công cụ sinh type (không sửa tay).

## 2. Xử lý khi trùng, phân quyền và giới hạn tần suất

### 2.1 Một điểm xử lý chung

`server/services/tenants/identity-conflict.ts` — `TenantIdentityConflictService`:

1. Repository tìm hồ sơ trùng theo giá trị đã chuẩn hóa, chỉ select `id` (loại trừ hồ sơ đang sửa nếu có). Khi DB trả `23505` trên `tenants_phone_uq`/`tenants_id_number_uq`, service tìm lại một lần.
2. `TenantAuthorizationService.resolveTenants` tính quyền của người gọi trên hồ sơ trùng.
3. Trả một trong hai lỗi 409:

| Quyền trên hồ sơ trùng | Phản hồi |
| --- | --- |
| `full` (admin luôn thuộc nhóm này) | `code: TENANT_DUPLICATE`, `fieldErrors` chỉ rõ `phone` hoặc `id_number`, kèm `details.existingTenantId` |
| `basic` / `none` | `code: TENANT_IDENTITY_CONFLICT`, message "Không thể tạo hồ sơ với thông tin này; liên hệ quản trị viên", không có `fieldErrors`, không có ID |

Thông báo chung giống hệt nhau bất kể trùng SĐT, CCCD hay cả hai.

### 2.2 Theo từng đường ghi

- **`POST /api/tenants`** và **`PATCH /api/tenants/:id`:** theo bảng 2.1.
- **Import Excel (`bulkCreate`):** `findExistingIdentifiers` trả thêm `id` để xét quyền. Dòng trùng với hồ sơ `full` giữ lý do `duplicate_phone`/`duplicate_id_number`; dòng trùng với hồ sơ `basic`/`none` dùng lý do mới `identity_conflict` và message chung. Trùng trong cùng file giữ lý do cụ thể như hiện tại. Lỗi `23505` khi chèn (import đồng thời) giữ hành vi hiện có `unexpected_error` cho cả lô, vì lô được chèn bằng một câu lệnh nên không xác định được dòng gây trùng.
- **Cổng khách thuê (`TenantProfileService.update`):** luôn dùng thông báo chung cho cả SĐT và CCCD; bổ sung bắt `23505` vì hiện không kiểm tra trùng SĐT.
- **Mọi đường ghi khác** dính `23505` trên hai index này: chuyển thành 409 chung, không lộ tên index hay câu lỗi Postgres.

### 2.3 Giới hạn tần suất

- Tái dùng `ai_rate_limit_buckets`/`consume_ai_rate_limit` bằng scope mới `tenant_identity_conflict`; không đổi tên các đối tượng AI hiện có. Nếu RPC hiện tại giới hạn scope bằng check constraint, migration mở rộng danh sách scope.
- Chỉ tính các lần trả 409 do trùng, theo `user_id`. Mặc định 10 lần mỗi 15 phút, cấu hình bằng runtimeConfig (`tenantIdentityConflictLimit`, `tenantIdentityConflictWindowSeconds`).
- Import Excel: cộng mọi dòng trùng DB (`identity_conflict`, `duplicate_phone`, `duplicate_id_number`) vào bộ đếm, đúng theo implementation-plan; không tính trùng trong cùng file.
- Peek và record là hai thao tác riêng: các request đã qua peek đồng thời có thể vượt ngưỡng; đây không phải quota admission đồng thời nghiêm ngặt.
- Khi vượt ngưỡng: 429 `RATE_LIMITED` kèm `retryAfterSeconds`; kiểm tra ngưỡng **trước** khi chạy truy vấn trùng để không còn dò được khi đã bị khóa.

### 2.4 Ghi nhận cho admin

Mỗi lần trả `TENANT_IDENTITY_CONFLICT`: ghi một audit event `tenant.identity_conflict` với `entity_id = existing_tenant_id`, `after_data = { fields: ['phone' | 'id_number'], source: 'create' | 'update' | 'import' | 'portal' }`. Không lưu giá trị SĐT/CCCD. Admin dùng bản ghi này để xử lý gắn khách thủ công.

## 3. PII trong bản nháp và audit

### 3.1 Bản nháp localStorage

- `useLocalFormDraft` nhận thêm tùy chọn `omitKeys: string[]`. Khi ghi, bỏ các khóa này; khi đọc, loại các khóa này rồi ghi đè lại bản nháp đã làm sạch.
- `useTenantForm` truyền `omitKeys`: `id_number`, `id_issued_date`, `id_issued_place`, `date_of_birth`, `permanent_address`, `emergency_contact_name`, `emergency_contact_phone`.
- Hành vi người dùng: tên, SĐT, giới tính, nghề nghiệp, email, ghi chú vẫn được khôi phục; các trường trên phải nhập lại sau khi tải lại trang.

### 3.2 Audit

- `server/utils/audit-redaction.ts` — `redactTenantAuditData(before, after)`, áp dụng cho `TENANT_CREATED`, `TENANT_UPDATED`, `TENANT_PROFILE_UPDATED` và các hành động ảnh CCCD.
- `id_number` → `•••• ` + 4 ký tự cuối.
- `date_of_birth`, `permanent_address`, `id_issued_date`, `id_issued_place`, `emergency_contact_name`, `emergency_contact_phone`, đường dẫn ảnh CCCD → `"[đã ẩn]"`. Nếu giá trị trước/sau khác nhau, phía after ghi `"[đã ẩn · đã thay đổi]"` để trang lịch sử vẫn hiện dòng thay đổi.
- Không sửa audit cũ. Nếu `harden-event-audit` thêm helper redaction dùng chung trước, change này dùng helper đó.

## 4. Giao diện

Chỉ thay đổi cách hiển thị lỗi trên form Tenant và cổng khách thuê:

- Có `fieldErrors` → hiện dưới trường tương ứng như hiện nay.
- `TENANT_IDENTITY_CONFLICT` → hiện thông báo chung ở đầu form, không đánh dấu trường nào.
- 429 → hiện "Bạn đã thử quá nhiều lần, vui lòng thử lại sau" kèm thời gian chờ nếu có.

Không có màn hình hay component mới. Đi theo UI polish workflow cho các trạng thái lỗi bị ảnh hưởng.

## 5. Chiến lược test (TDD)

| Lớp | Nội dung |
| --- | --- |
| Unit | `normalizeTenantPhone`, `normalizeTenantIdNumber` với fixture dùng chung; `redactTenantAuditData`; `omitKeys` và làm sạch bản nháp cũ |
| SQL | Test tĩnh migration: hàm chuẩn hóa, `raise exception` khi còn trùng, hai unique index, trigger; chạy fixture qua hàm SQL trên cloud và so với kết quả TypeScript |
| Service/API | Tạo, sửa, import, cổng khách thuê × quyền `full`/`basic`/`none`/admin; 409 cụ thể và 409 chung; `23505` khi đồng thời; 429 sau N lần 409; lỗi chung không chứa PII, ID hay tên index |
| Hồi quy | Toàn bộ test tenant, import, portal; `npm run typecheck`, `npm test`, `npm run lint`, `npm run knowledge:check` |
| Cloud | Preflight → dọn → migration → kiểm tra index → tạo lại types; ghi bằng chứng vào change |

## 6. Rủi ro còn mở

- Audit cũ vẫn chứa PII đầy đủ; cần quyết định backfill riêng, phối hợp `harden-event-audit`.
- Thông báo chung vẫn cho biết "có gì đó đã tồn tại"; giới hạn tần suất chỉ làm chậm việc dò, không chặn hoàn toàn.
- Bản ghi cũ có SĐT không hợp lệ theo quy tắc mới vẫn được giữ; khi sửa hồ sơ đó, người dùng phải nhập SĐT hợp lệ.
- Phụ thuộc vào rollout của `tenant-authorization-scope`; nếu mô hình quyền thay đổi, bảng 2.1 phải được rà lại.
