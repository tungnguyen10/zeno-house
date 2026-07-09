---
applyTo: "server/**"
---

# Server API

Required layering: `server/api` → `server/services` → `server/repositories` → Supabase.

## Data Flow
```
page / composable
  └─▶ $fetch('/api/buildings', { method: 'POST', body })
        └─▶ server/api/buildings/index.post.ts   ← validate input, auth guard
              └─▶ server/services/buildings.ts   ← business logic, permission check
                    └─▶ server/repositories/buildings.ts  ← Supabase query only
```

## Response Envelope

Every endpoint must return one of these two shapes:

```ts
// app/types/api.ts
type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> }
type ApiError      = { error: { code: string; message: string; details?: unknown } }
```

## Error Codes

| Code | HTTP | When to use |
|------|------|-------------|
| `UNAUTHENTICATED` | 401 | Not logged in or session expired |
| `FORBIDDEN` | 403 | Logged in but insufficient permission |
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 422 | Input failed Zod schema |
| `CONFLICT` | 409 | State conflict (duplicate, etc.) |

## Shared Helpers

Use the auto-imported helpers in `server/utils/` instead of hand-rolling validation, pagination, or error envelopes:

- `parseBody(event, schema, message?)` / `parseQuery(event, schema, message?)` — validate and return typed data; on failure they throw `VALIDATION_ERROR` with `error.flatten()` as `details`.
- `paginated(items, { total, page, limit })` — build `{ data, meta: { total, page, limit, totalPages } }`.
- `throwForbidden` / `throwNotFound` / `throwValidationError` / `throwConflict(message, details?)` — standard error envelopes.
- `throwDbError(error, context)` — repository DB errors. Never surface a raw Supabase message to the client; this logs the original error with `context` and returns a generic `INTERNAL` envelope.

## ✓ Correct Usage

**API handler — validate → auth → service → envelope:**
```ts
// server/api/buildings/index.post.ts
import { buildingSchema } from '~/utils/validators/buildings'
import { BuildingService } from '~/server/services/buildings'

export default defineEventHandler(async (event) => {
  // 1. Auth guard
  const user = await requireAuth(event)

  // 2. Validate input (throws VALIDATION_ERROR with flattened details on failure)
  const input = await parseBody(event, buildingSchema)

  // 3. Delegate to service
  const building = await BuildingService.create(event, user, input)

  // 4. Return envelope
  return { data: building }
})
```

**API handler — GET list with pagination:**
```ts
// server/api/buildings/index.get.ts
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const { page, limit } = parseQuery(event, buildingListQuerySchema)
  const { items, total } = await BuildingService.list(event, user, { page, limit })

  return paginated(items, { total, page, limit })
})
```

**Service layer — business logic and permissions:**
```ts
// server/services/buildings.ts
import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BuildingInput } from '~/utils/validators/buildings'
import { BuildingRepository } from '~/server/repositories/buildings'
import { can } from '~/server/utils/permissions'

export const BuildingService = {
  async list(event: H3Event, user: AuthUser, opts: { page: number; limit: number }) {
    if (!can(user, 'buildings.read')) {
      throw createError({
        statusCode: 403,
        data: { error: { code: 'FORBIDDEN', message: 'Không có quyền xem danh sách tòa nhà' } },
      })
    }
    return BuildingRepository.findAll(event, opts)
  },

  async create(event: H3Event, user: AuthUser, input: BuildingInput) {
    if (!can(user, 'buildings.create')) {
      throw createError({
        statusCode: 403,
        data: { error: { code: 'FORBIDDEN', message: 'Không có quyền tạo tòa nhà' } },
      })
    }
    return BuildingRepository.insert(event, input)
  },
}
```

**Repository layer — query only, no logic:**
```ts
// server/repositories/buildings.ts
import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { BuildingInput } from '~/utils/validators/buildings'
import { mapBuilding } from '~/utils/mappers/buildings'

export const BuildingRepository = {
  async findAll(event: H3Event, opts: { page: number; limit: number }) {
    const client = await serverSupabaseClient(event)
    const from = (opts.page - 1) * opts.limit
    const to = from + opts.limit - 1

    const { data, error, count } = await client
      .from('buildings')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throwDbError(error, 'buildings.findAll')
    return { items: (data ?? []).map(mapBuilding), total: count ?? 0 }
  },

  async insert(event: H3Event, input: BuildingInput) {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('buildings')
      .insert({ name: input.name, address: input.address })
      .select()
      .single()

    if (error) throwDbError(error, 'buildings.insert')
    return mapBuilding(data)
  },
}
```

**Auth helper trong server/utils/:**
```ts
// server/utils/auth.ts
import { serverSupabaseUser } from '#supabase/server'
import type { H3Event } from 'h3'

export async function requireAuth(event: H3Event) {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      data: { error: { code: 'UNAUTHENTICATED', message: 'Yêu cầu đăng nhập' } },
    })
  }
  return user
}
```

## ✗ Do Not

```ts
// ✗ Đừng bỏ qua Zod validation trong API handler
const body = await readBody(event)
await BuildingService.create(event, user, body) // body là unknown — validate trước

// ✗ Đừng đặt business logic trong repository
export const BuildingRepository = {
  async insert(event: H3Event, input: any, user: AuthUser) {
    if (!user.isAdmin) throw ...  // ← logic này thuộc service
    ...
  },
}

// ✗ Đừng trả raw DB row ra response
const { data } = await client.from('buildings').select('*').single()
return data  // thiếu mapper — expose DB shape

// ✗ Đừng leak raw DB error ra client
if (error) throw createError({ statusCode: 500, message: error.message })
// → Dùng: if (error) throwDbError(error, '<repo>.<method>')

// ✗ Đừng dùng inconsistent error shape
throw createError({ statusCode: 400, message: 'lỗi' })
// → Luôn dùng: { error: { code: '...', message: '...' } }

// ✗ Đừng skip auth guard trên route cần bảo vệ
export default defineEventHandler(async (event) => {
  // không có requireAuth → bất kỳ ai cũng gọi được
  return BuildingService.list(...)
})

// ✗ Đừng tạo endpoint mà không có error handling cho Supabase error
const { data } = await client.from('buildings').select('*')
// → const { data, error } = ... ; if (error) throw createError(...)
```

## File Naming Convention

```
server/api/
├── buildings/
│   ├── index.get.ts      → GET /api/buildings
│   ├── index.post.ts     → POST /api/buildings
│   ├── [id].get.ts       → GET /api/buildings/:id
│   ├── [id].put.ts       → PUT /api/buildings/:id
│   └── [id].delete.ts    → DELETE /api/buildings/:id
└── me.get.ts             → GET /api/me
```

## Slug vs UUID Resolution

For entities that support code/slug in routes or query filters, the service layer must resolve identifiers via `*Repository.findByIdentifier(event, value)` first, then use `existing.id` (UUID) for all subsequent repository calls. Postgres throws `invalid input syntax for type uuid` if a slug is passed directly to `.eq('<uuid_column>', value)`.

**Rule**: For `buildings`, `rooms`, `tenants`, `contracts` (contract_code), and `billing_invoices` (invoice_code) — resolve slug to UUID in service before repository calls.

### ✓ Đúng

```ts
// server/services/rooms/index.ts
async update(event, user, id, input) {
  const existing = await RoomRepository.findByIdentifier(event, id)  // ← UUID hoặc code đều OK
  if (!existing) throwNotFound('Không tìm thấy phòng')
  return RoomRepository.update(event, existing.id, input)            // ← dùng UUID đã resolve
}

// server/services/contracts/index.ts — list filter
async list(event, user, filters) {
  let buildingId = filters.building_id
  if (buildingId) {
    const building = await BuildingRepository.findByIdentifier(event, buildingId)
    if (!building) throwNotFound('Building not found')
    buildingId = building.id
  }
  return ContractRepository.findAll(event, { ...filters, building_id: buildingId })
}
```

### ✗ Incorrect

```ts
// ✗ findById chỉ accept UUID — slug sẽ 500
const existing = await RoomRepository.findById(event, id)

// ✗ pass-through raw slug vào filter — repository sẽ .eq('room_id', 'zhpn-b201') trên UUID column
if (filters.room_id) query = query.eq('room_id', filters.room_id)

// ✗ dùng raw contractId cho sub-resource sau khi đã có existing
const contract = await ContractRepository.findById(event, contractId)  // findById ở contracts là alias findByIdentifier — OK
return ContractPaymentRepository.listByContract(event, contractId)     // ← phải là contract.id
```

### Entities without slug

`billing_periods`, `meter_readings`, `contract_payments/occupants/renewals/services`, `building_services` — UUID only. Use `findById` directly.

### Audit checklist
When adding a new endpoint or reviewing existing ones:
- `grep -r "Repository\.findById\(event,\s*id\)" server/services` — catch update/remove using UUID-only lookup for inputs that may be a slug
- `grep -r "\.eq\('(building|room|tenant|contract)_id'" server/repositories` — catch filter pass-through not resolved in service
