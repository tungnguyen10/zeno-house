## Context

Buildings là entity gốc của hệ thống — mọi Room, Tenant, Contract đều thuộc về một Building. F0.1.5 implement CRUD hoàn chỉnh để kiểm chứng toàn bộ data flow: Supabase DB → server repository → service → API handler → composable → page.

Stack đã sẵn sàng từ F0.1.3 + F0.1.4: auth middleware, `requireAuth()`, `can()`, typed error helpers, API envelope types.

## Goals / Non-Goals

**Goals:**
- Tạo `buildings` table với RLS đúng (admin write, manager read, anonymous block)
- Implement 5 CRUD endpoints theo pattern server-api.instructions.md
- Shared types + validators + mappers tách biệt DB shape khỏi app DTO
- Composables theo pattern: `useBuildingList` cho list page, `useBuildingForm` cho create/edit
- 4 pages đủ để thao tác buildings end-to-end trong UI

**Non-Goals:**
- Không implement Rooms trong phase này
- Không implement search/filter nâng cao (chỉ pagination đơn giản)
- Không có file upload, image cho building
- Không implement soft delete — dùng hard delete với confirmation

## Decisions

### D1: Buildings table schema

```sql
create table buildings (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  address     text        not null,
  description text,
  status      text        not null default 'active',
  total_rooms integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

**Status field:** `active | inactive` — text column, validated ở app layer bằng Zod enum. Không dùng Postgres enum vì khó migrate sau.

**total_rooms:** Denormalized counter — đơn giản hơn COUNT subquery mỗi lần query. Update bằng trigger khi thêm/xóa Room (F0.1.6+).

---

### D2: RLS Policy

```sql
-- Admin: full access
-- Manager: SELECT only
-- Anonymous: no access
```

`admin` role được lưu trong `auth.jwt() -> app_metadata.role`. RLS check `(auth.jwt() ->> 'role') = 'admin'` cho write operations.

**Lý do:** Server dùng service role key (bypass RLS) cho tất cả operations — RLS là safety net, không phải primary auth. Primary auth check là `requireAuth()` + `can()` trong service layer.

---

### D3: Repository dùng `serverSupabaseClient` (user JWT), không phải service role

**Quyết định:** Repository inject `event: H3Event` và dùng `serverSupabaseClient(event)` thay vì service role client.

**Lý do:** User JWT client tôn trọng RLS, đảm bảo double protection. Service role chỉ dùng khi cần bypass RLS cho admin operations (phase sau).

**Alternatives considered:**
- Service role cho tất cả — loại vì bypass toàn bộ RLS, lỗi dễ bị bỏ sót

---

### D4: Composable split — useBuildingList vs useBuildingForm

**useBuildingList:** Dùng `useFetch` với `watch` on pagination state — reactive, server-rendered friendly.

**useBuildingForm:** Dùng `$fetch` (manual call) — form submit không cần SSR, cần control flow rõ ràng hơn (loading, error, redirect).

---

### D5: Pages dùng `definePageMeta` với middleware 'auth'

Tất cả pages trong `/buildings/*` đều cần auth. Dùng `definePageMeta({ middleware: 'auth' })` — `auth.global.ts` đã handle điều này globally nên không cần khai báo lại, nhưng explicit là tốt hơn cho readability.

Thực tế `auth.global.ts` đã cover tất cả routes ngoài `/login` → không cần thêm middleware meta trên từng page.

---

### D6: BuildingForm là shared component cho create và edit

Props: `modelValue: BuildingFormData`, `loading: boolean`, `errors: ZodErrors`. Emit: `submit`. Pages tự handle submit logic qua composable.

**Lý do:** Tránh duplicate form markup. Create và Edit dùng cùng form, chỉ khác submit action.

## Risks / Trade-offs

- **`total_rooms` denormalization** → Có thể lệch nếu Room operations lỗi. Mitigation: Fix bằng trigger khi implement Rooms (F0.1.6). Cho phép drift ở phase này vì chưa có Room.
- **Hard delete** → Mất data nếu user nhầm. Mitigation: UI cần confirmation dialog. Không implement soft delete để giữ scope nhỏ.
- **database.types.ts cần regenerate thủ công** → Mitigation: Document rõ trong task list, type sẽ bị any cho đến khi regenerate. Interim: define manual types trong `app/types/buildings.ts` không phụ thuộc DB types cho đến khi regenerate xong.

## Migration Plan

1. Tạo SQL migration file tại `supabase/migrations/`
2. Apply migration qua Supabase Dashboard hoặc `supabase db push`
3. Regenerate `database.types.ts`: `npx supabase gen types typescript --project-id <ref> > app/types/database.types.ts`
4. Implement server layer (repository → service → API handlers)
5. Implement client layer (types → validators → mappers → composables)
6. Implement UI (components → pages)
7. Smoke test: tạo building mới, xem list, edit, delete
