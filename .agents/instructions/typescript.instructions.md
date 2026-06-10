---
applyTo: "**/*.ts, **/*.vue"
---

# TypeScript

Strict mode bật. Không dùng `any`. Infer từ Zod. Type API response và composable return.

## ✓ Cách dùng đúng

**API response types — dùng chung toàn app:**
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

**Infer type từ Zod — không viết tay:**
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

**App DTO types riêng biệt với DB types:**
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
// Luôn type explicit return của composable public
export function useBuildingList(): {
  buildings: ComputedRef<Building[]>
  total: ComputedRef<number>
  status: Ref<'idle' | 'pending' | 'success' | 'error'>
  refresh: () => Promise<void>
} {
  // ...
}
```

**Type guard để narrow unknown:**
```ts
function isApiError(err: unknown): err is { data: ApiError } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'data' in err &&
    typeof (err as any).data?.error?.code === 'string'
  )
}

// Dùng:
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

**Props và emits typed với generics:**
```vue
<script setup lang="ts">
// ✓ defineProps với TypeScript generic — không dùng runtime options
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

**`MaybeRef` cho composable nhận cả ref lẫn value:**
```ts
// Composable nhận id có thể là Ref<string> hoặc string thuần
export function useBuildingDetail(id: MaybeRef<string>) {
  const url = computed(() => `/api/buildings/${toValue(id)}`)
  const { data } = useFetch<ApiSuccess<Building>>(url)
  return { building: computed(() => data.value?.data ?? null) }
}
```

## ✗ Cách không được dùng

```ts
// ✗ Không dùng any
const data: any = await $fetch('/api/buildings')
const rows: any[] = result.data
function handleEvent(e: any) { ... }

// ✗ Không cast với 'as' trừ khi đã narrow đúng
const user = getUser() as AdminUser  // unsafe — narrow với type guard

// ✗ Không dùng non-null assertion (!) mà không chắc chắn
const id = route.params.id!  // nếu có thể undefined, handle explicit

// ✗ Không suppress TypeScript với @ts-ignore không có giải thích
// @ts-ignore
doSomethingRisky()

// ✗ Không dùng Function type (quá rộng)
const handler: Function = () => {}
// → Dùng: const handler: () => void = () => {}

// ✗ Không dùng object type (quá rộng)
function process(data: object) { ... }
// → Dùng type cụ thể hoặc Record<string, unknown>

// ✗ Không bật typeCheck: false nếu không có lý do
// nuxt.config.ts
typescript: { typeCheck: false }
// → Bật true khi build production để catch lỗi sớm
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

Dùng `~/` prefix để import trong `app/`:
```ts
import type { Building } from '~/types/buildings'
import { buildingSchema } from '~/utils/validators/buildings'
import { mapBuilding } from '~/utils/mappers/buildings'
```
