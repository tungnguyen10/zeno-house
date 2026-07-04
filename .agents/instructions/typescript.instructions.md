---
applyTo: "app/**/*.ts, app/**/*.vue, server/**/*.ts, tests/**/*.ts, scripts/**/*.mjs, nuxt.config.ts, tailwind.config.ts, vitest.config.ts"
---

# TypeScript

Strict mode on. No `any`. Infer from Zod. Type API responses and composable return values.

## ✓ Correct Usage

**API response types — shared across the app:**
```ts
// app/types/api.ts
export type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> }
export type ApiError = {
  error: {
    code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'CONFLICT'
    message: string
    details?: unknown
  }
}
```

**Infer type from Zod — do not write types by hand:**
```ts
// app/utils/validators/buildings.ts
import { z } from 'zod'

export const buildingSchema = z.object({
  name: z.string().min(1, 'Bắt buộc'),
  address: z.string().min(1, 'Bắt buộc'),
  totalFloors: z.number().int().min(1).optional(),
})

// ✓ Infer — không duplicate type definition
export type BuildingInput = z.infer<typeof buildingSchema>

// ✗ Sai — viết lại tay khi đã có Zod schema
export type BuildingInput = {
  name: string
  address: string
  totalFloors?: number
}
```

**App DTO types decoupled from DB types:**
```ts
// app/types/buildings.ts
export type BuildingStatus = 'active' | 'inactive'

export interface Building {
  id: string
  name: string
  address: string
  status: BuildingStatus
  totalRooms: number
  createdAt: string
  updatedAt: string
}
```

**Typed composable return:**
```ts
// Always explicitly type the public return of a composable
export function useBuildingList(): {
  buildings: ComputedRef<Building[]>
  total: ComputedRef<number>
  status: Ref<'idle' | 'pending' | 'success' | 'error'>
  refresh: () => Promise<void>
} {
  // ...
}
```

**Type guard to narrow unknown:**
```ts
function isApiError(err: unknown): err is { data: ApiError } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'data' in err &&
    typeof (err as any).data?.error?.code === 'string'
  )
}

// Usage:
try {
  await $fetch('/api/buildings', { method: 'POST', body })
} catch (err) {
  if (isApiError(err)) {
    const code = err.data.error.code  // typed: 'VALIDATION_ERROR' | ...
  }
}
```

**`satisfies` cho config objects:**
```ts
// app/utils/constants/navigation.ts
import type { NavItem } from '~/types/app'

export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', to: '/', icon: 'home' },
  { key: 'buildings', label: 'Tòa nhà', to: '/buildings', icon: 'building' },
  { key: 'rooms', label: 'Phòng', to: '/rooms', icon: 'door' },
  { key: 'tenants', label: 'Khách thuê', to: '/tenants', icon: 'users' },
  { key: 'contracts', label: 'Hợp đồng', to: '/contracts', icon: 'file-text' },
] satisfies NavItem[]
```

**Props and emits typed with generics:**
```vue
<script setup lang="ts">
// ✓ defineProps with TypeScript generic — do not use runtime options
const props = defineProps<{
  building: Building
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'edit', id: string): void
  (e: 'remove', id: string): void
}>()
</script>
```

**`MaybeRef` for composables that accept both ref and plain value:**
```ts
// Composable that accepts id as either Ref<string> or plain string
export function useBuildingDetail(id: MaybeRef<string>) {
  const url = computed(() => `/api/buildings/${toValue(id)}`)
  const { data } = useFetch<ApiSuccess<Building>>(url)
  return { building: computed(() => data.value?.data ?? null) }
}
```

## ✗ Do Not

```ts
// ✗ Do not use any
const data: any = await $fetch('/api/buildings')
const rows: any[] = result.data
function handleEvent(e: any) { ... }

// ✗ Do not cast with 'as' without narrowing properly
const user = getUser() as AdminUser  // unsafe — narrow với type guard

// ✗ Do not use non-null assertion (!) without certainty
const id = route.params.id!  // nếu có thể undefined, handle explicit

// ✗ Do not suppress TypeScript with @ts-ignore without explanation
// @ts-ignore
doSomethingRisky()

// ✗ Do not use the Function type (too broad)
const handler: Function = () => {}
// → Dùng: const handler: () => void = () => {}

// ✗ Do not use the object type (too broad)
function process(data: object) { ... }
// → Dùng type cụ thể hoặc Record<string, unknown>

// ✗ Do not disable typeCheck without a reason
// nuxt.config.ts
typescript: { typeCheck: false }
// → Enable for production builds to catch errors early
```

## tsconfig.json paths

```json
{
  "compilerOptions": {
    "paths": {
      "~/*": ["./app/*"],
      "@/*": ["./app/*"]
    }
  }
}
```

Use `~/` prefix to import within `app/`:
```ts
import type { Building } from '~/types/buildings'
import { buildingSchema } from '~/utils/validators/buildings'
import { mapBuilding } from '~/utils/mappers/buildings'
```
