# Supabase Platform

## Two Client Modes

| Client | Import | When to use |
|---|---|---|
| **User-scoped** (respects RLS) | `serverSupabaseClient` | Reads where RLS should filter by user |
| **Service-role** (bypasses RLS) | `serverSupabaseServiceRole` | Admin mutations, cross-user ops, background tasks |

```ts
// server/api/rooms/index.get.ts — user-scoped read (RLS applies)
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)
  const { data, error } = await client.from('rooms').select('*')
  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})

// server/api/admin/rooms/index.post.ts — service-role write
import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = serverSupabaseServiceRole(event)
  // bypasses RLS — verify role manually before this point
  const { data, error } = await client.from('rooms').insert(body)
})
```

## Auth Helpers

```ts
import { serverSupabaseUser, serverSupabaseSession } from '#supabase/server'

const user = await serverSupabaseUser(event)   // User | null
const session = await serverSupabaseSession(event) // Session | null
```

## Row Level Security (RLS)

- **RLS is always enabled** — every table migration must include RLS policies
- Never disable RLS to "simplify" a query — use service-role client instead
- Policy naming: `<table>_<role>_<action>` e.g. `rooms_manager_select`

```sql
-- Example migration pattern
alter table rooms enable row level security;

create policy "rooms_manager_select"
  on rooms for select
  using (
    auth.uid() in (
      select id from profiles where role in ('admin', 'manager')
    )
  );
```

## Realtime Subscriptions

Set up subscriptions in composables, **always** tear them down in `onUnmounted`:

```ts
// app/composables/useRoomUpdates.ts
export function useRoomUpdates(roomId: string) {
  const supabase = useSupabaseClient()
  let channel: ReturnType<typeof supabase.channel>

  onMounted(() => {
    channel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, handleChange)
      .subscribe()
  })

  onUnmounted(() => {
    channel?.unsubscribe()
  })
}
```

## SSR Session

Sessions are managed via cookies by `@nuxtjs/supabase` — no manual token handling needed. The module handles cookie-based session refresh automatically.

Config in `nuxt.config.ts`:
```ts
supabase: {
  redirect: false  // we handle redirects manually in middleware
}
```

## Anti-patterns

- **DON'T** import Supabase directly in components (`import { createClient } from '@supabase/supabase-js'`)
- **DON'T** call `useSupabaseClient()` in `server/api/` — use `serverSupabaseClient` instead
- **DON'T** use service-role client without first verifying the caller's role
- **DON'T** create Realtime subscriptions without a corresponding `onUnmounted` teardown
- **DON'T** store JWT tokens manually — let `@nuxtjs/supabase` handle SSR cookies
