## 1. Server

- [x] 1.1 Tạo `app/types/dashboard.ts` — interface `DashboardSummary` với shape từ design.md
- [x] 1.2 Tạo `server/repositories/dashboard/index.ts` — query aggregate stats (buildings count, rooms by status, tenants count, active contracts count, building breakdown)
- [x] 1.3 Tạo `server/services/dashboard/index.ts` — permission check (admin + manager), gọi repository
- [x] 1.4 Tạo `server/api/dashboard/summary.get.ts` — GET /api/dashboard/summary

## 2. Client

- [x] 2.1 Tạo `app/composables/useDashboardSummary.ts` — `useFetch('/api/dashboard/summary')`, expose `summary`, `isLoading`, `error`
- [x] 2.2 Tạo `app/components/app/AppStatCard.vue` — props: `title`, `value`, `description?`
- [x] 2.3 Cập nhật `app/pages/index.vue` — thay skeleton bằng 4 AppStatCard + building breakdown table

## 3. Verify

- [x] 3.1 Chạy `npm run lint && npm run typecheck` — 0 errors
- [ ] 3.2 Test thủ công: dashboard hiển thị đúng counts; building breakdown đúng với dữ liệu thực
