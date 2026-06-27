## Context

Buildings feature đã ổn định từ v0.1 (CRUD cơ bản + slug + service summary) nhưng chưa được polish như các feature billing mới hơn. List page không có công cụ tìm/lọc/sắp xếp, form chỉ render 4 section phẳng, detail page là tập hợp 4 card không có hệ thống quick stats. CRUD layer cũng đơn giản hoá quá mức: DELETE hard-delete không quan tâm cascade, không có bulk operations.

Stack constraints:
- Nuxt 4 với `useFetch` cho list/detail (server-side reactive) và `$fetch` cho mutations
- Pinia chỉ giữ global state (auth, sidebar) — server-state thuộc composable
- TailwindCSS + design tokens dark theme đã có sẵn (`bg-dark-surface`, `border-dark-border`, `text-cyan`, `text-muted`)
- Pattern `api → service → repository` không đổi
- API envelope `{ data, meta }` / `{ error: { code, message, details } }` chuẩn

## Goals / Non-Goals

**Goals:**
- Buildings trở thành "showcase" về UX + CRUD chắc của hệ thống — pattern dùng lại cho Rooms/Tenants/Contracts sau này.
- List page có công cụ tìm/lọc/sắp xếp/bulk action như SaaS bình thường, URL-shareable.
- Detail page có quick stats + navigation nhanh tới rooms/contracts liên quan; layout có cấu trúc rõ ràng.
- Form polish: section visual hierarchy, sticky save mobile, dirty guard, autosave draft, inline validation.
- API hardening: safe-delete với conflict, search/sort/filter ở list, endpoint bulk.
- Test baseline cho toàn bộ feature (server + components + composables).

**Non-Goals:**
- Không đổi database schema buildings (đã ổn từ product-flow-foundation).
- Không refactor mapper, route helpers, hoặc DTO shape (chỉ bổ sung query types).
- Không động vào tenant portal, billing logic, dashboard.
- Không mở rộng `contract-services/sync` response (tách change riêng).
- Không thêm soft-delete column mới — dùng `status='inactive'` cho force-delete.

## Decisions

### D1. URL-synced list state qua `useRoute().query` thay vì Pinia store

**Chọn**: `useBuildingList` đọc/ghi `route.query` cho `q`, `status`, `sort`, `order`, `page`. Refs cục bộ trong composable đồng bộ 2 chiều với query bằng `watch` + `navigateTo({ query: { ... } })`.

**Lý do**: List state phải shareable qua link, back/forward giữ filter. Pinia thừa cho 1 chỗ dùng. Composable + route đủ. Nuxt `useFetch` tự reactive theo refs nên không cần manual refetch.

**Alternative bỏ**: 
- Pinia store buildings — vi phạm `stores.instructions.md` ("only truly global state").
- `localStorage` cho filter — không share được qua link.

### D2. Safe-delete dùng cùng endpoint với query param `force`

**Chọn**: `DELETE /api/buildings/:id` mặc định check rooms + active contracts → 409 nếu có. `DELETE /api/buildings/:id?force=true` → soft-archive (set `status='inactive'`), không xoá row vật lý.

**Lý do**: Giữ 1 endpoint, semantics rõ (`force` = "tôi biết và chấp nhận"). Soft-archive đủ — không cần migration thêm cột `deleted_at` ở phase này. Khi cần hard-delete thật sự, admin xoá manually qua database hoặc chờ feature khác.

**Alternative bỏ**:
- Endpoint riêng `/archive` — tăng surface mà không thêm value, 1 method khác semantically khó nhớ.
- Soft-delete column `deleted_at` — cần migration + update mọi query để filter, scope lớn không cần thiết.

### D3. Bulk operations qua single endpoint `POST /api/buildings/bulk`

**Chọn**: 1 endpoint nhận `{ action, ids }`, action enum `archive | activate | delete`. Trả về `{ succeeded, failed }` để client hiển thị từng item.

**Lý do**: Đơn giản hơn 3 endpoint riêng (`/bulk-archive`, `/bulk-activate`, `/bulk-delete`). Pattern same với cách billing đã làm bulk. Per-item kết quả cho phép partial success (1 building không xoá được vì có contract, các building còn lại vẫn xoá).

**Alternative bỏ**:
- Loop client-side gọi N lần DELETE — chậm, nhiều round-trip, không atomic feedback.
- PATCH `/api/buildings?ids=...` — REST không khuyến khích bulk qua collection PATCH.

### D4. Form draft autosave dùng `localStorage` per-form-key

**Chọn**: Key format `building-form:create` hoặc `building-form:edit:<id>`. Lưu mỗi 500ms debounce sau thay đổi. Restore khi mount nếu key tồn tại; xoá khi submit success hoặc user click "Bỏ bản nháp".

**Lý do**: Form có ~15 field, dễ mất data nếu reload. localStorage đủ — không cần persist server-side. Per-key tránh đụng giữa create form và edit nhiều building khác nhau.

**Alternative bỏ**:
- IndexedDB — overkill cho 1 form object.
- Server-side draft endpoint — phạm vi rộng, cần auth + cleanup, không xứng giá trị.

### D5. Dirty-state guard bằng `onBeforeRouteLeave` + native `beforeunload`

**Chọn**: Composable `useBuildingForm` expose `isDirty: ComputedRef<boolean>`. Page wrap `onBeforeRouteLeave((to, from, next) => { if (isDirty.value && !confirm('...')) next(false); else next() })`. Thêm `window.beforeunload` listener cho refresh/close tab.

**Lý do**: Vue Router native API, không cần plugin. Confirm dialog đủ — không cần custom modal cho UX này (user đã hiểu pattern này).

### D6. Search dùng PostgreSQL `ilike` thay vì full-text search

**Chọn**: Repository `findAll({ q })` build query `name.ilike.%q% OR address.ilike.%q% OR code.ilike.%q%`. Không dùng `tsvector` / full-text search.

**Lý do**: Buildings table nhỏ (chục đến trăm row), ilike đủ nhanh, không cần index full-text. Khi scale lớn (>10k buildings) mới cần optimize.

### D7. Filter `status` là multi-value qua repeat query param

**Chọn**: `?status=active` hoặc `?status=active&status=inactive`. Nitro parse thành array `[string] | string[]`. Validator normalize về array.

**Lý do**: Chuẩn REST cho multi-value. Tránh comma-separated (`status=active,inactive`) phải tự parse.

### D8. Sticky save bar mobile dùng `position: fixed` bottom + safe-area

**Chọn**: Trên `md:hidden`, footer save bar `fixed bottom-0 left-0 right-0 bg-dark-surface border-t border-dark-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]`. Trên desktop giữ footer trong form như cũ.

**Lý do**: `position: sticky` không work nếu form scroll trong container không phải viewport. Fixed đảm bảo luôn nhìn thấy. `env(safe-area-inset-bottom)` cho iOS notch.

### D9. Section UI: numbered card với border-top accent

**Chọn**: Mỗi section là `<section>` với `border-t border-dark-border pt-6 mt-6` (trừ section đầu), heading dạng `<h3>` flex chứa số (`<span class="size-6 rounded-full bg-cyan/10 text-cyan text-xs">1</span>`) + tên + description một dòng `<p class="text-xs text-muted">`.

**Lý do**: Cấp bậc thị giác rõ, scan nhanh được 4 group field. Pattern dùng được cho form khác sau này (Rooms, Contracts).

### D10. Tests dùng Vitest + Vue Test Utils + Nitro test utils

**Chọn**: API tests gọi handler trực tiếp với mock Supabase client (đã có `tests/__mocks__/`). Component tests dùng `@vue/test-utils` mount. Composable tests dùng `setup()` thuần.

**Lý do**: Đã có infra trong `tests/`. Không cần thêm dependency.

## Risks / Trade-offs

[**Risk**: URL-sync filter có thể conflict với existing `?page` param khi user vừa filter vừa paginate] → Mitigation: Reset `page` về 1 khi `q`/`status`/`sort` thay đổi (watch effect trong composable).

[**Risk**: Bulk delete có thể partial fail làm UI khó hiểu] → Mitigation: Response trả từng `succeeded` + `failed[].reason`, UI hiển thị toast tóm tắt + modal chi tiết khi có failed items.

[**Risk**: Soft-archive (force-delete) tạo "zombie" building inactive đầy database] → Mitigation: List API default chỉ trả `status=active`; có filter chip "Đã lưu trữ" để xem inactive. Document trong spec.

[**Risk**: Autosave draft đè data mới nếu user mở 2 tab] → Mitigation: Khi restore draft, hiển thị notice "Phát hiện bản nháp [time]. Khôi phục / Bỏ qua / Xoá bản nháp". User chủ động chọn.

[**Risk**: `ilike` search với leading wildcard không dùng được index] → Mitigation: Chấp nhận với scale hiện tại (<1000 buildings); document trong spec để biết khi optimize.

[**Risk**: Backward-compat khi DELETE đổi behavior — client cũ không xử lý 409] → Mitigation: Toàn bộ client trong workspace cùng repo, update đồng thời. Không có external consumer.

[**Risk**: Sticky save bar mobile che content khi scroll] → Mitigation: Thêm `pb-24 md:pb-0` cho form container để dành space cho save bar.

## Migration Plan

Không có migration DB. Triển khai theo thứ tự:

1. **Server (API + service + repo)** — thêm filter/sort/safe-delete/bulk, giữ default behavior khi không có query mới.
2. **Composable** — mở rộng `useBuildingList` (URL sync), `useBuildingForm` (dirty + draft), thêm `useBuildingBulkActions`.
3. **Components mới + update** — `BuildingListToolbar`, `BuildingDetailHero`, `BuildingBulkActionsBar`; refactor `BuildingForm` sections; update `BuildingCard` cho selection mode.
4. **Pages** — refactor list/detail/create/edit dùng components mới.
5. **Tests** — viết song song với mỗi layer.

Rollback: revert merge commit — không có schema change, không có data migration.

## Open Questions

- Nên dùng `useDebounceFn` từ `@vueuse/core` cho search hay tự viết debounce? → Quyết: dùng `@vueuse/core` (đã có trong dependency).
- Bulk delete có cần confirm modal kèm danh sách tên building không? → Quyết: có, modal hiển thị list compact (max 10 tên + "...và X khác") + checkbox "Tôi hiểu hành động này".
- Form draft restore: auto restore hay hỏi user? → Quyết: hỏi user qua `UiAlert` info ở đầu form khi detect draft mới hơn current data (edit case).
