## 1. Backend foundation

- [ ] 1.1 Define `InvoiceListItem` type và `InvoiceListQuery` zod schema trong `app/utils/validators/invoices.ts` (mới); export type cho cả client + server
- [ ] 1.2 Tạo `server/repositories/invoices.ts` với method `listCrossPeriod(filter, scope)` — Supabase query JOIN `invoices` + `buildings` + `rooms` + `contracts` + `tenants`, áp permission scope (manager: building_id IN assigned)
- [ ] 1.3 Tạo `server/services/billing/invoice-query.ts` (hoặc extend file hiện có nếu nhẹ) — đảm nhận compute `overdue` status derived, default sort, validate page_size cap
- [ ] 1.4 Tạo `server/api/invoices/index.get.ts` — auth guard, Zod validate query, gọi service, trả envelope `{ data, meta }`
- [ ] 1.5 Kiểm tra DB index `(building_id, period_year, period_month, status)` trên `invoices`; nếu chưa có → thêm migration với raised review (chỉ thêm index, an toàn)
- [ ] 1.6 Permission test: manager với building khác bị 403, manager không gửi `building_id` chỉ thấy invoice thuộc assigned, admin thấy tất cả
- [ ] 1.7 Unit test cho `invoice-query` service: multi-status OR, tenant_search case-insensitive, overdue derivation, page_size cap

## 2. Frontend page foundation

- [ ] 2.1 Thêm constant icon mapping nếu cần `IconReceipt` vào `app/assets/icons/` (svgo auto-import) hoặc reuse `IconDocumentText`
- [ ] 2.2 Cập nhật `app/utils/constants/navigation.ts`: thêm `{ key: 'invoices', label: 'Hoá đơn', to: '/invoices', icon: '<IconName>' }` đúng vị trí (giữa contracts và billing)
- [ ] 2.3 Tạo `app/composables/invoices/useInvoiceList.ts` — fetch + filter state + URL sync (`useRoute`/`useRouter` push replace), debounce tenant search 300ms
- [ ] 2.4 Tạo `app/pages/invoices/index.vue` với `definePageMeta({ title: 'Hoá đơn' })`, page header, filter toolbar, table area, pagination
- [ ] 2.5 Tạo `app/components/invoices/InvoiceFilterBar.vue` — building select, year+month picker với toggle "Tất cả tháng năm này", status multi-chip, tenant search input
- [ ] 2.6 Tạo `app/components/invoices/InvoiceListTable.vue` reuse `UiTable` với columns desktop/mobile theo spec; click row emit `open`

## 3. Drawer preview

- [ ] 3.1 Tạo `app/components/invoices/InvoicePreviewDrawer.vue` — UiDrawer wrapper, header (mã, tenant, room, due, status badge), nội dung tái dùng `BillingChargeBreakdown` cho charges + payments
- [ ] 3.2 Tạo composable `app/composables/invoices/useInvoiceDetail.ts` lazy fetch detail (charges + payments) khi drawer mở
- [ ] 3.3 Footer CTA: `[ Sao mã ]` + `[ Mở trong kỳ vận hành → ]`; KHÔNG thêm action thay đổi nào
- [ ] 3.4 Action "Sao mã": copy `invoice_code` vào clipboard + show toast success
- [ ] 3.5 Action "Mở trong kỳ vận hành": build URL `/billing/<building-slug>/<YYYY-MM>?invoice=<id>` qua helper `app/utils/routes/operational.ts`; navigate
- [ ] 3.6 Update `app/pages/billing/[building]/[period].vue`: đọc query `invoice` khi mount, switch sang tab payments, scroll-into-view + highlight 2 giây
- [ ] 3.7 Update `BillingPaymentsStep` (hoặc parent) để expose method scroll-to-invoice (ref-based hoặc query-watch internal)

## 4. URL state + pagination

- [ ] 4.1 Composable sync filter state ↔ URL query (`building_id`, `period_year`, `period_month`, `status` repeatable, `tenant_search`, `page`)
- [ ] 4.2 Filter change → reset `page=1` và clear URL `page` param
- [ ] 4.3 Pagination controls component (reuse hoặc tạo nhẹ): hiển thị "Trang X/Y · ∑ N kết quả", nút prev/next, jump (optional)
- [ ] 4.4 Scroll về top khi đổi page hoặc filter

## 5. Empty / loading / error states

- [ ] 5.1 Skeleton state cho table + filter chips (10 dòng skeleton)
- [ ] 5.2 Empty state với guidance text ("Đổi tháng / building / mở rộng status")
- [ ] 5.3 Error state với `UiAlert severity="danger"` + nút "Tải lại"
- [ ] 5.4 Loading indicator nhẹ khi đổi page/filter (không che toàn bộ, để overlay subtle)

## 6. Permissions & spec compliance

- [ ] 6.1 Verify scope: manager truy cập `/invoices` chỉ thấy building được assign — viết e2e/integration test
- [ ] 6.2 Unauthenticated mở `/invoices` → middleware auth redirect login
- [ ] 6.3 Manager nhập tay URL với `building_id` không thuộc scope → server 403 → frontend hiển thị empty + toast info "Không có quyền truy cập building này"

## 7. Spec & docs

- [ ] 7.1 Update `openspec/specs/admin-shell/spec.md` sau khi merge để sync chính thức 7 nav items
- [ ] 7.2 Update `openspec/specs/billing-api/spec.md` để thêm `GET /api/invoices` (sau khi merge)
- [ ] 7.3 Sync `openspec/specs/invoices-browse/spec.md` (capability mới)
- [ ] 7.4 Update `docs/architecture/api.md` nếu có liệt kê endpoint
- [ ] 7.5 Update `docs/architecture/frontend.md` nếu có liệt kê routes

## 8. QA & ship

- [ ] 8.1 Type check (`pnpm typecheck`) pass
- [ ] 8.2 Lint pass (`pnpm lint`)
- [ ] 8.3 Unit tests pass; thêm test cho composable URL sync + filter logic
- [ ] 8.4 Smoke test manual: 3 tòa × 6 tháng dữ liệu seed → filter / search / page / drawer / deep-link end-to-end
- [ ] 8.5 Test mobile viewport: collapse cột, drawer full width
- [ ] 8.6 Verify performance: list 500+ invoices vẫn dưới 1s server response (kiểm tra với explain plan nếu chậm)
- [ ] 8.7 Update `docs/project-status.md` ghi nhận change archived sau khi ship
