---
applyTo: "server/**"
---

# Server API

Pattern bất biến: `server/api` → `server/services` → `server/repositories` → Supabase.

## Data Flow

```
page / composable
  └─▶ $fetch('/api/buildings', { method: 'POST', body })
        └─▶ server/api/buildings/index.post.ts   ← validate input, auth guard
              └─▶ server/services/buildings.ts   ← business logic, permission check
                    └─▶ server/repositories/buildings.ts  ← Supabase query only
```

## Response Envelope

Mọi endpoint phải trả một trong hai shape sau:

```ts
// app/types/api.ts
type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> }
type ApiError      = { error: { code: string; message: string; details?: unknown } }
```

## Error Codes

| Code | HTTP | Khi nào dùng |
|------|------|-------------|
| `UNAUTHENTICATED` | 401 | Chưa đăng nhập hoặc session hết hạn |
| `FORBIDDEN` | 403 | Đã đăng nhập nhưng không có quyền |
| `NOT_FOUND` | 404 | Resource không tồn tại |
| `VALIDATION_ERROR` | 422 | Input không qua Zod schema |
| `CONFLICT` | 409 | Xung đột trạng thái (duplicate, etc.) |

## ✓ Cách dùng đúng

**API handler — validate → auth → service → envelope:**
```ts
// server/api/buildings/index.post.ts
import { buildingSchema } from '~/utils/validators/buildings'
import { BuildingService } from '~/server/services/buildings'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // 1. Auth guard
  const user = await requireAuth(event)

  // 2. Validate input
  const body = await readBody(event)
  const result = buildingSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 422,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dữ liệu không hợp lệ',
          details: result.error.flatten(),
        },
      },
    })
  }

  // 3. Delegate to service
  const building = await BuildingService.create(event, user, result.data)

  // 4. Return envelope
  return { data: building }
})
```

**API handler — GET list với pagination:**
```ts
// server/api/buildings/index.get.ts
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const query = getQuery(event)
  const page = Number(query.page ?? 1)
  const limit = Number(query.limit ?? 20)

  const { items, total } = await BuildingService.list(event, user, { page, limit })

  return {
    data: items,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
})
```

**Service layer — business logic + permission:**
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

**Repository layer — chỉ query, không logic:**
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

    if (error) throw createError({ statusCode: 500, message: error.message })
    return { items: (data ?? []).map(mapBuilding), total: count ?? 0 }
  },

  async insert(event: H3Event, input: BuildingInput) {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('buildings')
      .insert({ name: input.name, address: input.address })
      .select()
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
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

## ✗ Cách không được dùng

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

## File naming convention

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
