# Composables

## Rule: Composables are the data layer bridge

```
Component → Composable → server/api/ → Supabase
```

Components call composables. Composables call `server/api/` routes via `$fetch`. Never call Supabase directly from a composable.

## Naming and File Location

- Filename and function: `use<Feature>.ts` → `export function use<Feature>()`
- Location: `app/composables/use<Feature>.ts`

```ts
// ✅ Correct
export function useRooms() { ... }      // app/composables/useRooms.ts
export function useInvoiceActions() {}  // app/composables/useInvoiceActions.ts

// ❌ Wrong — missing use prefix
export function rooms() { ... }
export function getInvoices() { ... }
```

## Return Refs, Not `.value`

Always return reactive refs directly so consumers stay reactive after destructuring:

```ts
// ✅ Correct — returns refs
export function useRooms() {
  const rooms = ref<Room[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchRooms() {
    loading.value = true
    error.value = null
    try {
      rooms.value = await $fetch<Room[]>('/api/rooms')
    } catch {
      error.value = 'Failed to load rooms'
    } finally {
      loading.value = false
    }
  }

  return { rooms, loading, error, fetchRooms }
}

// ❌ Wrong — resolves refs before returning, breaks reactivity
export function useRooms() {
  const rooms = ref<Room[]>([])
  return { rooms: rooms.value }  // consumer gets plain array, not reactive
}
```

## API Calls

Use `$fetch` to call `server/api/` routes:

```ts
// ✅ Good
const data = await $fetch<Room>(`/api/rooms/${id}`)
await $fetch('/api/rooms', { method: 'POST', body: newRoom })

// ❌ Bad — never call Supabase directly
const { data } = await useSupabaseClient().from('rooms').select()
```

## Realtime Subscriptions

Two valid cleanup patterns — pick one per use case:

```ts
// Pattern 1: onMounted + onUnmounted
export function useRoomUpdates(roomId: string) {
  const supabase = useSupabaseClient()
  let channel: ReturnType<typeof supabase.channel> | null = null

  onMounted(() => {
    channel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, handleChange)
      .subscribe()
  })

  onUnmounted(() => {
    channel?.unsubscribe()
    channel = null
  })
}

// Pattern 2: watchEffect (auto-cleans when deps change)
export function useRoomUpdates(roomId: Ref<string>) {
  watchEffect((onCleanup) => {
    const channel = supabase.channel(`room:${roomId.value}`).subscribe()
    onCleanup(() => channel.unsubscribe())
  })
}
```

## Stores vs Composables

| Use a **Store** when... | Use a **Composable** when... |
|---|---|
| State shared across multiple pages | Logic is scoped to one feature/component |
| State persists across navigation | Data is fetched for a specific view |
| Global app state (auth, notifications) | One-off mutations or Realtime subscriptions |

## Summary

| Rule | Correct | Wrong |
|---|---|---|
| Naming | `useRooms()` | `rooms()`, `getRooms()` |
| Return refs | `return { rooms, loading }` | `return { rooms: rooms.value }` |
| API calls | `$fetch('/api/rooms')` | `supabase.from('rooms').select()` |
| Subscriptions | Cleanup in `onUnmounted` or `watchEffect` | Leave subscriptions open |
| File location | `app/composables/useRooms.ts` | `app/utils/rooms.ts` |

## Anti-patterns

- **DON'T** call `useSupabaseClient().from(...)` — use `$fetch('/api/...')`
- **DON'T** return `.value` — always return the ref itself
- **DON'T** create Realtime subscriptions without cleanup (memory leak)
- **DON'T** name composables without `use` prefix
- **DON'T** put composable logic directly in `<script setup>` — extract to `app/composables/`
