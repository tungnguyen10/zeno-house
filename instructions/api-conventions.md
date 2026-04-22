# API Conventions

## File Naming (Nuxt server routes)

Use method suffix in filename — Nuxt auto-maps to HTTP methods:

```
server/api/
├── rooms/
│   ├── index.get.ts          # GET  /api/rooms
│   ├── index.post.ts         # POST /api/rooms
│   └── [id].get.ts           # GET  /api/rooms/:id
│   └── [id].put.ts           # PUT  /api/rooms/:id
│   └── [id].delete.ts        # DELETE /api/rooms/:id
├── auth/
│   └── me.get.ts             # GET  /api/auth/me
└── invoices/
    └── [id]/
        └── pay.post.ts       # POST /api/invoices/:id/pay
```

## Route Handler Pattern

Every handler follows this structure:

```ts
import { z } from 'zod'
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'

const bodySchema = z.object({
  name: z.string().min(1),
  monthly_rent: z.number().positive(),
})

export default defineEventHandler(async (event) => {
  // 1. Auth check
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  // 2. Role check (for role-restricted routes)
  const { data: profile } = await client.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw createError({ statusCode: 403, message: 'Forbidden' })

  // 3. Validate input
  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

  // 4. Business logic
  const client = await serverSupabaseClient(event)
  const { data, error } = await client.from('rooms').insert(parsed.data).select().single()
  if (error) throw createError({ statusCode: 500, message: error.message })

  // 5. Return data
  return data
})
```

## Response Shapes

**Success**: return the data object directly (Nuxt wraps automatically)

```ts
return { id: '...', name: '...', ... }      // single resource
return [{ id: '...' }, { id: '...' }]       // list
```

**Error**: always use `createError` with a consistent shape

```ts
throw createError({ statusCode: 400, message: 'Validation failed' })
throw createError({ statusCode: 401, message: 'Unauthorized' })
throw createError({ statusCode: 403, message: 'Forbidden' })
throw createError({ statusCode: 404, message: 'Not found' })
throw createError({ statusCode: 500, message: error.message })
```

Client receives: `{ error: string, statusCode: number }` from Nuxt's error handling.

## HTTP Methods

| Method | Use for | Body |
|---|---|---|
| GET | Read, list | — |
| POST | Create | Required |
| PUT | Full replace | Required |
| PATCH | Partial update | Required |
| DELETE | Remove | — |

## Auth Check Pattern

```ts
// Reusable pattern — copy into each handler
const user = await serverSupabaseUser(event)
if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })
```

For role-restricted routes, fetch `profiles.role` immediately after user check. Never trust a role passed from the client body.

## Query Parameters

```ts
const query = getQuery(event)  // { page?: string, limit?: string }

// Always parse and validate
const page = Number(query.page) || 1
const limit = Math.min(Number(query.limit) || 20, 100)
```

## Anti-patterns

- **DON'T** skip auth checks — every protected route must verify `serverSupabaseUser`
- **DON'T** trust role from request body or query params — always read from `profiles` table
- **DON'T** return raw Supabase errors to the client — wrap with `createError`
- **DON'T** put multiple concerns in one file — one file = one HTTP method
- **DON'T** validate only on the client — server handler must always validate with Zod
