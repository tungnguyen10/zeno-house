---
applyTo: "app/stores/**"
---

# Pinia Stores

Pinia **chỉ** dùng cho state thật sự global — cần ở nhiều nơi không liên quan, persistent qua route transition. Server state và domain state thuộc về composable.

## Phân loại state

| Loại | Ở đâu | Ví dụ |
|------|-------|-------|
| Server state | composable + useFetch | danh sách buildings, chi tiết room |
| Global client state | Pinia store | session, sidebar open/closed, toast queue |
| Form state | component local hoặc composable | form.name, form.address, errors |
| Derived state | computed | filteredBuildings, totalActiveRooms |

## Stores trong v0.1

| Store | File | Giữ gì |
|-------|------|--------|
| Auth | `stores/auth.ts` | user, role, isAuthenticated |
| App UI | `stores/app.ts` | sidebarOpen, activeNav |
| Notifications | `stores/notifications.ts` | toast queue, notification count |

## ✓ Cách dùng đúng

**Auth store — session, user, role:**
```ts
// app/stores/auth.ts
import { defineStore } from 'pinia'
import type { AuthUser } from '~/types/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)

  const isAuthenticated = computed(() => user.value !== null)
  const role = computed(() => user.value?.role ?? null)
  const isAdmin = computed(() => role.value === 'admin')

  function setUser(u: AuthUser | null) {
    user.value = u
  }

  function clearSession() {
    user.value = null
  }

  return { user, isAuthenticated, role, isAdmin, setUser, clearSession }
})
```

**App store — UI state, sidebar:**
```ts
// app/stores/app.ts
export const useAppStore = defineStore('app', () => {
  const sidebarOpen = ref(true)
  const activeNavItem = ref<string | null>(null)

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function setActiveNav(key: string) {
    activeNavItem.value = key
  }

  return { sidebarOpen, activeNavItem, toggleSidebar, setActiveNav }
})
```

**Notifications store — toast queue:**
```ts
// app/stores/notifications.ts
import { nanoid } from 'nanoid'

interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number
}

export const useNotificationsStore = defineStore('notifications', () => {
  const toasts = ref<Toast[]>([])

  function addToast(toast: Omit<Toast, 'id'>) {
    toasts.value.push({ ...toast, id: nanoid() })
  }

  function removeToast(id: string) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return { toasts, addToast, removeToast }
})
```

**Dùng store trong component:**
```vue
<script setup lang="ts">
const authStore = useAuthStore()
const appStore = useAppStore()

// ✓ Dùng storeToRefs để reactive destructure
const { user, isAdmin } = storeToRefs(authStore)
const { sidebarOpen } = storeToRefs(appStore)
</script>
```

## ✗ Cách không được dùng

```ts
// ✗ Đừng dùng Pinia cho server/domain state
export const useBuildingsStore = defineStore('buildings', () => {
  const list = ref<Building[]>([])
  const loading = ref(false)

  async function fetchList() {
    loading.value = true
    list.value = await $fetch('/api/buildings')  // ← dùng composable + useFetch
    loading.value = false
  }

  return { list, loading, fetchList }
})

// ✗ Đừng control modal state trong store cho domain flow
export const useModalStore = defineStore('modal', () => {
  const buildingFormOpen = ref(false)
  // modal state thuộc về page/component, không global
})

// ✗ Đừng duplicate derived state
export const useBuildingsStore = defineStore('buildings', () => {
  const buildings = ref<Building[]>([])
  const activeBuildings = ref<Building[]>([])  // ← sai, dùng computed
  // const activeBuildings = computed(() => buildings.value.filter(b => b.status === 'active'))
})

// ✗ Đừng destructure trực tiếp mà không dùng storeToRefs (mất reactivity)
const { user } = useAuthStore()  // ← mất reactive
// → const { user } = storeToRefs(useAuthStore())

// ✗ Đừng gọi action trong store để fetch server data rồi cache trong state
// Server state cần freshness → dùng useFetch với cache control, không Pinia
```
