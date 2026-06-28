## 1. Backend foundation

- [x] 1.1 Define `InvoiceListItem` type và `InvoiceListQuery` zod schema trong `app/utils/validators/invoices.ts` (mới); export type cho cả client + server
- [x] 1.2 Tạo `server/repositories/invoices.ts` với method `listCrossPeriod(filter, scope)` — Supabase query JOIN `invoices` + `buildings` + `rooms` + `contracts` + `tenants`, áp permission scope (manager: building_id IN assigned)
- [x] 1.3 Tạo `server/services/billing/invoice-query.ts` (hoặc extend file hiện có nếu nhẹ) — đảm nhận compute `overdue` status derived, default sort, validate page_size cap
- [x] 1.4 Tạo `server/api/invoices/index.get.ts` — auth guard, Zod validate query, gọi service, trả envelope `{ data, meta }`
- [x] 1.5 Kiểm tra DB index `(building_id, period_year, period_month, status)` trên `invoices`; nếu chưa có → thêm migration với raised review (chỉ thêm index, an toàn)
- [x] 1.6 Permission test: manager với building khác bị 403, manager không gửi `building_id` chỉ thấy invoice thuộc assigned, admin thấy tất cả
- [x] 1.7 Unit test cho `invoice-query` service: multi-status OR, tenant_search case-insensitive, overdue derivation, page_size cap

## 2. Frontend page foundation

- [x] 2.1 Thêm constant icon mapping nếu cần `IconReceipt` vào `app/assets/icons/` (svgo auto-import) hoặc reuse `IconDocumentText`
- [x] 2.2 Cập nhật `app/utils/constants/navigation.ts`: thêm `{ key: 'invoices', label: 'Hoá đơn', to: '/invoices', icon: '<IconName>' }` đúng vị trí (giữa contracts và billing)
- [x] 2.3 Tạo `app/composables/invoices/useInvoiceList.ts` — fetch + filter state + URL sync (`useRoute`/`useRouter` push replace), debounce tenant search 300ms
- [x] 2.4 Tạo `app/pages/invoices/index.vue` với `definePageMeta({ title: 'Hoá đơn' })`, page header, filter toolbar, table area, pagination
- [x] 2.5 Tạo `app/components/invoices/InvoiceFilterBar.vue` — building select, year+month picker với toggle "Tất cả tháng năm này", status multi-chip, tenant search input
- [x] 2.6 Tạo `app/components/invoices/InvoiceListTable.vue` reuse `UiTable` với columns desktop/mobile theo spec; click row emit `open`

## 3. Drawer preview

- [x] 3.1 Tạo `app/components/invoices/InvoicePreviewDrawer.vue` — UiDrawer wrapper, header (mã, tenant, room, due, status badge), nội dung tái dùng `BillingChargeBreakdown` cho charges + payments
- [x] 3.2 Tạo composable `app/composables/invoices/useInvoiceDetail.ts` lazy fetch detail (charges + payments) khi drawer mở
- [x] 3.3 Footer CTA: `[ Sao mã ]` + `[ Mở trong kỳ vận hành → ]`; KHÔNG thêm action thay đổi nào
- [x] 3.4 Action "Sao mã": copy `invoice_code` vào clipboard + show toast success
- [x] 3.5 Action "Mở trong kỳ vận hành": build URL `/billing/<building-slug>/<YYYY-MM>?invoice=<id>` qua helper `app/utils/routes/operational.ts`; navigate
- [x] 3.6 Update `app/pages/billing/[building]/[period].vue`: đọc query `invoice` khi mount, switch sang tab payments, scroll-into-view + highlight 2 giây
- [x] 3.7 Update `BillingPaymentsStep` (hoặc parent) để expose method scroll-to-invoice (ref-based hoặc query-watch internal)

## 4. URL state + pagination

- [x] 4.1 Composable sync filter state ↔ URL query (`building_id`, `period_year`, `period_month`, `status` repeatable, `tenant_search`, `page`)
- [x] 4.2 Filter change → reset `page=1` và clear URL `page` param
- [x] 4.3 Pagination controls component (reuse hoặc tạo nhẹ): hiển thị "Trang X/Y · ∑ N kết quả", nút prev/next, jump (optional)
- [x] 4.4 Scroll về top khi đổi page hoặc filter

## 5. Empty / loading / error states

- [x] 5.1 Skeleton state cho table + filter chips (10 dòng skeleton)
- [x] 5.2 Empty state với guidance text ("Đổi tháng / building / mở rộng status")
- [x] 5.3 Error state với `UiAlert severity="danger"` + nút "Tải lại"
- [x] 5.4 Loading indicator nhẹ khi đổi page/filter (không che toàn bộ, để overlay subtle)

## 6. Permissions & spec compliance

- [x] 6.1 Verify scope: manager truy cập `/invoices` chỉ thấy building được assign — viết e2e/integration test
- [x] 6.2 Unauthenticated mở `/invoices` → middleware auth redirect login
- [x] 6.3 Manager nhập tay URL với `building_id` không thuộc scope → server 403 → frontend hiển thị empty + toast info "Không có quyền truy cập building này"

## 7. Spec & docs

- [x] 7.1 Update `openspec/specs/admin-shell/spec.md` sau khi merge để sync chính thức 7 nav items
- [x] 7.2 Update `openspec/specs/billing-api/spec.md` để thêm `GET /api/invoices` (sau khi merge)
- [x] 7.3 Sync `openspec/specs/invoices-browse/spec.md` (capability mới)
- [x] 7.4 Update `docs/architecture/api.md` nếu có liệt kê endpoint
- [x] 7.5 Update `docs/architecture/frontend.md` nếu có liệt kê routes

## 8. QA & ship

- [x] 8.1 Type check (`pnpm typecheck`) pass
- [x] 8.2 Lint pass (`pnpm lint`)
- [x] 8.3 Unit tests pass; thêm test cho composable URL sync + filter logic
- [x] 8.4 Smoke test manual: 3 tòa × 6 tháng dữ liệu seed → filter / search / page / drawer / deep-link end-to-end
- [x] 8.5 Test mobile viewport: collapse cột, drawer full width
- [x] 8.6 Verify performance: list 500+ invoices vẫn dưới 1s server response (kiểm tra với explain plan nếu chậm)
- [x] 8.7 Update `docs/project-status.md` ghi nhận change archived sau khi ship
