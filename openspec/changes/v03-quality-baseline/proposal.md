## Why

v0.3 thêm toàn bộ financial flow. Cần audit lại chất lượng: permission coverage trên financial actions, lint/typecheck clean, loading/empty/error states đủ cho các screen mới.

## What Changes

- Audit auth guard và permission check cho tất cả financial API endpoints
- Kiểm tra loading, empty, error states trên các page mới (invoices, billing, payments)
- Fix mọi lint warning còn sót
- Đảm bảo `npm run lint && npm run typecheck` = 0 errors, 0 warnings

## Capabilities

### New Capabilities

_(không có — đây là audit/fix, không có behavior mới)_

### Modified Capabilities

- `quality-config`: Verify 0 warnings baseline còn hold sau v0.3

## Impact

- Có thể fix nhỏ trong `server/api/`, `server/services/`, `app/pages/`, `app/components/`
- Không có schema changes, không có breaking changes
