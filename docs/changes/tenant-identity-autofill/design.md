---
type: Change Design
title: "tenant-identity-autofill-design"
status: draft
change_state: design-review
tags: [superpowers, change, tenants, ai, ocr, privacy, v2]
---

# PR5 — Tenant Identity Autofill (Tenant V2 change C)

> Sub-project PR5 của [ZENO House V2 — Flow Optimization Brief](../zeno-house-v2-optimization/brief.md) và **change C** của [Tenant V2](../tenant-v2/spec-and-implementation-plan.md). Đặc tả sản phẩm, schema trích xuất (SPEC-05), luồng lỗi, cấu hình, benchmark và rủi ro quyền riêng tư **giữ nguyên tại tài liệu Tenant V2**; tài liệu này chỉ ghi quyết định triển khai, phần khác biệt và các gate. Phụ thuộc [PR3 tenant-quick-create](../tenant-quick-create/design.md).

## 1. Mục tiêu

Trong `TenantQuickCreateDialog` (PR3) và form khách đầy đủ, cho phép chụp/tải 1–2 ảnh căn cước hoặc screenshot VNeID → Claude Vision trích xuất → người dùng xem và **chọn áp dụng** từng trường → lưu bằng luồng tạo khách hiện có. AI chỉ gợi ý; không ghi DB, không lưu ảnh.

## 2. Gate bắt buộc trước khi bật cho dữ liệu thật

| Gate | Chủ sở hữu | Trạng thái |
| --- | --- | --- |
| G1. Duyệt cài `@anthropic-ai/sdk` | Người dùng | Chưa |
| G2. Tài khoản Anthropic, API key server, spend limit trên Console | Owner | Chưa |
| G3. Đánh giá quyền riêng tư: căn cứ xử lý CCCD, gửi bên thứ ba (Anthropic), lưu giữ, thông báo người dùng (`privacy-review.md`) | Owner + tư vấn pháp lý | Chưa |
| G4. Benchmark trên fixture **hoàn toàn giả lập** (≥ 12 smoke, ≥ 50 mở rộng) đạt ngưỡng đã thống nhất | Kỹ thuật | Chưa |
| G5. Security review endpoint (auth, scope, quota, không log PII) | Kỹ thuật | Chưa |

- Feature flag `NUXT_AI_TENANT_VISION_ENABLED=false` mặc định; endpoint trả 503 khi tắt.
- Trước G3: chỉ chạy với ảnh giả lập, chỉ trên môi trường dev/staging. Không đưa ảnh/tên/số định danh thật vào repo, fixture, log, CI.

## 3. Quyết định triển khai

| Mục | Quyết định |
| --- | --- |
| Provider | Claude Messages API qua `@anthropic-ai/sdk`, chỉ server; model chính lấy từ cấu hình (`NUXT_AI_TENANT_VISION_MODEL`), **không** tự nâng model trả phí cao hơn. Định danh model xác minh tại thời điểm triển khai. |
| Output | Structured JSON theo schema SPEC-05 (Tenant V2 §C4a), `additionalProperties: false`; Zod kiểm tra lại; mọi trường nullable. |
| Ảnh | 1–2 file JPEG/PNG/WebP ≤ 5 MB/file; kiểm tra chữ ký file; **xóa metadata (EXIF/XMP/GPS) bằng cách bỏ đoạn metadata, không giải mã/nén lại, không crop**; gửi trong một request. |
| Lưu trữ | Không lưu ảnh, không lưu kết quả; không ghi vào AI conversation; không vào localStorage. Lưu ảnh giấy tờ chỉ qua luồng upload hiện có, do người dùng chủ động. |
| Quota | Bảng `tenant_ocr_usage` theo ngày UTC: số lượt toàn hệ thống, số lượt theo người dùng, chi phí ước tính (USD, micro-USD integer); đặt chỗ trước khi gọi, chốt theo usage trả về; vượt → 429/503, không gọi provider. Mặc định 20 lượt/ngày toàn hệ thống, 10 lượt/ngày/người, 1 USD/ngày. |
| Quyền | Gọi được khi có `tenants.create` hoặc `tenants.update`; manager không có → nút không hiện, endpoint 403. |
| Áp dụng gợi ý | Không ghi đè trường người dùng đã sửa; mỗi trường có nút "Áp dụng"; có "Áp dụng tất cả trường trống". `residence_address` chỉ gợi ý vào `permanent_address` khi `address_label = noi_thuong_tru`; với `noi_cu_tru` hiển thị cảnh báo và để người dùng tự quyết. `identity_mismatch = true` → không cho áp dụng, yêu cầu thay ảnh. |
| Giới hạn tần suất | Ngoài quota ngày: tối đa 1 request đang chạy/người dùng; nút khóa khi đang xử lý. |

## 4. Thành phần

```text
TenantIdentityScanner.vue (trong TenantQuickCreateDialog / TenantForm)
  -> useTenantIdentityExtract.ts  (multipart, abort, không lưu)
  -> POST /api/tenants/identity/extract
       requireAuth + capability + feature flag
       -> validateIdentityImages (chữ ký, MIME, kích thước) -> stripImageMetadata
       -> TenantOcrQuota.reserve (DB)
       -> ClaudeIdentityProvider.extract (SDK, timeout, maxRetries=0)
       -> identityExtractionSchema (Zod) -> normalizeExtraction (ngày ISO, NFC, số định danh)
       -> TenantOcrQuota.settle(usage)
       -> { data: suggestion, meta: { model } }
```

- Server: `server/services/tenants/identity-extraction.ts`, `server/services/ai/anthropic-vision.ts`, `server/utils/image-metadata.ts`, `server/repositories/tenant-ocr-usage.ts`, `server/api/tenants/identity/extract.post.ts`.
- Shared: `app/utils/validators/tenant-identity-extraction.ts` (schema SPEC-05 + JSON Schema xuất cho provider).
- Client: `app/components/tenants/TenantIdentityScanner.vue`, `app/composables/tenants/useTenantIdentityExtract.ts`.
- Script: `scripts/benchmark-tenant-vision.mjs` (đọc fixture giả lập + ground truth, chạy model cấu hình, xuất số liệu tổng hợp không PII vào `docs/changes/tenant-identity-autofill/benchmark-results.md`).

## 5. Lỗi

Theo bảng Tenant V2 §D2.1/§D7: 401, 403, 413, 415, 422, 429 (quota), 502 (output không hợp lệ), 503 (tắt/hết ngân sách/provider lỗi), 504 (timeout). Thông báo chung, không PII; UI luôn cho nhập tay.

## 6. Kiểm thử

| Lớp | Trọng tâm |
| --- | --- |
| Schema/normalizer | Ngày `DD/MM/YYYY` → ISO; ngày sai → null + cảnh báo; giữ số 0 đầu; nhãn địa chỉ; `identity_mismatch` |
| Metadata stripper | JPEG có APP1 EXIF → bị bỏ, phần ảnh còn nguyên byte; PNG `eXIf`/`tEXt` bị bỏ; WebP `EXIF`/`XMP ` bị bỏ; file hỏng → 422 |
| Validator ảnh | Chữ ký sai MIME → 415; > 5 MB → 413; > 2 file → 422 |
| Quota | Đặt chỗ nguyên tử; vượt ngày/người/ngân sách → không gọi provider; chốt usage |
| Provider | Mock SDK: JSON hợp lệ; JSON sai → 502; timeout → 504; 429 provider → 503 + retry-after; `maxRetries: 0` |
| Endpoint | Flag tắt → 503; manager → 403; không ghi DB tenant; log không chứa base64/PII |
| UI | Chọn ảnh, xem trước, hủy thu hồi object URL; áp dụng từng trường; không ghi đè trường đã sửa; mismatch chặn áp dụng; lỗi → nhập tay |
| Benchmark | Chỉ chạy thủ công với key; fixture giả lập |

## 7. Tài liệu

- Bundle `index.md`, `design.md`, `implementation-plan.md`, `verification.md`, `privacy-review.md` (do owner điền), `benchmark-results.md` (sau benchmark).
- Link từ brief, changes index, [tenant-v2](../tenant-v2/spec-and-implementation-plan.md).
- Khi chấp nhận: cập nhật [tenant-identity](../../capabilities/tenant-identity.md), [tenants-ui](../../capabilities/tenants-ui.md), [tenants-api](../../capabilities/tenants-api.md), [ai-agent-foundation](../../capabilities/ai-agent-foundation.md) (ghi rõ provider riêng cho OCR).

## 8. Ngoài phạm vi

eKYC, NFC, xác minh thật/giả, nhận diện khuôn mặt, lưu ảnh tự động, thay provider cho AI Chat/Billing, giải mã QR/MRZ chuyên dụng.
