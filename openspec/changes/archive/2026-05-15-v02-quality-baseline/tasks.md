## 1. Audit

- [x] 1.1 Grep `server/api/**` — liệt kê handlers thiếu `requireAuth(event)`
- [x] 1.2 Grep `server/services/**` — liệt kê methods thiếu `can()` check
- [x] 1.3 Chạy `npm run lint` và ghi lại tất cả warnings (`no-console`, `no-explicit-any`)

## 2. Fix

- [x] 2.1 Fix mọi `console.log` / `console.info` sót trong `server/` và `app/` (thay bằng `createError` hoặc silent)
- [x] 2.2 Fix `@typescript-eslint/no-explicit-any` warnings không cần thiết; thêm `eslint-disable-next-line` comment cho chỗ legitimate
- [x] 2.3 Fix bất kỳ handler thiếu `requireAuth` hoặc service method thiếu `can()` phát hiện ở bước 1

## 3. Tighten Rules

- [x] 3.1 Nâng `no-console` từ `warn` → `error` trong `eslint.config.mjs`

## 4. Verify

- [x] 4.1 Chạy `npm run lint && npm run typecheck` — 0 errors, 0 warnings
- [x] 4.2 Verify `quality-config` spec: lint + typecheck còn pass
