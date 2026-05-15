## Context

v0.3 thêm financial flow: utility readings, service fees, invoices, payments, billing summary — nhiều API endpoints và UI screens mới. Quality baseline đảm bảo không có lỗ hổng permission hay lint warning mới.

## Goals / Non-Goals

**Goals:**
- 0 lint errors, 0 warnings sau v0.3
- Tất cả financial API endpoints có `requireAuth` + `can()` check
- Loading/empty/error states trên các screen mới
- Final `npm run lint && npm run typecheck` clean

**Non-Goals:**
- Thêm automated tests (phase sau)
- Refactor pattern — chỉ fix issues tìm được

## Decisions

**D1 — Audit bằng grep (giữ pattern từ v0.2 quality baseline)**
Không thêm tooling mới. Grep `server/api/**` cho `requireAuth`, grep `server/services/**` cho `can()`. Fix thủ công nếu thiếu.

**D2 — Financial permissions cần được thêm vào `permissions.ts`**
Các capability mới: `utility-readings.read/create`, `service-fees.read/create/update/delete`, `invoices.read/create/update`, `payments.read/create/delete`. Admin: full. Manager: read only.

## Risks / Trade-offs

- **Phạm vi audit rộng hơn v0.2**: v0.3 thêm nhiều files hơn → audit lâu hơn. Vẫn manageable với grep.
