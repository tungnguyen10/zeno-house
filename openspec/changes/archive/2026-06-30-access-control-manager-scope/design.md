## Context

Hệ thống Zeno House hiện tại có permission model phẳng dựa trên role (`admin` / `manager`) và capability set tĩnh trong `server/utils/permissions.ts`. Không có khái niệm "building scope" — manager có `buildings.read` nghĩa là đọc được **tất cả** buildings. `rooms.delete`, `tenants.delete`, `contracts.delete` đã bị block với manager ngay từ đầu, nên Spec 2 (destructive override) là cơ chế **grant path**, không phải block thêm. `billing.close` và `billing.unissue` đã admin-only. `void`, `reissue`, `adjustment` đang dùng `billing.write` — manager đang có quyền này hàng ngày.

## Goals / Non-Goals

**Goals:**
- Manager chỉ thấy và thao tác trên assigned buildings
- Admin global, không bị ảnh hưởng
- Không break workflow manager hiện tại (void/reissue/adjustment vẫn chạy được)
- Kiểm soát per-building destructive permission qua `can_delete_master_data`
- Admin có UI để quản lý assignment

**Non-Goals:**
- RLS (Row Level Security) ở Postgres layer — enforcement chỉ ở service layer
- Tenant portal access control (Spec 4–7, track riêng)
- Audit trail đầy đủ cho Spec 1 (chỉ log cơ bản, persistent audit ở Spec 3)
- Fine-grained billing permission ngoài `billing.corrections`

## Decisions

### D1 — `user_building_assignments` thay vì extend user profile

**Quyết định:** Tạo bảng riêng `user_building_assignments` thay vì thêm `assigned_buildings[]` vào profile user.

**Lý do:** Many-to-many (1 manager nhiều buildings, 1 building nhiều managers). Bảng riêng dễ audit, dễ index, dễ backfill migration. `can_delete_master_data` là per-assignment (manager có thể có quyền xóa ở building A nhưng không có ở building B).

**Schema:**
```sql
user_building_assignments
  id              uuid primary key default gen_random_uuid()
  user_id         uuid not null references auth.users(id) on delete cascade
  building_id     uuid not null references buildings(id) on delete cascade
  can_delete_master_data boolean not null default false
  created_by      uuid references auth.users(id)
  created_at      timestamptz not null default now()
  updated_at      timestamptz not null default now()
  unique(user_id, building_id)
```

---

### D2 — Scope resolver: lazy cache trên `event.context`, không resolve ở middleware

**Quyết định:** `getAssignedBuildingIds(event, user)` — service layer gọi trực tiếp, middleware không pre-resolve.

```typescript
// server/utils/scope.ts
export async function getAssignedBuildingIds(
  event: H3Event,
  user: AuthUser,
): Promise<string[] | null> {
  // null = admin, no filter
  if (user.app_metadata.role === 'admin') return null

  // Lazy cache: chỉ query 1 lần per request
  if (event.context.__buildingScope !== undefined) {
    return event.context.__buildingScope
  }

  const ids = await AssignmentRepository.findBuildingIdsByUser(event, user.id)
  event.context.__buildingScope = ids
  return ids
}
```

**Lý do:** Middleware resolve sẵn cho mọi request sẽ query DB ngay cả khi request không cần scope (ví dụ: static asset, health check). Lazy cache giữ performance tốt mà không cần flag.

**Trade-off:** Nếu trong 1 request service gọi scope 2 lần (ví dụ list + count riêng), lần đầu tiên mới query, các lần sau dùng cache — acceptable.

---

### D3 — Scope violation behavior

**Quyết định:**
- **List query:** silently filter — manager chỉ thấy data trong scope, không báo lỗi
- **Detail read ngoài scope:** 404 Not Found
- **Mutation/action ngoài scope:** 403 Forbidden

**Lý do:** 404 cho detail read tránh leak existence (attacker không biết entity có tồn tại không). 403 cho mutation là đúng ngữ nghĩa HTTP — resource tồn tại nhưng bạn không có quyền. List silently filter là UX chuẩn cho multi-tenant — user không nên thấy "bạn không có quyền xem list" mà thay vào đó thấy list rỗng hoặc list filtered.

---

### D4 — `billing.corrections` tách khỏi `billing.write`

**Quyết định:** Thêm capability mới `billing.corrections` cho `void`, `reissue`, `adjustment`. Manager giữ `billing.corrections` mặc định.

```typescript
// permissions.ts
manager: new Set([
  // ... existing capabilities ...
  'billing.corrections',  // void, reissue, adjustment — giữ nguyên behavior hiện tại
])
```

**Lý do:** `billing.write` quá broad (covers create period, issue invoice, record payment, và giờ corrections). Tách `billing.corrections` cho phép future: admin có thể revoke corrections khỏi manager mà không ảnh hưởng billing.write thông thường. Không break gì hôm nay vì manager vẫn có cả 2.

**Service update:**
```typescript
// invoices.ts: void/reissue/adjustment
if (!can(user, 'billing.corrections')) throwForbidden(...)
```

---

### D5 — Destructive master data: grant path, không phải block path

**Quyết định:** `canDeleteMasterData(user, buildingId)` là **escalation** cho manager, không phải thêm guard mới.

```typescript
// server/utils/scope.ts
export async function canDeleteMasterData(
  event: H3Event,
  user: AuthUser,
  buildingId: string,
): Promise<boolean> {
  if (user.app_metadata.role === 'admin') return true
  const assignment = await AssignmentRepository.findByUserAndBuilding(
    event, user.id, buildingId
  )
  return assignment?.can_delete_master_data === true
}
```

**Service check pattern:**
```typescript
// rooms.delete — thay vì can(user, 'rooms.delete') thuần tuý:
const room = await RoomRepository.findByIdentifier(event, id)
if (!room) throwNotFound(...)
if (!can(user, 'rooms.delete') && !await canDeleteMasterData(event, user, room.building_id)) {
  throwForbidden('Không có quyền xoá phòng')
}
```

**Lý do:** `rooms.delete`, `tenants.delete`, `contracts.delete` đã blocked với manager trong `permissions.ts`. Admin đã có qua `can()`. `canDeleteMasterData` chỉ mở path cho manager khi được grant.

---

### D6 — Tenant visibility rule qua contract join (không gắn cứng building)

**Quyết định:** Tenant list của manager được filter qua `contracts → rooms → building_id IN (assignedIds)`.

**Lý do:** Tenant không thuộc cố định 1 building (có thể từng ở nhiều buildings). Repository tenants đã có `building_id` filter logic qua contract join — Spec 1 chỉ cần **bắt buộc** pass `buildingIds` khi user là manager.

**Exception:** Khi create contract, manager được search tenant `awaiting_contract` bất kể scope — deliberate bypass, phải comment rõ trong code.

---

### D7 — Spec 3 URL: `/settings/managers` + contextual section ở building settings

**Quyết định:**
- Main page: `/settings/managers` — list tất cả managers, view/edit assignments
- Building settings page (`/buildings/:id/settings`): thêm section "Managers" — shortcut xem ai được gán vào building này, link sang `/settings/managers`

**Nav item:** Thêm "Settings" vào `NAV_ITEMS` với `v-if="authStore.isAdmin"`. Route `/settings/managers` guard bằng middleware check `isAdmin`.

---

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Backfill assigns manager vào tất cả buildings, sau đó cần unassign thủ công | Spec 3 (assignment UI) phải release ngay sau Spec 1 trong cùng sprint |
| 14 service domains cần cập nhật — dễ miss 1 endpoint | Test cross-building isolation: 2 manager accounts, verify từng domain |
| `event.context.__buildingScope` là non-typed field | Extend `H3EventContext` declaration trong `types/auth.ts` hoặc file riêng |
| `canDeleteMasterData` là async (DB call) trong service layer | Đã lazy-cacheable theo pattern tương tự scope resolver nếu cần, hoặc accept 1 extra query per delete action (hiếm) |
| Manager scope enforcement chỉ ở service layer, không có RLS | Đủ cho v0.3 scope. RLS Postgres layer là future hardening nếu cần bypass protection thêm |

## Migration Plan

**Step 1 — Schema:**
```sql
CREATE TABLE user_building_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  can_delete_master_data boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, building_id)
);
CREATE INDEX idx_user_building_assignments_user_id ON user_building_assignments(user_id);
```

**Step 2 — Backfill (trong cùng migration):**
```sql
INSERT INTO user_building_assignments (user_id, building_id, can_delete_master_data, created_by)
SELECT
  u.id,
  b.id,
  false,
  (SELECT id FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin' LIMIT 1)
FROM auth.users u
CROSS JOIN buildings b
WHERE u.raw_app_meta_data->>'role' = 'manager'
ON CONFLICT (user_id, building_id) DO NOTHING;
```

**Step 3 — Deploy:**
- Migration chạy → scope enforcement active
- Tất cả managers vẫn thấy tất cả buildings (đã backfill)
- Admin có thể unassign qua Spec 3 UI sau deploy

**Rollback:** Drop table `user_building_assignments`, revert service changes. Không mất data nghiệp vụ vì bảng chỉ chứa assignment metadata.

## Open Questions

- *(resolved)* Scope violation: list filter / detail 404 / mutation 403 ✓
- *(resolved)* Scope resolver: lazy cache on event.context ✓
- *(resolved)* billing.corrections: new capability ✓
- *(resolved)* Spec 3 URL: /settings/managers ✓
