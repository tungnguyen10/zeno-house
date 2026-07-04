---
applyTo: "app/composables/**"
---

# Composables

Server state and domain orchestration belong in composables, not Pinia stores.

## Pattern: 3 composables by purpose

| Composable | Purpose | Example |
|-----------|---------|------|
| `use<Domain>List` | Fetch list, pagination, filter | `useBuildingList.ts` |
| `use<Domain>Detail` | Fetch single item | `useBuildingDetail.ts` |
| `use<Domain>Form` | Form state, validation, submit | `useBuildingForm.ts` |

## ✓ Correct Usage

**List composable — typed useFetch, expose computed:**
```ts
// app/composables/buildings/useBuildingList.ts
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'

export function useBuildingList() {
  const { data, status, refresh } = useFetch<ApiSuccess<Building[]>>('/api/buildings', {
    default: () => ({ data: [] }),
  })

  const buildings = computed(() => data.value?.data ?? [])
  const total = computed(() => data.value?.meta?.total as number ?? 0)

  return { buildings, total, status, refresh }
}
```

**Detail composable — route param, watch when id changes:**
```ts
// app/composables/buildings/useBuildingDetail.ts
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'

export function useBuildingDetail(id: MaybeRef<string>) {
  const { data, status, refresh } = useFetch<ApiSuccess<Building>>(
    () => `/api/buildings/${toValue(id)}`,
    { watch: [() => toValue(id)] }
  )

  const building = computed(() => data.value?.data ?? null)

  return { building, status, refresh }
}
```

**Form composable — Zod validation, submit with $fetch:**
```ts
// app/composables/buildings/useBuildingForm.ts
import { buildingSchema, type BuildingInput } from '~/utils/validators/buildings'

export function useBuildingForm(initial?: Partial<BuildingInput>) {
  const form = reactive<BuildingInput>({
    name: initial?.name ?? '',
    address: initial?.address ?? '',
  })

  const errors = ref<Partial<Record<keyof BuildingInput, string>>>({})
  const submitting = ref(false)

  async function submit() {
    errors.value = {}
    const result = buildingSchema.safeParse(form)

    if (!result.success) {
      result.error.issues.forEach(issue => {
        const key = issue.path[0] as keyof BuildingInput
        errors.value[key] = issue.message
      })
      return null
    }

    submitting.value = true
    try {
      const { data } = await $fetch<ApiSuccess<Building>>('/api/buildings', {
        method: 'POST',
        body: result.data,
      })
      return data
    } finally {
      submitting.value = false
    }
  }

  return { form, errors, submitting, submit }
}
```

**Usage in a page:**
```vue
<!-- app/pages/buildings/index.vue -->
<script setup lang="ts">
const { buildings, total, status, refresh } = useBuildingList()
</script>
```

## ✗ Do Not

```ts
// ✗ Đừng gọi Supabase trực tiếp trong composable
const supabase = useSupabaseClient()
const { data } = await supabase.from('buildings').select('*')
// → Phải đi qua server/api/

// ✗ Đừng làm 1 composable to ôm tất cả
export function useBuildings() {
  // list + detail + form + delete + export ... = quá to, khó maintain
}

// ✗ Đừng đặt server state vào Pinia
export const useBuildingsStore = defineStore('buildings', {
  state: () => ({ list: [] as Building[] }),
  actions: {
    async fetchList() {
      this.list = await $fetch('/api/buildings') // dùng useFetch trong composable
    },
  },
})

// ✗ Đừng duplicate derived values bằng ref khi computed đủ dùng
const filteredBuildings = ref<Building[]>([])
watch(buildings, (list) => {
  filteredBuildings.value = list.filter(b => b.status === 'active')
})
// → Dùng computed: const activeBuildings = computed(() => buildings.value.filter(...))

// ✗ Đừng bỏ qua error handling khi $fetch
const data = await $fetch('/api/buildings') // không catch = silent fail
// → Wrap trong try/catch hoặc dùng useFetch với onResponseError
```

## Naming Conventions

- Composable name must start with `use`
- Include domain and intent: `useBuildingList`, `useBuildingForm`, not `useData`
- Export named functions, not default exports
