## 1. Audit

- [ ] 1.1 Grep `server/api/**` — liệt kê handlers thiếu `requireAuth(event)`
- [ ] 1.2 Grep `server/services/**` — liệt kê methods thiếu `can()` check
- [ ] 1.3 Verify tất cả financial capabilities đã khai báo trong `server/utils/permissions.ts`
- [ ] 1.4 Chạy `npm run lint` — ghi lại warnings còn sót

## 2. Fix

- [ ] 2.1 Fix mọi handler thiếu `requireAuth` hoặc service method thiếu `can()`
- [ ] 2.2 Fix lint warnings còn sót trong v0.3 code
- [ ] 2.3 Review loading/empty/error states trên các screens mới

## 3. Verify

- [ ] 3.1 Chạy `npm run lint && npm run typecheck` — 0 errors, 0 warnings
