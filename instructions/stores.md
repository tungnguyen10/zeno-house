# Pinia Stores

## Rule: Stores own shared, persistent state

Use stores for state shared across multiple components or that persists across navigation. One-off or component-scoped data belongs in composables.

## Setup Store Pattern (all stores)

Always use **Setup Store** syntax — no Options API:

```ts
// app/stores/rooms.ts
export const useRoomsStore = defineStore('rooms', () => {
  const rooms = ref<Room[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const availableRooms = computed(() => rooms.value.filter(r => r.status === 'available'))

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

  function $reset() {
    rooms.value = []
    loading.value = false
    error.value = null
  }

  return { rooms, loading, error, availableRooms, fetchRooms, $reset }
})
```

## All Stores Must Implement `$reset()`

Every store MUST expose a `$reset()` function that clears all state. Called on logout.

## State Shape Convention

Every store that fetches data exposes:

```ts
const data = ref<T[]>([])          // or ref<T | null>(null) for single
const loading = ref(false)
const error = ref<string | null>(null)
```

## Auth Store — Reference Implementation

```ts
// app/stores/auth.ts
export const useAuthStore = defineStore('auth', () => {
  const role = ref<string | null>(null)

  async function fetchRole() {
    if (role.value) return role.value   // cache guard — don't re-fetch
    const data = await $fetch<{ role?: string }>('/api/auth/me').catch(() => null)
    role.value = data?.role ?? null
    return role.value
  }

  function clearRole() { role.value = null }

  function $reset() { role.value = null }

  return { role, fetchRole, clearRole, $reset }
})
```

Key patterns: cache guard, `clearRole()` on logout, `.catch(() => null)` — surface errors via `error` ref, not throws.

## Naming

| What | Convention |
|---|---|
| File | `app/stores/<domain>.ts` |
| Export | `use<Domain>Store` |
| Store ID | matches domain — `'rooms'`, `'auth'` |

## Stores vs Composables

| Use a **Store** when... | Use a **Composable** when... |
|---|---|
| State shared across multiple pages | Logic scoped to a feature/component |
| State persists across navigation | Data fetched for a specific view |
| Global app state (auth, notifications) | One-off mutations or Realtime subscriptions |

```ts
// ✅ Store — shared across app
const { role } = useAuthStore()

// ✅ Composable — feature-scoped
const { rooms, fetchRooms } = useRooms()
```

## Anti-patterns

- **DON'T** use Options API stores — use Setup Store everywhere
- **DON'T** call Supabase directly — use `$fetch('/api/...')`
- **DON'T** forget `$reset()` — always implement it
- **DON'T** forget to call `$reset()` on logout for stores with sensitive state
- **DON'T** put component-lifecycle logic (`onMounted`, Realtime) in stores — that's composables
