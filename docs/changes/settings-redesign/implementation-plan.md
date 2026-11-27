---
type: Change Implementation Plan
title: "settings-redesign-implementation-plan"
status: draft
change_state: implemented
tags: [superpowers, change, settings, ux, ui, navigation]
---

# Settings Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the five horizontal admin tabs and the separate profile pages with one Settings area (vertical grouped nav on desktop, drill-in list on mobile), and polish every page in it, led by a new Users page with a detail drawer.

**Architecture:** A nested Nuxt route (`app/pages/dashboard/settings.vue` + `<NuxtPage />`) renders the shell; `AppSettingsNav` reads a grouped, role-filtered model from `app/utils/constants/navigation.ts`. Existing child pages keep their files and data flow; the profile pages move under `settings/` with redirects from the old URLs. The Users page is rebuilt from three domain components (`UserListRow`, `UserCreateModal`, `UserDetailDrawer`) over the existing `useManagerAssignments` composable. No API, permission or data changes.

**Tech Stack:** Nuxt 4, Vue 3.5 `<script setup>`, Tailwind, VueUse, Zod, Vitest 4 + happy-dom + `@vue/test-utils`.

**Spec:** [design.md](./design.md)

## Global Constraints

- No API, server permission, or database change. Page middleware and server routes stay the source of truth for access.
- Use existing tokens and primitives only (`UiDrawer`, `UiModal`, `UiTabs`, `UiSearchInput`, `UiDefinitionList`, `UiDropdownMenu`, `UiBadge`, `UiToggle`, `UiEmptyState`, `UiSkeleton`, `UiAlert`). Do not create a new `Ui*` primitive. `UiPageHeader` only gains two props whose defaults preserve current behavior.
- Components use `pathPrefix: false`: file name = component name. Domain components for this change live in `app/components/users/`; the shell nav lives in `app/components/app/`.
- Spelling in every Settings page and component: "xoá", "khoá", "huỷ", "hoá đơn", "tòa nhà". Never write Vietnamese without diacritics.
- Verbs: **Xoá** = delete permanently; **Bỏ gán** = remove a user from one building; **Gỡ quyền truy cập** = revoke a tenant's portal access; **Dọn liên kết** = clean an orphaned link.
- Toasts: success "Đã <verb> <object>."; failure uses `getApiErrorMessage(err, 'Không thể <verb> <object>.')`.
- No horizontal overflow at 320, 375, 390, 768 or 1280px; touch targets at least 44px below `sm`.
- Comments: one short line, only for what code cannot show.
- UI quality workflow `.agents/skills/zeno-house/references/ui-polish-workflow.md` applies to every task that changes UI. Before the first UI task, read `.agents/skills/frontend-design/SKILL.md` and `.agents/skills/hallmark/SKILL.md` in full.
- Vitest: `npx vitest run <paths>`; there is no `--reporter=basic` in Vitest 4.

## Review Focus

- A manager (no admin rights) must see Settings with only "Cá nhân" and "Tòa nhà", and must never trigger the access-requests request (Task 1 and Task 4 tests).
- An owner viewing another owner in the Users list must not be able to open its drawer or act on it (Task 7 page test).
- A failed save, assign, toggle, unassign or delete in the drawer must keep the drawer open with the user's input intact and show a failure toast (Task 7 drawer and page tests).
- The old `/dashboard/profile` and `/dashboard/profile/password` links, including query strings, must land on the new pages (Task 5 route test).
- On desktop, `/dashboard/settings` must replace itself with the first visible item, and on mobile it must stay as the list (Task 5 index test).
- Audit sentences with technical keys (`water_input`) or a noun already inside the verb must not repeat or leak those keys (Task 10 unit tests).

---

### Task 1: Settings navigation model

**Files:**
- Modify: `app/utils/constants/navigation.ts`
- Test: `tests/utils/settings-navigation.test.ts`

**Interfaces:**
- Produces:
  - `SETTINGS_NAV_GROUPS` (`personal`, `administration`, `buildings`)
  - `type SettingsNavGroupKey`
  - `interface SettingsNavItem { key: string; label: string; to: string; group: SettingsNavGroupKey; adminOnly?: boolean; roles?: UserRole[] }`
  - `SETTINGS_NAV_ITEMS: SettingsNavItem[]`
  - `getSettingsNavGroups(ctx: { isAdmin: boolean; role: UserRole | null }): Array<{ key: SettingsNavGroupKey; label: string; items: SettingsNavItem[] }>`
  - `isNavItemVisible(item: Pick<NavItem, 'adminOnly' | 'roles'>, ctx)` (parameter widened, behavior unchanged)

- [ ] **Step 1: Write the failing test**

Create `tests/utils/settings-navigation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getSettingsNavGroups } from '~/utils/constants/navigation'

const keysFor = (role: 'admin' | 'owner' | 'manager') =>
  getSettingsNavGroups({ isAdmin: role === 'admin', role })
    .map(group => [group.key, group.items.map(item => item.key)])

describe('getSettingsNavGroups', () => {
  it('gives admin every group and item in order', () => {
    expect(keysFor('admin')).toEqual([
      ['personal', ['profile', 'security']],
      ['administration', ['users', 'tenant-accounts', 'access-requests', 'building-visibility', 'history']],
      ['buildings', ['building-settings']],
    ])
  })

  it('limits owner administration to users and tenant accounts', () => {
    expect(keysFor('owner')).toEqual([
      ['personal', ['profile', 'security']],
      ['administration', ['users', 'tenant-accounts']],
      ['buildings', ['building-settings']],
    ])
  })

  it('drops the empty administration group for manager', () => {
    expect(keysFor('manager')).toEqual([
      ['personal', ['profile', 'security']],
      ['buildings', ['building-settings']],
    ])
  })

  it('shows nothing role-gated when the role is unknown', () => {
    const groups = getSettingsNavGroups({ isAdmin: false, role: null })
    expect(groups.map(group => group.key)).toEqual(['personal', 'buildings'])
  })

  it('points every item at a settings route and uses the tòa spelling', () => {
    const items = getSettingsNavGroups({ isAdmin: true, role: 'admin' }).flatMap(group => group.items)
    expect(items.every(item => item.to.startsWith('/dashboard/settings/'))).toBe(true)
    expect(items.map(item => item.label).join('|')).not.toMatch(/[Tt]oà/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/utils/settings-navigation.test.ts`
Expected: FAIL (`getSettingsNavGroups` is not exported).

- [ ] **Step 3: Implement**

In `app/utils/constants/navigation.ts`:

1. Change the `isNavItemVisible` signature (body unchanged):

```ts
export function isNavItemVisible(
  item: Pick<NavItem, 'adminOnly' | 'roles'>,
  ctx: { isAdmin: boolean; role: UserRole | null },
): boolean {
```

2. Below the existing `NAV_SETTINGS_ITEMS` block (keep that block for now; Task 5 removes it), add:

```ts
export const SETTINGS_NAV_GROUPS = [
  { key: 'personal', label: 'Cá nhân' },
  { key: 'administration', label: 'Quản trị' },
  { key: 'buildings', label: 'Tòa nhà' },
] as const

export type SettingsNavGroupKey = (typeof SETTINGS_NAV_GROUPS)[number]['key']

export interface SettingsNavItem {
  key: string
  label: string
  to: string
  group: SettingsNavGroupKey
  adminOnly?: boolean
  roles?: UserRole[]
}

/** Items of the Settings area (`AppSettingsNav`); page middleware stays authoritative. */
export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { key: 'profile', label: 'Hồ sơ', to: '/dashboard/settings/profile', group: 'personal' },
  { key: 'security', label: 'Bảo mật', to: '/dashboard/settings/security', group: 'personal' },
  { key: 'users', label: 'Người dùng', to: '/dashboard/settings/managers', group: 'administration', roles: ['admin', 'owner'] },
  { key: 'tenant-accounts', label: 'Tài khoản người thuê', to: '/dashboard/settings/tenant-accounts', group: 'administration', roles: ['admin', 'owner'] },
  { key: 'access-requests', label: 'Yêu cầu truy cập', to: '/dashboard/settings/access-requests', group: 'administration', adminOnly: true },
  { key: 'building-visibility', label: 'Hiển thị tòa nhà', to: '/dashboard/settings/buildings', group: 'administration', adminOnly: true },
  { key: 'history', label: 'Nhật ký hoạt động', to: '/dashboard/settings/history', group: 'administration', adminOnly: true },
  { key: 'building-settings', label: 'Cài đặt tòa nhà', to: '/dashboard/settings/building-settings', group: 'buildings' },
]

export function getSettingsNavGroups(ctx: { isAdmin: boolean; role: UserRole | null }) {
  const items = SETTINGS_NAV_ITEMS.filter(item => isNavItemVisible(item, ctx))
  return SETTINGS_NAV_GROUPS
    .map(group => ({ key: group.key, label: group.label, items: items.filter(item => item.group === group.key) }))
    .filter(group => group.items.length > 0)
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/utils/settings-navigation.test.ts tests/components/app tests/utils/route-namespaces.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/utils/constants/navigation.ts tests/utils/settings-navigation.test.ts
git commit -m "feat(settings): add grouped settings navigation model"
```

---

### Task 2: `UiPageHeader` options for the Settings shell

**Files:**
- Modify: `app/components/ui/UiPageHeader.vue`
- Test: `tests/components/ui/UiPageHeader.test.ts`

**Interfaces:**
- Produces: props `reserveGlobalActions?: boolean` (default `true`) and `backMobileOnly?: boolean` (default `false`).

- [ ] **Step 1: Add failing tests**

Append inside the existing `describe('UiPageHeader', ...)` in `tests/components/ui/UiPageHeader.test.ts`:

```ts
  it('can drop the desktop reservation inside a shell that already clears global actions', () => {
    const wrapper = mount(UiPageHeader, {
      props: { title: 'Người dùng', reserveGlobalActions: false },
      global: { stubs: { NuxtLink: true, IconArrowLeft: true } },
    })

    expect(wrapper.classes()).not.toContain('lg:pr-44')
  })

  it('can hide the inline back link on desktop while keeping it on mobile', () => {
    const wrapper = mount(UiPageHeader, {
      props: { title: 'Hồ sơ', backTo: '/dashboard/settings', backMobileOnly: true },
      global: { stubs: { NuxtLink: defineComponent({ template: '<a data-back><slot /></a>' }), IconArrowLeft: true } },
    })

    expect(wrapper.get('[data-back]').classes()).toContain('lg:hidden')
  })

  it('keeps the inline back link visible on desktop by default', () => {
    const wrapper = mount(UiPageHeader, {
      props: { title: 'Chi tiết', backTo: '/dashboard' },
      global: { stubs: { NuxtLink: defineComponent({ template: '<a data-back><slot /></a>' }), IconArrowLeft: true } },
    })

    expect(wrapper.get('[data-back]').classes()).not.toContain('lg:hidden')
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/components/ui/UiPageHeader.test.ts`
Expected: the first two new tests FAIL.

- [ ] **Step 3: Implement**

In `app/components/ui/UiPageHeader.vue` replace the `defineProps` call with:

```ts
const props = withDefaults(defineProps<{
  title: string
  description?: string
  backTo?: RouteLocationRaw
  backLabel?: string
  /** Leave room for the floating desktop header actions; turn off inside a shell that already does. */
  reserveGlobalActions?: boolean
  /** Hide the inline back link at `lg+` where persistent navigation is visible. */
  backMobileOnly?: boolean
}>(), {
  reserveGlobalActions: true,
  backMobileOnly: false,
})
```

Add to the props doc comment at the top of the file:

```
 *   reserveGlobalActions → default true; false drops `lg:pr-44`
 *   backMobileOnly → default false; true hides the inline back link at `lg+`
```

In the template, replace the root `<div class="mb-6 flex flex-wrap items-start gap-3 lg:pr-44">` with:

```vue
  <div :class="['mb-6 flex flex-wrap items-start gap-3', reserveGlobalActions && 'lg:pr-44']">
```

and replace the back link opening tag's `class` with:

```vue
        :class="['mb-1 inline-flex items-center gap-1 text-xs text-ui-muted hover:text-ui-primary', backMobileOnly && 'lg:hidden']"
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/components/ui/UiPageHeader.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/components/ui/UiPageHeader.vue tests/components/ui/UiPageHeader.test.ts
git commit -m "feat(ui): let UiPageHeader opt out of the global-actions gutter"
```

---

### Task 3: Pending access-request count

**Files:**
- Create: `app/composables/useAccessRequestPendingCount.ts`
- Modify: `app/composables/useAccessRequests.ts`
- Test: `tests/composables/useAccessRequestPendingCount.test.ts`, `tests/composables/access-requests.test.ts`

**Interfaces:**
- Produces: `ACCESS_REQUEST_PENDING_COUNT_KEY = 'access-requests:pending-count'`; `useAccessRequestPendingCount(enabled: MaybeRefOrGetter<boolean>): ComputedRef<number | null>` (`null` when disabled, loading or errored).

- [ ] **Step 1: Write the failing test**

Create `tests/composables/useAccessRequestPendingCount.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const useLazyFetch = vi.fn()
vi.stubGlobal('useLazyFetch', useLazyFetch)

const data = ref<{ data: unknown[] } | undefined>(undefined)
const error = ref<unknown>(null)

beforeEach(() => {
  vi.clearAllMocks()
  data.value = undefined
  error.value = null
  useLazyFetch.mockReturnValue({ data, error })
})

const load = () => import('~/composables/useAccessRequestPendingCount')

describe('useAccessRequestPendingCount', () => {
  it('requests only pending items under a dedicated key, client-side', async () => {
    const { useAccessRequestPendingCount, ACCESS_REQUEST_PENDING_COUNT_KEY } = await load()
    useAccessRequestPendingCount(true)

    expect(useLazyFetch).toHaveBeenCalledWith('/api/access-requests', expect.objectContaining({
      key: ACCESS_REQUEST_PENDING_COUNT_KEY,
      query: { status: 'pending' },
      server: false,
      immediate: true,
    }))
  })

  it('does not fetch for users who cannot see the item', async () => {
    const { useAccessRequestPendingCount } = await load()
    const count = useAccessRequestPendingCount(false)

    expect(useLazyFetch).toHaveBeenCalledWith('/api/access-requests', expect.objectContaining({ immediate: false }))
    data.value = { data: [{ id: 'a' }] }
    expect(count.value).toBeNull()
  })

  it('is null while loading and equals the list length when loaded', async () => {
    const { useAccessRequestPendingCount } = await load()
    const count = useAccessRequestPendingCount(true)

    expect(count.value).toBeNull()
    data.value = { data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }
    expect(count.value).toBe(3)
  })

  it('is null when the request fails', async () => {
    const { useAccessRequestPendingCount } = await load()
    const count = useAccessRequestPendingCount(true)

    data.value = { data: [{ id: 'a' }] }
    error.value = new Error('forbidden')
    expect(count.value).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/composables/useAccessRequestPendingCount.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `app/composables/useAccessRequestPendingCount.ts`:

```ts
import type { ApiSuccess } from '~/types/api'
import type { AccessRequest } from '~/types/access-requests'

export const ACCESS_REQUEST_PENDING_COUNT_KEY = 'access-requests:pending-count'

/** Pending access-request count for the Settings nav badge; `null` when unavailable. */
export function useAccessRequestPendingCount(enabled: MaybeRefOrGetter<boolean>) {
  const { data, error } = useLazyFetch<ApiSuccess<AccessRequest[]>>('/api/access-requests', {
    key: ACCESS_REQUEST_PENDING_COUNT_KEY,
    query: { status: 'pending' },
    server: false,
    immediate: toValue(enabled),
  })

  return computed(() => (toValue(enabled) && !error.value && data.value ? data.value.data.length : null))
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/composables/useAccessRequestPendingCount.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Failing test for refresh after decisions**

In `tests/composables/access-requests.test.ts`, after the `vi.stubGlobal('useFetch', ...)` block add:

```ts
const refreshNuxtData = vi.fn(async () => {})
vi.stubGlobal('refreshNuxtData', refreshNuxtData)
```

and at the end of the existing test add:

```ts
    expect(refreshNuxtData).toHaveBeenCalledTimes(2)
    expect(refreshNuxtData).toHaveBeenCalledWith('access-requests:pending-count')
```

Run: `npx vitest run tests/composables/access-requests.test.ts`
Expected: FAIL.

- [ ] **Step 6: Implement the refresh**

In `app/composables/useAccessRequests.ts` add the import:

```ts
import { ACCESS_REQUEST_PENDING_COUNT_KEY } from './useAccessRequestPendingCount'
```

Add inside `useAccessRequests()` above `approve`:

```ts
  async function refreshAll(): Promise<void> {
    await Promise.all([refresh(), refreshNuxtData(ACCESS_REQUEST_PENDING_COUNT_KEY)])
  }
```

In `approve` and `reject`, replace `await refresh()` with `await refreshAll()`.

- [ ] **Step 7: Run tests and commit**

Run: `npx vitest run tests/composables/access-requests.test.ts tests/composables/useAccessRequestPendingCount.test.ts`
Expected: PASS.

```bash
git add app/composables/useAccessRequestPendingCount.ts app/composables/useAccessRequests.ts tests/composables/useAccessRequestPendingCount.test.ts tests/composables/access-requests.test.ts
git commit -m "feat(settings): add pending access-request count"
```

---

### Task 4: `AppSettingsNav`

**Files:**
- Create: `app/components/app/AppSettingsNav.vue`
- Test: `tests/components/app/AppSettingsNav.test.ts`

**Interfaces:**
- Consumes: `getSettingsNavGroups` (Task 1), `useAccessRequestPendingCount` (Task 3).
- Produces: `<AppSettingsNav variant="sidebar" | "list" />`. `sidebar` (default) is the desktop column with `aria-current`; `list` is the mobile drill-in list with chevrons. Root is `<nav aria-label="Cài đặt">`; each group wrapper has `data-settings-group="<key>"`.

- [ ] **Step 1: Write the failing test**

Create `tests/components/app/AppSettingsNav.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import AppSettingsNav from '../../../app/components/app/AppSettingsNav.vue'

const stubs = {
  NuxtLink: defineComponent({
    props: ['to'],
    setup(props, { slots, attrs }) {
      return () => h('a', { ...attrs, href: props.to }, slots.default?.())
    },
  }),
  IconChevronRight: true,
}

const pendingCount = ref<number | null>(null)
const pendingEnabled = vi.fn()

function mountNav(role: 'admin' | 'owner' | 'manager', path = '/dashboard/settings/profile', variant: 'sidebar' | 'list' = 'sidebar') {
  vi.stubGlobal('useRoute', () => ({ path }))
  vi.stubGlobal('useAuthStore', () => ({ isAdmin: role === 'admin', role }))
  vi.stubGlobal('useAccessRequestPendingCount', (enabled: () => boolean) => {
    pendingEnabled(enabled())
    return pendingCount
  })
  return mount(AppSettingsNav, { props: { variant }, global: { stubs } })
}

beforeEach(() => {
  vi.clearAllMocks()
  pendingCount.value = null
})

describe('AppSettingsNav', () => {
  it('labels the landmark and renders groups for admin', () => {
    const wrapper = mountNav('admin')

    expect(wrapper.get('nav').attributes('aria-label')).toBe('Cài đặt')
    expect(wrapper.findAll('[data-settings-group]').map(group => group.attributes('data-settings-group')))
      .toEqual(['personal', 'administration', 'buildings'])
    expect(wrapper.text()).toContain('Cá nhân')
    expect(wrapper.text()).toContain('Quản trị')
  })

  it('shows only personal and buildings to manager and never enables the pending request', () => {
    const wrapper = mountNav('manager')

    expect(wrapper.findAll('[data-settings-group]').map(group => group.attributes('data-settings-group')))
      .toEqual(['personal', 'buildings'])
    expect(pendingEnabled).toHaveBeenCalledWith(false)
  })

  it('marks the current item in the sidebar variant, including nested paths', () => {
    const wrapper = mountNav('admin', '/dashboard/settings/history')
    const current = wrapper.findAll('a[aria-current="page"]')

    expect(current).toHaveLength(1)
    expect(current[0]!.attributes('href')).toBe('/dashboard/settings/history')
  })

  it('does not mark items current in the list variant', () => {
    const wrapper = mountNav('admin', '/dashboard/settings', 'list')

    expect(wrapper.find('a[aria-current="page"]').exists()).toBe(false)
  })

  it('shows the pending badge with an accessible label only on access requests', () => {
    pendingCount.value = 3
    const wrapper = mountNav('admin')
    const access = wrapper.get('a[href="/dashboard/settings/access-requests"]')

    expect(access.text()).toContain('3')
    expect(access.text()).toContain('3 yêu cầu đang chờ duyệt')
    expect(wrapper.get('a[href="/dashboard/settings/managers"]').text()).not.toMatch(/\d/)
  })

  it('hides the badge for zero or unknown counts and caps large counts', () => {
    pendingCount.value = 0
    expect(mountNav('admin').get('a[href="/dashboard/settings/access-requests"]').text()).not.toMatch(/\d/)

    pendingCount.value = null
    expect(mountNav('admin').get('a[href="/dashboard/settings/access-requests"]').text()).not.toMatch(/\d/)

    pendingCount.value = 140
    expect(mountNav('admin').get('a[href="/dashboard/settings/access-requests"]').text()).toContain('99+')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/components/app/AppSettingsNav.test.ts`
Expected: FAIL (component missing).

- [ ] **Step 3: Implement**

Create `app/components/app/AppSettingsNav.vue`:

```vue
<script setup lang="ts">
import clsx from 'clsx'
import { getSettingsNavGroups } from '~/utils/constants/navigation'

const props = withDefaults(defineProps<{
  variant?: 'sidebar' | 'list'
}>(), {
  variant: 'sidebar',
})

const route = useRoute()
const authStore = useAuthStore()

const groups = computed(() => getSettingsNavGroups({ isAdmin: authStore.isAdmin, role: authStore.role }))

const pendingCount = useAccessRequestPendingCount(() => authStore.isAdmin)
const pendingBadge = computed(() => {
  const count = pendingCount.value
  if (!count || count < 1) return null
  return { text: count > 99 ? '99+' : String(count), label: `${count} yêu cầu đang chờ duyệt` }
})

function isActive(to: string) {
  return props.variant === 'sidebar' && (route.path === to || route.path.startsWith(`${to}/`))
}

function listClass() {
  return props.variant === 'list'
    ? '-mx-4 divide-y divide-ui-border border-y border-ui-border bg-ui-surface sm:mx-0 sm:rounded-lg sm:border'
    : 'space-y-0.5'
}

function linkClass(to: string) {
  const base = 'relative flex items-center gap-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ui-accent/40'
  if (props.variant === 'list') {
    return clsx(base, 'min-h-12 px-4 text-ui-primary hover:bg-ui-hover active:bg-ui-hover')
  }
  return clsx(
    base,
    'min-h-9 rounded-md px-3 py-1.5',
    isActive(to)
      ? 'bg-ui-surface font-medium text-ui-primary'
      : 'text-ui-muted hover:bg-ui-hover hover:text-ui-primary',
  )
}
</script>

<template>
  <nav aria-label="Cài đặt" class="space-y-5">
    <div v-for="group in groups" :key="group.key" :data-settings-group="group.key">
      <p
        :id="`settings-group-${group.key}`"
        class="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-ui-muted"
        :class="variant === 'list' && 'px-0'"
      >
        {{ group.label }}
      </p>
      <ul role="list" :aria-labelledby="`settings-group-${group.key}`" :class="listClass()">
        <li v-for="item in group.items" :key="item.key">
          <NuxtLink
            :to="item.to"
            :class="linkClass(item.to)"
            :aria-current="isActive(item.to) ? 'page' : undefined"
          >
            <span
              v-if="isActive(item.to)"
              class="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-ui-accent"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
            <span
              v-if="item.key === 'access-requests' && pendingBadge"
              class="inline-flex min-w-5 items-center justify-center rounded-full bg-status-warning/15 px-1.5 text-xs font-semibold tabular-nums text-status-warning"
            >
              <span aria-hidden="true">{{ pendingBadge.text }}</span>
              <span class="sr-only">{{ pendingBadge.label }}</span>
            </span>
            <IconChevronRight v-if="variant === 'list'" class="h-4 w-4 shrink-0 text-ui-muted" aria-hidden="true" />
          </NuxtLink>
        </li>
      </ul>
    </div>
  </nav>
</template>
```

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run tests/components/app/AppSettingsNav.test.ts`
Expected: PASS (6 tests).

```bash
git add app/components/app/AppSettingsNav.vue tests/components/app/AppSettingsNav.test.ts
git commit -m "feat(settings): add grouped settings navigation component"
```

---

### Task 5: Settings shell, routes and entry points

**Files:**
- Create: `app/pages/dashboard/settings.vue`, `app/pages/dashboard/settings/index.vue`
- Move: `app/pages/dashboard/profile/index.vue` → `app/pages/dashboard/settings/profile.vue`; `app/pages/dashboard/profile/password.vue` → `app/pages/dashboard/settings/security.vue`
- Modify: `app/pages/dashboard/settings/{managers,tenant-accounts,access-requests,buildings,history}.vue` (header only)
- Modify: `app/utils/routes/namespace.ts`, `app/utils/constants/navigation.ts`, `app/components/app/AppSidebar.vue`, `app/components/app/AppUserMenu.vue`
- Delete: `app/components/app/AppSettingsSubNav.vue`, `tests/components/app/AppSettingsSubNav.test.ts`
- Test: `tests/pages/settings-index.test.ts` (new), `tests/utils/route-namespaces.test.ts`, `tests/components/app/AppSidebar.test.ts`, `tests/pages/tenant-authorization-ui.spec.ts`

**Interfaces:**
- Consumes: `AppSettingsNav` (Task 4), `UiPageHeader` props (Task 2), `getSettingsNavGroups` (Task 1).
- Produces: routes `/dashboard/settings`, `/dashboard/settings/profile`, `/dashboard/settings/security`; `getLegacyDashboardRedirect` maps the two old profile URLs.

Every Settings child page uses this exact header attribute set (keep its own title, description and slots):

```vue
back-to="/dashboard/settings"
back-mobile-only
:reserve-global-actions="false"
```

- [ ] **Step 1: Failing route test**

In `tests/utils/route-namespaces.test.ts` add to the `it.each([...])` table of legacy routes:

```ts
    ['/dashboard/profile', '/dashboard/settings/profile'],
    ['/dashboard/profile/password', '/dashboard/settings/security'],
    ['/dashboard/profile/password?from=menu', '/dashboard/settings/security?from=menu'],
```

Run: `npx vitest run tests/utils/route-namespaces.test.ts`
Expected: FAIL for the three new rows.

- [ ] **Step 2: Implement the redirect**

In `app/utils/routes/namespace.ts` add above `getLegacyDashboardRedirect`:

```ts
const MOVED_DASHBOARD_ROUTES: Record<string, string> = {
  '/dashboard/profile': '/dashboard/settings/profile',
  '/dashboard/profile/password': '/dashboard/settings/security',
}
```

and make the function start with:

```ts
export function getLegacyDashboardRedirect(path: string): string | null {
  const [pathname = ''] = path.split(/[?#]/, 1)
  const moved = MOVED_DASHBOARD_ROUTES[pathname.replace(/\/$/, '')]
  if (moved) return `${moved}${path.slice(pathname.length)}`

  const isLegacyPath = LEGACY_DASHBOARD_PREFIXES.some(prefix => (
```

(the rest unchanged; drop the old `const [pathname] = ...` line).

Run: `npx vitest run tests/utils/route-namespaces.test.ts`
Expected: PASS.

- [ ] **Step 3: Failing index-page test**

Create `tests/pages/settings-index.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import SettingsIndex from '~/pages/dashboard/settings/index.vue'

const navigateTo = vi.fn()
const originalMatchMedia = window.matchMedia

function mountIndex(role: 'admin' | 'manager', desktop: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: desktop }) as unknown as typeof window.matchMedia
  vi.stubGlobal('useAuthStore', () => ({ isAdmin: role === 'admin', role }))
  return mount(SettingsIndex, {
    global: { stubs: { UiPageHeader: { template: '<header><slot /></header>' }, AppSettingsNav: true, UiSkeleton: true } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('navigateTo', navigateTo)
  vi.stubGlobal('useIntersectionObserver', vi.fn())
  vi.stubGlobal('useAppHeaderTitle', () => ref(null))
})

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe('settings index', () => {
  it('replaces itself with the first visible item on desktop', async () => {
    mountIndex('admin', true)
    await flushPromises()

    expect(navigateTo).toHaveBeenCalledWith('/dashboard/settings/profile', { replace: true })
  })

  it('stays as the drill-in list on mobile', async () => {
    const wrapper = mountIndex('manager', false)
    await flushPromises()

    expect(navigateTo).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'AppSettingsNav' }).exists()).toBe(true)
  })
})
```

Run: `npx vitest run tests/pages/settings-index.test.ts`
Expected: FAIL (page missing).

- [ ] **Step 4: Create the shell and index pages**

Create `app/pages/dashboard/settings.vue`:

```vue
<template>
  <div>
    <!-- Desktop row shared with the floating AppHeader actions; children start below it. -->
    <p class="mb-6 hidden h-10 items-center pr-44 text-xl font-semibold text-ui-primary lg:flex">
      Cài đặt
    </p>
    <div class="lg:flex lg:items-start lg:gap-8">
      <aside class="hidden w-52 shrink-0 lg:sticky lg:top-0 lg:block">
        <AppSettingsNav />
      </aside>
      <div class="min-w-0 flex-1">
        <NuxtPage />
      </div>
    </div>
  </div>
</template>
```

Create `app/pages/dashboard/settings/index.vue`:

```vue
<script setup lang="ts">
import { getSettingsNavGroups } from '~/utils/constants/navigation'

// Mobile large-title collapse: fades into the persistent app header once scrolled past.
const titleSentinel = ref<HTMLElement | null>(null)
const isTitleCollapsed = ref(false)
useIntersectionObserver(titleSentinel, ([entry]) => {
  isTitleCollapsed.value = !!entry && !entry.isIntersecting
})
const headerTitle = useAppHeaderTitle()
const compactTitle = computed(() => (isTitleCollapsed.value ? 'Cài đặt' : null))
watchEffect(() => {
  headerTitle.value = compactTitle.value
})
onBeforeUnmount(() => {
  if (headerTitle.value === compactTitle.value) headerTitle.value = null
})

const authStore = useAuthStore()

// Desktop already shows the nav column, so open the first item instead of an empty pane.
onMounted(() => {
  if (!window.matchMedia('(min-width: 1024px)').matches) return
  const first = getSettingsNavGroups({ isAdmin: authStore.isAdmin, role: authStore.role })[0]?.items[0]
  if (first) void navigateTo(first.to, { replace: true })
})
</script>

<template>
  <div>
    <div class="lg:hidden">
      <UiPageHeader
        title="Cài đặt"
        description="Tài khoản của bạn và quản trị hệ thống."
        :reserve-global-actions="false"
      >
        <div ref="titleSentinel" aria-hidden="true" />
      </UiPageHeader>
      <AppSettingsNav variant="list" />
    </div>
    <UiSkeleton class="hidden h-64 w-full lg:block" />
  </div>
</template>
```

Run: `npx vitest run tests/pages/settings-index.test.ts`
Expected: PASS.

- [ ] **Step 5: Move the profile pages**

```bash
git mv app/pages/dashboard/profile/index.vue app/pages/dashboard/settings/profile.vue
git mv app/pages/dashboard/profile/password.vue app/pages/dashboard/settings/security.vue
```

In `settings/profile.vue`:
- Root wrapper class `mx-auto w-full max-w-2xl space-y-6` → `w-full max-w-2xl space-y-6`.
- `UiPageHeader`: title `Hồ sơ`, description `Tên và ảnh đại diện hiển thị trong toàn hệ thống.`, plus the shared header attributes.
- Compact title string `'Hồ sơ của tôi'` → `'Hồ sơ'`.
- Delete the whole third `UiSurfacePanel` ("Bảo mật" with the `navigateTo('/dashboard/profile/password')` button); Security is now a nav item.

In `settings/security.vue`:
- Root wrapper class `mx-auto w-full max-w-2xl space-y-6` → `w-full max-w-2xl space-y-6`.
- `UiPageHeader`: title `Bảo mật`, description `Đổi mật khẩu đăng nhập. Cần nhập mật khẩu hiện tại để xác nhận.`, replace `:back-to="'/dashboard/profile'"` with the shared header attributes.
- Compact title `'Đổi mật khẩu'` → `'Bảo mật'`.
- In `onSubmit`, replace the last two lines (`toast.success(...)` and `await navigateTo('/dashboard/profile')`) with:

```ts
  Object.keys(touched).forEach(key => delete touched[key as keyof UserPasswordChangeInput])
  submitted.value = false
  toast.success('Đã đổi mật khẩu.')
```

- [ ] **Step 6: Point the five admin pages at the shell**

In each of `managers.vue`, `tenant-accounts.vue`, `access-requests.vue`, `buildings.vue`, `history.vue` under `app/pages/dashboard/settings/`:
- Delete the `<AppSettingsSubNav />` line.
- Add the shared header attributes to `UiPageHeader`.

- [ ] **Step 7: Switch the app entry points**

In `app/utils/constants/navigation.ts`:
- Replace the `administration` entry in `NAV_ITEMS` with:

```ts
  // Single entry point for every role; sub-pages are reached via AppSettingsNav (see SETTINGS_NAV_ITEMS).
  { key: 'settings', label: 'Cài đặt', to: '/dashboard/settings', activeMatch: '/dashboard/settings', icon: 'IconSettings', section: 'administration' },
```

- Delete the `NAV_SETTINGS_ITEMS` block and its doc comment.

In `app/components/app/AppSidebar.vue` and `app/components/app/AppUserMenu.vue` replace `to="/dashboard/profile"` with `to="/dashboard/settings/profile"`.

Delete the old sub-nav:

```bash
git rm app/components/app/AppSettingsSubNav.vue tests/components/app/AppSettingsSubNav.test.ts
```

In `tests/pages/tenant-authorization-ui.spec.ts` remove `'AppSettingsSubNav'` from the stub name list.

- [ ] **Step 8: Update sidebar tests**

In `tests/components/app/AppSidebar.test.ts`:
- `expect(hrefsIn('administration')).toEqual(['/dashboard/settings/managers'])` → `toEqual(['/dashboard/settings'])`.
- `expect(wrapper.text()).toContain('Quản trị')` → `toContain('Cài đặt')`.
- Replace the owner test body with:

```ts
    const wrapper = mountSidebar('owner')
    const administration = wrapper.get('[data-nav-section="administration"]')

    expect(administration.text()).toContain('Cài đặt')
    expect(administration.findAll('a')).toHaveLength(1)
```

  and rename it `'shows the single settings entry to owner'`.
- Replace the manager test with:

```ts
  it('shows the settings entry to manager', () => {
    const administration = mountSidebar('manager').get('[data-nav-section="administration"]')

    expect(administration.findAll('a').map(link => link.attributes('href'))).toEqual(['/dashboard/settings'])
  })
```

- In the active-state test rename it `'highlights Cài đặt across every /dashboard/settings sub-page'` and change `a[href="/dashboard/settings/managers"]` to `a[href="/dashboard/settings"]`.

- [ ] **Step 9: Run the affected suites**

Run: `npx vitest run tests/components/app tests/components/ui/UiPageHeader.test.ts tests/utils tests/pages/settings-index.test.ts tests/pages/tenant-authorization-ui.spec.ts tests/pages/access-request-approval-search.spec.ts tests/pages/settings-history.test.ts tests/pages/tenant-account-roommate-ui.spec.ts`
Expected: PASS. Then `npx eslint app/pages/dashboard app/components/app app/utils` with no errors.

- [ ] **Step 10: Browser check**

With the dev server at `https://localhost:3000`, as admin:
- 1280px: `/dashboard/settings` lands on Hồ sơ; the nav column shows three groups; "Cài đặt" row sits level with the global header buttons and nothing overlaps them; every tab's primary action is flush with the content edge.
- 390px: Settings is in the "Thêm" sheet; `/dashboard/settings` shows the grouped list; opening an item shows a back button in the app header that returns to the list.
- `/dashboard/profile` and `/dashboard/profile/password` redirect.
- As a manager: only Cá nhân and Tòa nhà are visible.
Fix material findings before committing.

- [ ] **Step 11: Commit**

```bash
git add -A app tests
git commit -m "feat(settings): unify settings shell with grouped navigation"
```

---

### Task 6: Building settings entry page

**Files:**
- Create: `app/pages/dashboard/settings/building-settings.vue`
- Test: `tests/pages/settings-building-settings.test.ts`

**Interfaces:**
- Consumes: `GET /api/buildings` (scoped by the server), `buildingSettingsPath` from `~/utils/routes/operational`.

- [ ] **Step 1: Failing test**

Create `tests/pages/settings-building-settings.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import Page from '~/pages/dashboard/settings/building-settings.vue'

const data = ref<{ data: unknown[] } | null>(null)
const status = ref('success')
const error = ref<unknown>(null)
const refresh = vi.fn()

const stubs = {
  UiPageHeader: { template: '<header><slot /></header>' },
  UiAlert: { template: '<div role="alert"><slot /></div>' },
  UiSkeleton: { template: '<div data-skeleton />' },
  UiEmptyState: { props: ['title'], template: '<p data-empty>{{ title }}</p>' },
  IconChevronRight: true,
  NuxtLink: defineComponent({ props: ['to'], setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()) }),
}

beforeEach(() => {
  vi.clearAllMocks()
  status.value = 'success'
  error.value = null
  data.value = { data: [{ id: 'b1', slug: 'zeno-dda', code: 'zhpn', name: 'Zeno House Đào Duy Anh', address: '88 Đào Duy Anh' }] }
  vi.stubGlobal('useFetch', vi.fn(() => ({ data, status, error, refresh })))
  vi.stubGlobal('useIntersectionObserver', vi.fn())
  vi.stubGlobal('useAppHeaderTitle', () => ref(null))
})

describe('building settings entry', () => {
  it('links each building to its settings page', async () => {
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    const link = wrapper.get('a')
    expect(link.text()).toContain('Zeno House Đào Duy Anh')
    expect(link.attributes('href')).toMatch(/\/settings$/)
  })

  it('shows an empty state when no building is in scope', async () => {
    data.value = { data: [] }
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    expect(wrapper.get('[data-empty]').text()).toBe('Chưa có tòa nhà nào trong phạm vi của bạn')
  })

  it('offers a retry when loading fails', async () => {
    error.value = new Error('boom')
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    await wrapper.get('[role="alert"] button').trigger('click')
    expect(refresh).toHaveBeenCalled()
  })
})
```

Run: `npx vitest run tests/pages/settings-building-settings.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement**

Create `app/pages/dashboard/settings/building-settings.vue`:

```vue
<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { Building } from '~/types/buildings'
import { getApiErrorMessage } from '~/utils/api-error'
import { buildingSettingsPath } from '~/utils/routes/operational'

// Mobile large-title collapse: fades into the persistent app header once scrolled past.
const titleSentinel = ref<HTMLElement | null>(null)
const isTitleCollapsed = ref(false)
useIntersectionObserver(titleSentinel, ([entry]) => {
  isTitleCollapsed.value = !!entry && !entry.isIntersecting
})
const headerTitle = useAppHeaderTitle()
const compactTitle = computed(() => (isTitleCollapsed.value ? 'Cài đặt tòa nhà' : null))
watchEffect(() => {
  headerTitle.value = compactTitle.value
})
onBeforeUnmount(() => {
  if (headerTitle.value === compactTitle.value) headerTitle.value = null
})

const { data, status, error, refresh } = useFetch<ApiSuccess<Building[]>>('/api/buildings', {
  query: { limit: 100, sort: 'name', order: 'asc' },
})
const buildings = computed(() => data.value?.data ?? [])
</script>

<template>
  <div>
    <UiPageHeader
      title="Cài đặt tòa nhà"
      description="Hợp đồng, dịch vụ, hoá đơn và quy tắc tài chính của từng tòa."
      back-to="/dashboard/settings"
      back-mobile-only
      :reserve-global-actions="false"
    >
      <div ref="titleSentinel" aria-hidden="true" />
    </UiPageHeader>

    <UiAlert v-if="error" severity="danger" title="Không tải được danh sách tòa nhà">
      <p>{{ getApiErrorMessage(error, 'Hãy thử lại sau.') }}</p>
      <UiButton class="mt-2" size="sm" variant="secondary" @click="refresh()">Thử lại</UiButton>
    </UiAlert>

    <div v-else-if="status === 'pending'" class="space-y-2">
      <UiSkeleton v-for="n in 3" :key="n" class="h-14 w-full" />
    </div>

    <UiEmptyState v-else-if="buildings.length === 0" title="Chưa có tòa nhà nào trong phạm vi của bạn" />

    <ul
      v-else
      role="list"
      class="-mx-4 divide-y divide-ui-border border-y border-ui-border bg-ui-surface sm:mx-0 sm:rounded-lg sm:border"
    >
      <li v-for="building in buildings" :key="building.id">
        <NuxtLink
          :to="buildingSettingsPath(building)"
          class="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-ui-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ui-accent/40"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-ui-primary">{{ building.name }}</p>
            <p v-if="building.address" class="truncate text-xs text-ui-muted">{{ building.address }}</p>
          </div>
          <span class="hidden text-xs text-ui-muted sm:inline">Mở cài đặt</span>
          <IconChevronRight class="h-4 w-4 shrink-0 text-ui-muted" aria-hidden="true" />
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
```

- [ ] **Step 3: Run tests, browser check, commit**

Run: `npx vitest run tests/pages/settings-building-settings.test.ts`
Expected: PASS.

Browser: open `/dashboard/settings/building-settings` at 390px and 1280px as admin and as manager (manager sees only assigned buildings); each row opens that building's settings.

```bash
git add app/pages/dashboard/settings/building-settings.vue tests/pages/settings-building-settings.test.ts
git commit -m "feat(settings): add building settings entry list"
```

---

### Task 7: Users page with detail drawer

**Files:**
- Create: `app/utils/users/display.ts`, `app/components/users/UserListRow.vue`, `app/components/users/UserCreateModal.vue`, `app/components/users/UserDetailDrawer.vue`
- Rewrite: `app/pages/dashboard/settings/managers.vue`
- Test: `tests/utils/users-display.test.ts`, `tests/components/users/UserListRow.test.ts`, `tests/components/users/UserCreateModal.test.ts`, `tests/components/users/UserDetailDrawer.test.ts`, `tests/pages/settings-users.test.ts`

**Interfaces:**
- Produces:
  - `userInitials(name: string | null, email: string | null): string`
  - `managedRoleLabel(role: UserRole | null): string` (`owner` → `Chủ nhà`, `manager` → `Quản lý`, `admin` → `Quản trị viên`, else `—`)
  - `UserListRow` props `{ row: ManagedUserWithAssignments; manageable: boolean }`, emits `open(userId: string)`
  - `UserCreateModal` props `{ open: boolean; buildings: { id: string; name: string }[]; roleOptions: { value: CreatableRole; label: string }[]; defaultRole: CreatableRole; busy: boolean }`, emits `close()`, `submit(payload: UserCreateInput)`
  - `UserDetailDrawer` props `{ row: ManagedUserWithAssignments | null; buildings: { id: string; name: string }[]; roleOptions: { value: CreatableRole; label: string }[]; canEditRole: boolean; busyKey: string | null }`, `v-model:editing` (boolean), emits `close()`, `update(id, payload: UserUpdateInput)`, `assign(userId, buildingId)`, `toggleDelete(assignmentId, value: boolean)`, `unassign(assignmentId)`, `remove(id)`
  - `busyKey` values: `update:<userId>`, `assign:<userId>`, `toggle:<assignmentId>`, `unassign:<assignmentId>`, `delete:<userId>`

- [ ] **Step 1: Display helpers (test first)**

Create `tests/utils/users-display.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { managedRoleLabel, userInitials } from '~/utils/users/display'

describe('userInitials', () => {
  it.each([
    ['Bùi Văn Linh', null, 'BL'],
    ['Nguyen Tung Duong', 'x@y.z', 'ND'],
    ['Minh', null, 'MI'],
    ['  ', 'tuananh@gmail.com', 'TU'],
    [null, null, '?'],
  ])('%s / %s → %s', (name, email, expected) => {
    expect(userInitials(name, email)).toBe(expected)
  })
})

describe('managedRoleLabel', () => {
  it('uses product terms', () => {
    expect(managedRoleLabel('owner')).toBe('Chủ nhà')
    expect(managedRoleLabel('manager')).toBe('Quản lý')
    expect(managedRoleLabel('admin')).toBe('Quản trị viên')
    expect(managedRoleLabel(null)).toBe('—')
  })
})
```

Run: `npx vitest run tests/utils/users-display.test.ts` → FAIL. Then create `app/utils/users/display.ts`:

```ts
import type { UserRole } from '~/utils/constants/roles'

export function userInitials(name: string | null, email: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return `${words[0]!.charAt(0)}${words.at(-1)!.charAt(0)}`.toLocaleUpperCase('vi')
  if (words.length === 1) return words[0]!.slice(0, 2).toLocaleUpperCase('vi')
  const local = (email ?? '').split('@')[0] ?? ''
  return local.slice(0, 2).toLocaleUpperCase('vi') || '?'
}

const ROLE_LABELS: Partial<Record<UserRole, string>> = {
  admin: 'Quản trị viên',
  owner: 'Chủ nhà',
  manager: 'Quản lý',
}

export function managedRoleLabel(role: UserRole | null): string {
  return (role && ROLE_LABELS[role]) || '—'
}
```

Run again → PASS.

- [ ] **Step 2: `UserListRow` (test first)**

Create `tests/components/users/UserListRow.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UserListRow from '~/components/users/UserListRow.vue'
import type { ManagedUserWithAssignments } from '~/types/users'

const row = (assignments = 0): ManagedUserWithAssignments => ({
  user: { id: 'u1', email: 'linh@zeno.test', name: 'Bùi Văn Linh', role: 'owner', createdBy: null },
  assignments: Array.from({ length: assignments }, (_, i) => ({ id: `a${i}`, building_id: `b${i}`, can_delete_master_data: false, building: null }) as never),
})

const stubs = { UiBadge: { template: '<span data-badge><slot /></span>' }, IconChevronRight: true }

describe('UserListRow', () => {
  it('renders identity, initials, role and a missing-building warning', () => {
    const wrapper = mount(UserListRow, { props: { row: row(0), manageable: true }, global: { stubs } })

    expect(wrapper.text()).toContain('BL')
    expect(wrapper.text()).toContain('Bùi Văn Linh')
    expect(wrapper.text()).toContain('linh@zeno.test')
    expect(wrapper.findAll('[data-badge]').map(b => b.text())).toEqual(['Chủ nhà', 'Chưa có tòa'])
  })

  it('shows the building count when assigned', () => {
    const wrapper = mount(UserListRow, { props: { row: row(2), manageable: true }, global: { stubs } })
    expect(wrapper.text()).toContain('2 tòa')
  })

  it('is a button that emits open when manageable', async () => {
    const wrapper = mount(UserListRow, { props: { row: row(1), manageable: true }, global: { stubs } })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('open')).toEqual([['u1']])
  })

  it('is not interactive when the viewer cannot manage the user', () => {
    const wrapper = mount(UserListRow, { props: { row: row(1), manageable: false }, global: { stubs } })
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
```

Run → FAIL. Create `app/components/users/UserListRow.vue`:

```vue
<script setup lang="ts">
import type { ManagedUserWithAssignments } from '~/types/users'
import { managedRoleLabel, userInitials } from '~/utils/users/display'

const props = defineProps<{
  row: ManagedUserWithAssignments
  manageable: boolean
}>()

const emit = defineEmits<{
  (e: 'open', userId: string): void
}>()

const displayName = computed(() => props.row.user.name ?? props.row.user.email ?? props.row.user.id)
const secondary = computed(() => (props.row.user.name ? props.row.user.email : null))
const initials = computed(() => userInitials(props.row.user.name, props.row.user.email))
</script>

<template>
  <component
    :is="manageable ? 'button' : 'div'"
    :type="manageable ? 'button' : undefined"
    class="flex w-full items-center gap-3 px-4 py-3 text-left"
    :class="manageable && 'transition-colors hover:bg-ui-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ui-accent/40'"
    @click="manageable && emit('open', row.user.id)"
  >
    <span
      class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ui-accent/15 text-xs font-semibold text-ui-accent"
      aria-hidden="true"
    >
      {{ initials }}
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-medium text-ui-primary">{{ displayName }}</span>
      <span v-if="secondary" class="block truncate text-xs text-ui-muted">{{ secondary }}</span>
    </span>
    <span class="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-1.5">
      <UiBadge :variant="row.user.role === 'owner' ? 'accent' : 'neutral'">{{ managedRoleLabel(row.user.role) }}</UiBadge>
      <UiBadge v-if="row.assignments.length === 0" variant="warning">Chưa có tòa</UiBadge>
      <span v-else class="text-xs tabular-nums text-ui-muted">{{ row.assignments.length }} tòa</span>
    </span>
    <IconChevronRight v-if="manageable" class="h-4 w-4 shrink-0 text-ui-muted" aria-hidden="true" />
  </component>
</template>
```

Run → PASS.

- [ ] **Step 3: `UserCreateModal` (test first)**

Create `tests/components/users/UserCreateModal.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import UserCreateModal from '~/components/users/UserCreateModal.vue'

const UiInput = defineComponent({
  props: ['modelValue', 'label', 'error'],
  emits: ['update:modelValue'],
  setup: (props, { emit }) => () => h('label', [
    props.label,
    h('input', { 'data-label': props.label, value: props.modelValue, onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value) }),
    props.error ? h('em', { 'data-error': props.label }, props.error) : null,
  ]),
})

const stubs = {
  UiModal: { props: ['open'], template: '<div v-if="open"><slot /><slot name="footer" /></div>' },
  UiInput,
  UiSelect: { props: ['modelValue'], template: '<select />' },
  UiAlert: { template: '<div><slot /></div>' },
  IconPlus: true,
}

const props = {
  open: true,
  buildings: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Zeno House Đào Duy Anh' }],
  roleOptions: [{ value: 'manager' as const, label: 'Quản lý' }],
  defaultRole: 'manager' as const,
  busy: false,
}

async function fill(wrapper: ReturnType<typeof mount>, label: string, value: string) {
  await wrapper.get(`input[data-label="${label}"]`).setValue(value)
}

describe('UserCreateModal', () => {
  it('shows field errors and does not submit invalid input', async () => {
    const wrapper = mount(UserCreateModal, { props, global: { stubs } })
    await wrapper.get('form').trigger('submit')

    expect(wrapper.find('[data-error="Email"]').exists()).toBe(true)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('submits a normalized payload with selected buildings', async () => {
    const wrapper = mount(UserCreateModal, { props, global: { stubs } })
    await fill(wrapper, 'Email', 'Linh@Zeno.test')
    await fill(wrapper, 'Mật khẩu', 'Secret#2026')
    await wrapper.get('button[aria-pressed]').trigger('click')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      email: 'linh@zeno.test',
      password: 'Secret#2026',
      role: 'manager',
      building_ids: ['11111111-1111-4111-8111-111111111111'],
    })
  })

  it('resets the form each time it opens', async () => {
    const wrapper = mount(UserCreateModal, { props, global: { stubs } })
    await fill(wrapper, 'Email', 'a@b.c')
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })

    expect((wrapper.get('input[data-label="Email"]').element as HTMLInputElement).value).toBe('')
  })
})
```

`passwordSchema` requires at least 8 characters, which `'Secret#2026'` satisfies. Run → FAIL. Create `app/components/users/UserCreateModal.vue`:

```vue
<script setup lang="ts">
import type { CreatableRole } from '~/utils/constants/roles'
import { userCreateSchema, type UserCreateInput } from '~/utils/validators/users'

const props = defineProps<{
  open: boolean
  buildings: { id: string; name: string }[]
  roleOptions: { value: CreatableRole; label: string }[]
  defaultRole: CreatableRole
  busy: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: UserCreateInput): void
}>()

const form = reactive({ email: '', password: '', full_name: '', role: props.defaultRole, building_ids: [] as string[] })
const fieldErrors = ref<Record<string, string[]>>({})

watch(() => props.open, (open) => {
  if (!open) return
  Object.assign(form, { email: '', password: '', full_name: '', role: props.defaultRole, building_ids: [] })
  fieldErrors.value = {}
})

function toggleBuilding(id: string) {
  form.building_ids = form.building_ids.includes(id)
    ? form.building_ids.filter(value => value !== id)
    : [...form.building_ids, id]
}

function submit() {
  const parsed = userCreateSchema.safeParse({ ...form, full_name: form.full_name.trim() || undefined })
  if (!parsed.success) {
    fieldErrors.value = parsed.error.flatten().fieldErrors as Record<string, string[]>
    return
  }
  fieldErrors.value = {}
  emit('submit', parsed.data)
}
</script>

<template>
  <UiModal :open="open" title="Thêm người dùng" size="md" @close="emit('close')">
    <form id="user-create-form" class="space-y-4" novalidate @submit.prevent="submit">
      <div class="grid gap-3 sm:grid-cols-2">
        <UiInput v-model="form.email" label="Email" type="email" autocomplete="off" required :error="fieldErrors.email?.[0]" />
        <UiInput v-model="form.password" label="Mật khẩu" type="password" autocomplete="new-password" required :error="fieldErrors.password?.[0]" />
        <UiInput v-model="form.full_name" label="Họ tên" hint="Tuỳ chọn" :error="fieldErrors.full_name?.[0]" />
        <UiSelect v-model="form.role" label="Vai trò" :options="roleOptions" :disabled="roleOptions.length === 1" />
      </div>
      <fieldset v-if="buildings.length > 0">
        <legend class="mb-1.5 text-sm font-medium text-ui-muted">Tòa nhà phụ trách <span class="font-normal">(tuỳ chọn)</span></legend>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="building in buildings"
            :key="building.id"
            type="button"
            :aria-pressed="form.building_ids.includes(building.id)"
            class="inline-flex min-h-11 items-center rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40 sm:min-h-9 sm:text-xs"
            :class="form.building_ids.includes(building.id)
              ? 'border-ui-accent bg-ui-accent/15 text-ui-accent'
              : 'border-ui-border text-ui-muted hover:border-ui-border-strong hover:text-ui-primary'"
            @click="toggleBuilding(building.id)"
          >
            {{ building.name }}
          </button>
        </div>
      </fieldset>
      <p class="text-xs text-ui-muted">Sau khi tạo, hãy gửi email và mật khẩu cho người dùng.</p>
    </form>
    <template #footer>
      <UiButton variant="secondary" :disabled="busy" @click="emit('close')">Huỷ</UiButton>
      <UiButton type="submit" form="user-create-form" :loading="busy">
        <IconPlus class="h-3.5 w-3.5" aria-hidden="true" />
        Thêm người dùng
      </UiButton>
    </template>
  </UiModal>
</template>
```

Run → PASS.

- [ ] **Step 4: `UserDetailDrawer` (test first)**

Create `tests/components/users/UserDetailDrawer.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import UserDetailDrawer from '~/components/users/UserDetailDrawer.vue'
import type { ManagedUserWithAssignments } from '~/types/users'

const row: ManagedUserWithAssignments = {
  user: { id: 'u1', email: 'duong@zeno.test', name: 'Nguyen Tung Duong', role: 'manager', createdBy: null },
  assignments: [
    { id: 'a1', building_id: 'b1', can_delete_master_data: false, building: { id: 'b1', slug: 's', code: 'nttt', name: 'Nguyen Thanh Tung', address: '', status: 'active' } },
  ] as never,
}

const UiButton = defineComponent({
  props: ['loading', 'disabled', 'variant'],
  emits: ['click'],
  setup: (props, { slots, emit, attrs }) => () => h('button', { ...attrs, disabled: props.disabled, onClick: () => emit('click') }, slots.default?.()),
})

const stubs = {
  UiDrawer: { props: ['modelValue', 'title'], template: '<div v-if="modelValue"><slot name="header" /><slot /></div>' },
  UiButton,
  UiToggle: defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], setup: (props, { emit }) => () => h('input', { type: 'checkbox', 'data-toggle': '', checked: props.modelValue, onChange: () => emit('update:modelValue', !props.modelValue) }) }),
  UiSelect: defineComponent({ props: ['modelValue', 'options'], emits: ['update:modelValue'], setup: (props, { emit }) => () => h('select', { 'data-assign': '', onChange: (e: Event) => emit('update:modelValue', (e.target as HTMLSelectElement).value) }, (props.options as { value: string; label: string }[]).map(o => h('option', { value: o.value }, o.label))) }),
  UiInput: defineComponent({ props: ['modelValue', 'label'], emits: ['update:modelValue'], setup: (props, { emit }) => () => h('input', { 'data-label': props.label, value: props.modelValue, onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value) }) }),
  UiAlert: { template: '<div role="alert"><slot /></div>' },
  UiBadge: { template: '<span><slot /></span>' },
}

const baseProps = {
  row,
  buildings: [{ id: 'b1', name: 'Nguyen Thanh Tung' }, { id: 'b2', name: 'Zeno House Phan Tây Hồ' }],
  roleOptions: [{ value: 'owner' as const, label: 'Chủ nhà' }, { value: 'manager' as const, label: 'Quản lý' }],
  canEditRole: false,
  busyKey: null,
  editing: false,
}

const button = (wrapper: ReturnType<typeof mount>, text: string) =>
  wrapper.findAll('button').find(b => b.text().trim() === text)!

describe('UserDetailDrawer', () => {
  it('lists assignments and emits toggle and unassign', async () => {
    const wrapper = mount(UserDetailDrawer, { props: baseProps, global: { stubs } })

    expect(wrapper.text()).toContain('Nguyen Thanh Tung')
    await wrapper.get('[data-toggle]').trigger('change')
    expect(wrapper.emitted('toggleDelete')).toEqual([['a1', true]])
    await button(wrapper, 'Bỏ gán').trigger('click')
    expect(wrapper.emitted('unassign')).toEqual([['a1']])
  })

  it('offers only unassigned buildings and emits assign', async () => {
    const wrapper = mount(UserDetailDrawer, { props: baseProps, global: { stubs } })
    const select = wrapper.get('[data-assign]')

    expect(select.findAll('option').map(o => o.text())).toEqual(['Chọn tòa nhà…', 'Zeno House Phan Tây Hồ'])
    await select.setValue('b2')
    await wrapper.get('[data-assign-form]').trigger('submit')
    expect(wrapper.emitted('assign')).toEqual([['u1', 'b2']])
  })

  it('requires a second confirmation before emitting remove', async () => {
    const wrapper = mount(UserDetailDrawer, { props: baseProps, global: { stubs } })

    await button(wrapper, 'Xoá người dùng').trigger('click')
    expect(wrapper.emitted('remove')).toBeUndefined()
    expect(wrapper.text()).toContain('thu hồi quyền đăng nhập')
    await button(wrapper, 'Xoá vĩnh viễn').trigger('click')
    expect(wrapper.emitted('remove')).toEqual([['u1']])
  })

  it('cancelling the confirmation returns to the initial danger zone', async () => {
    const wrapper = mount(UserDetailDrawer, { props: baseProps, global: { stubs } })

    await button(wrapper, 'Xoá người dùng').trigger('click')
    await button(wrapper, 'Huỷ').trigger('click')
    expect(button(wrapper, 'Xoá người dùng')).toBeTruthy()
  })

  it('edits inline and omits role when the viewer cannot change roles', async () => {
    const wrapper = mount(UserDetailDrawer, { props: baseProps, global: { stubs } })

    await button(wrapper, 'Sửa').trigger('click')
    expect(wrapper.emitted('update:editing')).toEqual([[true]])
    await wrapper.setProps({ editing: true })
    await wrapper.get('input[data-label="Họ tên"]').setValue('Dương Nguyễn')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('update')).toEqual([['u1', { email: 'duong@zeno.test', full_name: 'Dương Nguyễn' }]])
  })

  it('includes the role when the viewer is admin', async () => {
    const wrapper = mount(UserDetailDrawer, { props: { ...baseProps, canEditRole: true }, global: { stubs } })

    await button(wrapper, 'Sửa').trigger('click')
    await wrapper.setProps({ editing: true })
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('update')?.[0]?.[1]).toMatchObject({ role: 'manager' })
  })

  it('shows a validation message instead of emitting an invalid email', async () => {
    const wrapper = mount(UserDetailDrawer, { props: baseProps, global: { stubs } })

    await button(wrapper, 'Sửa').trigger('click')
    await wrapper.setProps({ editing: true })
    await wrapper.get('input[data-label="Email"]').setValue('not-an-email')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('update')).toBeUndefined()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })
})
```

Run → FAIL. Create `app/components/users/UserDetailDrawer.vue`:

```vue
<script setup lang="ts">
import type { ManagedUserWithAssignments } from '~/types/users'
import { ROLES, type CreatableRole } from '~/utils/constants/roles'
import { userUpdateSchema, type UserUpdateInput } from '~/utils/validators/users'
import { managedRoleLabel, userInitials } from '~/utils/users/display'

const props = defineProps<{
  row: ManagedUserWithAssignments | null
  buildings: { id: string; name: string }[]
  roleOptions: { value: CreatableRole; label: string }[]
  canEditRole: boolean
  busyKey: string | null
}>()

const editing = defineModel<boolean>('editing', { default: false })

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update', id: string, payload: UserUpdateInput): void
  (e: 'assign', userId: string, buildingId: string): void
  (e: 'toggleDelete', assignmentId: string, value: boolean): void
  (e: 'unassign', assignmentId: string): void
  (e: 'remove', id: string): void
}>()

const form = reactive({ email: '', password: '', full_name: '', role: ROLES.MANAGER as CreatableRole })
const formError = ref<string | null>(null)
const buildingToAssign = ref('')
const confirmingDelete = ref(false)
const cancelDeleteRef = ref<{ $el?: HTMLElement } | null>(null)

const displayName = computed(() => props.row?.user.name ?? props.row?.user.email ?? '')
const initials = computed(() => (props.row ? userInitials(props.row.user.name, props.row.user.email) : ''))
const availableOptions = computed(() => {
  const assigned = new Set(props.row?.assignments.map(a => a.building_id))
  return [
    { value: '', label: 'Chọn tòa nhà…' },
    ...props.buildings.filter(b => !assigned.has(b.id)).map(b => ({ value: b.id, label: b.name })),
  ]
})
const isBusy = (key: string) => props.busyKey === key

watch(() => props.row?.user.id, () => {
  editing.value = false
  confirmingDelete.value = false
  buildingToAssign.value = ''
  formError.value = null
})
watch(() => props.row?.assignments.length, () => { buildingToAssign.value = '' })

function startEdit() {
  if (!props.row) return
  form.email = props.row.user.email ?? ''
  form.password = ''
  form.full_name = props.row.user.name ?? ''
  form.role = props.row.user.role === ROLES.OWNER ? ROLES.OWNER : ROLES.MANAGER
  formError.value = null
  editing.value = true
}

function submitEdit() {
  if (!props.row) return
  const payload: UserUpdateInput = { email: form.email, full_name: form.full_name }
  if (form.password) payload.password = form.password
  if (props.canEditRole) payload.role = form.role
  const parsed = userUpdateSchema.safeParse(payload)
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message ?? 'Thông tin chưa hợp lệ.'
    return
  }
  formError.value = null
  emit('update', props.row.user.id, parsed.data)
}

async function askDelete() {
  confirmingDelete.value = true
  await nextTick()
  cancelDeleteRef.value?.$el?.focus()
}
</script>

<template>
  <UiDrawer
    :model-value="row !== null"
    :title="displayName"
    width="lg:w-[26rem]"
    @update:model-value="!$event && emit('close')"
  >
    <template #header>
      <div v-if="row" class="flex min-w-0 items-center gap-3">
        <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ui-accent/15 text-sm font-semibold text-ui-accent" aria-hidden="true">{{ initials }}</span>
        <div class="min-w-0">
          <h2 class="truncate text-base font-semibold text-ui-primary">{{ displayName }}</h2>
          <p class="truncate text-xs text-ui-muted">{{ row.user.email }} · {{ managedRoleLabel(row.user.role) }}</p>
        </div>
      </div>
    </template>

    <div v-if="row" class="space-y-6">
      <section aria-labelledby="user-info-heading">
        <div class="mb-2 flex items-center justify-between">
          <h3 id="user-info-heading" class="text-xs font-semibold uppercase tracking-wide text-ui-muted">Thông tin</h3>
          <UiButton v-if="!editing" size="sm" variant="secondary" @click="startEdit">Sửa</UiButton>
        </div>
        <form v-if="editing" class="space-y-3" novalidate @submit.prevent="submitEdit">
          <UiInput v-model="form.email" label="Email" type="email" autocomplete="off" />
          <UiInput v-model="form.full_name" label="Họ tên" />
          <UiInput v-model="form.password" label="Mật khẩu mới" type="password" autocomplete="new-password" hint="Để trống nếu không đổi" />
          <UiSelect v-if="canEditRole" v-model="form.role" label="Vai trò" :options="roleOptions" />
          <UiAlert v-if="formError" severity="danger">{{ formError }}</UiAlert>
          <div class="flex justify-end gap-2">
            <UiButton variant="secondary" :disabled="isBusy(`update:${row.user.id}`)" @click="editing = false">Huỷ</UiButton>
            <UiButton type="submit" :loading="isBusy(`update:${row.user.id}`)">Lưu</UiButton>
          </div>
        </form>
        <UiDefinitionList v-else>
          <UiDefinitionItem label="Email" :value="row.user.email" />
          <UiDefinitionItem label="Họ tên" :value="row.user.name" />
          <UiDefinitionItem label="Vai trò" :value="managedRoleLabel(row.user.role)" />
        </UiDefinitionList>
      </section>

      <section aria-labelledby="user-buildings-heading">
        <h3 id="user-buildings-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-ui-muted">Tòa nhà phụ trách</h3>
        <p v-if="row.assignments.length === 0" class="py-2 text-sm text-ui-muted">Chưa được gán tòa nhà nào.</p>
        <ul v-else role="list" class="divide-y divide-ui-border">
          <li v-for="assignment in row.assignments" :key="assignment.id" class="flex items-center gap-3 py-2.5">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm text-ui-primary">{{ assignment.building?.name ?? assignment.building_id }}</p>
              <p class="text-xs text-ui-muted">Cho xoá dữ liệu</p>
            </div>
            <UiToggle
              :model-value="assignment.can_delete_master_data"
              size="sm"
              :aria-label="`Cho xoá dữ liệu ở ${assignment.building?.name ?? 'tòa nhà này'}`"
              :disabled="isBusy(`toggle:${assignment.id}`)"
              @update:model-value="emit('toggleDelete', assignment.id, $event)"
            />
            <UiButton size="sm" variant="ghost" :loading="isBusy(`unassign:${assignment.id}`)" @click="emit('unassign', assignment.id)">Bỏ gán</UiButton>
          </li>
        </ul>
        <form
          v-if="availableOptions.length > 1"
          data-assign-form
          class="mt-2 flex items-center gap-2"
          @submit.prevent="buildingToAssign && emit('assign', row.user.id, buildingToAssign)"
        >
          <UiSelect v-model="buildingToAssign" :options="availableOptions" aria-label="Chọn tòa nhà để gán" class="min-w-0 flex-1" />
          <UiButton type="submit" size="sm" :disabled="!buildingToAssign" :loading="isBusy(`assign:${row.user.id}`)">Gán</UiButton>
        </form>
        <p v-else class="mt-2 text-xs text-ui-muted">Đã gán tất cả tòa nhà.</p>
      </section>

      <section aria-labelledby="user-danger-heading" class="rounded-lg border border-status-danger/30 p-3">
        <h3 id="user-danger-heading" class="text-xs font-semibold uppercase tracking-wide text-status-danger">Vùng nguy hiểm</h3>
        <template v-if="!confirmingDelete">
          <UiButton class="mt-2" size="sm" variant="ghost" @click="askDelete">Xoá người dùng</UiButton>
        </template>
        <div v-else class="mt-2 space-y-2">
          <p class="text-sm text-ui-primary">Xoá {{ displayName }} khỏi hệ thống? Hành động này sẽ thu hồi quyền đăng nhập của tài khoản và không thể hoàn tác.</p>
          <div class="flex justify-end gap-2">
            <UiButton ref="cancelDeleteRef" size="sm" variant="secondary" :disabled="isBusy(`delete:${row.user.id}`)" @click="confirmingDelete = false">Huỷ</UiButton>
            <UiButton size="sm" variant="danger" :loading="isBusy(`delete:${row.user.id}`)" @click="emit('remove', row.user.id)">Xoá vĩnh viễn</UiButton>
          </div>
        </div>
      </section>
    </div>
  </UiDrawer>
</template>
```

`UiButton` defaults to `type="button"` and passes `type="submit"` through, so the assign button submits the form and the form handler is the only emit path.

`UiDefinitionList` and `UiDefinitionItem` are globally registered in `tests/setup.ts`, so no stub is needed. Run → PASS.

- [ ] **Step 5: Page test**

Create `tests/pages/settings-users.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import Page from '~/pages/dashboard/settings/managers.vue'
import type { ManagedUserWithAssignments } from '~/types/users'

const user = (id: string, name: string, role: 'owner' | 'manager'): ManagedUserWithAssignments => ({
  user: { id, email: `${id}@zeno.test`, name, role, createdBy: null },
  assignments: [],
})

const users = ref<ManagedUserWithAssignments[]>([])
const api = {
  createUser: vi.fn(), updateUser: vi.fn(), deleteUser: vi.fn(), assign: vi.fn(), toggle: vi.fn(), unassign: vi.fn(),
}
const toast = { success: vi.fn(), error: vi.fn() }
const auth = { isAdmin: true, canCreateOwner: true, canManageUsers: true, role: 'admin' }

const drawerProps = ref<Record<string, unknown>>({})
const UserDetailDrawer = defineComponent({
  name: 'UserDetailDrawer',
  props: ['row', 'buildings', 'roleOptions', 'canEditRole', 'busyKey', 'editing'],
  emits: ['close', 'update', 'assign', 'toggleDelete', 'unassign', 'remove', 'update:editing'],
  setup(props) {
    return () => {
      drawerProps.value = { ...props }
      return h('div', { 'data-drawer': props.row ? (props.row as ManagedUserWithAssignments).user.id : '' })
    }
  },
})
const UserListRow = defineComponent({
  props: ['row', 'manageable'],
  emits: ['open'],
  setup: (props, { emit }) => () => h('div', {
    'data-row': (props.row as ManagedUserWithAssignments).user.id,
    'data-manageable': String(props.manageable),
    onClick: () => props.manageable && emit('open', (props.row as ManagedUserWithAssignments).user.id),
  }),
})

const stubs = {
  UiPageHeader: { template: '<header><slot /><slot name="actions" /></header>' },
  UiSearchInput: defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], setup: (_, { emit }) => () => h('input', { 'data-search': '', onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value) }) }),
  UiTabs: defineComponent({ props: ['modelValue', 'tabs'], emits: ['update:modelValue'], setup: (props, { emit }) => () => h('div', { 'data-tabs': '' }, (props.tabs as { key: string; label: string }[]).map(t => h('button', { 'data-tab': t.key, onClick: () => emit('update:modelValue', t.key) }, t.label))) }),
  UiAlert: true, UiSkeleton: true, UiEmptyState: { props: ['title'], template: '<p data-empty>{{ title }}</p>' }, IconPlus: true,
  UserCreateModal: true, UserDetailDrawer, UserListRow,
}

beforeEach(() => {
  vi.clearAllMocks()
  users.value = [user('o1', 'Bùi Văn Linh', 'owner'), user('m1', 'Trần Minh', 'manager')]
  Object.assign(auth, { isAdmin: true, canCreateOwner: true, role: 'admin' })
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useIntersectionObserver', vi.fn())
  vi.stubGlobal('useAppHeaderTitle', () => ref(null))
  vi.stubGlobal('useAuthStore', () => auth)
  vi.stubGlobal('useToast', () => toast)
  vi.stubGlobal('useManagerAssignments', () => ({
    users, buildings: ref([]), buildingsWithoutManager: ref([]), isLoading: ref(false), error: ref(null), refresh: vi.fn(), ...api,
  }))
})

const mountPage = async () => {
  const wrapper = mount(Page, { global: { stubs } })
  await flushPromises()
  return wrapper
}

describe('settings users page', () => {
  it('filters by search text and by role', async () => {
    const wrapper = await mountPage()

    await wrapper.get('[data-search]').setValue('minh')
    expect(wrapper.findAll('[data-row]').map(r => r.attributes('data-row'))).toEqual(['m1'])

    await wrapper.get('[data-search]').setValue('')
    await wrapper.get('[data-tab="owner"]').trigger('click')
    expect(wrapper.findAll('[data-row]').map(r => r.attributes('data-row'))).toEqual(['o1'])
  })

  it('shows a search empty state when nothing matches', async () => {
    const wrapper = await mountPage()
    await wrapper.get('[data-search]').setValue('không có ai')

    expect(wrapper.get('[data-empty]').text()).toBe('Không tìm thấy người dùng')
  })

  it('opens the drawer for the clicked user', async () => {
    const wrapper = await mountPage()
    await wrapper.get('[data-row="m1"]').trigger('click')

    expect(wrapper.get('[data-drawer]').attributes('data-drawer')).toBe('m1')
  })

  it('hides role tabs for owner and makes other owners non-manageable', async () => {
    Object.assign(auth, { isAdmin: false, canCreateOwner: false, role: 'owner' })
    const wrapper = await mountPage()

    expect(wrapper.find('[data-tabs]').exists()).toBe(false)
    expect(wrapper.get('[data-row="o1"]').attributes('data-manageable')).toBe('false')
    expect(wrapper.get('[data-row="m1"]').attributes('data-manageable')).toBe('true')
  })

  it('keeps the drawer open and toasts on a failed unassign', async () => {
    api.unassign.mockRejectedValueOnce(new Error('boom'))
    const wrapper = await mountPage()
    await wrapper.get('[data-row="m1"]').trigger('click')

    wrapper.findComponent({ name: 'UserDetailDrawer' }).vm.$emit('unassign', 'a1')
    await flushPromises()

    expect(toast.error).toHaveBeenCalledWith('Không thể bỏ gán khỏi tòa nhà.')
    expect(wrapper.get('[data-drawer]').attributes('data-drawer')).toBe('m1')
  })

  it('closes the drawer after a successful delete', async () => {
    api.deleteUser.mockImplementationOnce(async () => { users.value = users.value.filter(u => u.user.id !== 'm1') })
    const wrapper = await mountPage()
    await wrapper.get('[data-row="m1"]').trigger('click')

    wrapper.findComponent({ name: 'UserDetailDrawer' }).vm.$emit('remove', 'm1')
    await flushPromises()

    expect(toast.success).toHaveBeenCalledWith('Đã xoá người dùng.')
    expect(wrapper.get('[data-drawer]').attributes('data-drawer')).toBe('')
  })
})
```

Run: `npx vitest run tests/pages/settings-users.test.ts` → FAIL (old page).

- [ ] **Step 6: Rewrite the page**

Replace the whole of `app/pages/dashboard/settings/managers.vue` with:

```vue
<script setup lang="ts">
import type { UiTabItem } from '~/components/ui/UiTabs.vue'
import type { ManagedUserWithAssignments } from '~/types/users'
import { ROLES, type CreatableRole } from '~/utils/constants/roles'
import type { UserCreateInput, UserUpdateInput } from '~/utils/validators/users'
import { getApiErrorMessage } from '~/utils/api-error'

definePageMeta({
  middleware: () => {
    const authStore = useAuthStore()
    if (!authStore.canManageUsers) return navigateTo('/dashboard')
  },
})

// Mobile large-title collapse: fades into the persistent app header once scrolled past.
const titleSentinel = ref<HTMLElement | null>(null)
const isTitleCollapsed = ref(false)
useIntersectionObserver(titleSentinel, ([entry]) => {
  isTitleCollapsed.value = !!entry && !entry.isIntersecting
})
const headerTitle = useAppHeaderTitle()
const compactTitle = computed(() => (isTitleCollapsed.value ? 'Người dùng' : null))
watchEffect(() => {
  headerTitle.value = compactTitle.value
})
onBeforeUnmount(() => {
  if (headerTitle.value === compactTitle.value) headerTitle.value = null
})

const authStore = useAuthStore()
const toast = useToast()
const {
  users,
  buildings,
  buildingsWithoutManager,
  isLoading,
  error,
  refresh,
  createUser,
  updateUser,
  deleteUser,
  assign,
  toggle,
  unassign,
} = useManagerAssignments()

const roleOptions = computed(() => {
  const options: { value: CreatableRole; label: string }[] = [{ value: ROLES.MANAGER, label: 'Quản lý' }]
  if (authStore.canCreateOwner) options.unshift({ value: ROLES.OWNER, label: 'Chủ nhà' })
  return options
})
const defaultRole = computed<CreatableRole>(() => (authStore.canCreateOwner ? ROLES.OWNER : ROLES.MANAGER))
const buildingChoices = computed(() => buildings.value.map(b => ({ id: b.id, name: b.name })))

// Owners manage only managers; admins manage everyone shown.
function canManageRow(row: ManagedUserWithAssignments): boolean {
  return authStore.isAdmin || row.user.role === ROLES.MANAGER
}

// List filtering ----------------------------------------------------------------
const query = ref('')
const roleFilter = ref('all')
const roleTabs = computed<UiTabItem[]>(() => [
  { key: 'all', label: 'Tất cả', count: users.value.length },
  { key: ROLES.OWNER, label: 'Chủ nhà', count: users.value.filter(r => r.user.role === ROLES.OWNER).length },
  { key: ROLES.MANAGER, label: 'Quản lý', count: users.value.filter(r => r.user.role === ROLES.MANAGER).length },
])
const filteredUsers = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('vi')
  return users.value.filter(row =>
    (roleFilter.value === 'all' || row.user.role === roleFilter.value)
    && (!needle || [row.user.name, row.user.email].some(value => value?.toLocaleLowerCase('vi').includes(needle))),
  )
})

// Create ----------------------------------------------------------------------
const createOpen = ref(false)
const createBusy = ref(false)

async function handleCreate(payload: UserCreateInput) {
  createBusy.value = true
  try {
    await createUser(payload)
    createOpen.value = false
    toast.success('Đã tạo người dùng. Hãy gửi email và mật khẩu cho họ.')
  }
  catch (err: unknown) {
    toast.error(getApiErrorMessage(err, 'Không thể tạo người dùng.'))
  }
  finally {
    createBusy.value = false
  }
}

// Drawer ----------------------------------------------------------------------
const selectedUserId = ref<string | null>(null)
const selectedRow = computed(() => users.value.find(row => row.user.id === selectedUserId.value) ?? null)
const editing = ref(false)
const busyKey = ref<string | null>(null)

async function run(key: string, action: () => Promise<unknown>, success: string, failure: string): Promise<boolean> {
  busyKey.value = key
  try {
    await action()
    toast.success(success)
    return true
  }
  catch (err: unknown) {
    toast.error(getApiErrorMessage(err, failure))
    return false
  }
  finally {
    busyKey.value = null
  }
}

async function handleUpdate(id: string, payload: UserUpdateInput) {
  if (await run(`update:${id}`, () => updateUser(id, payload), 'Đã cập nhật người dùng.', 'Không thể cập nhật người dùng.')) {
    editing.value = false
  }
}

function handleAssign(userId: string, buildingId: string) {
  void run(`assign:${userId}`, () => assign({ user_id: userId, building_id: buildingId }), 'Đã gán vào tòa nhà.', 'Không thể gán vào tòa nhà.')
}

function handleToggle(assignmentId: string, value: boolean) {
  void run(`toggle:${assignmentId}`, () => toggle(assignmentId, { can_delete_master_data: value }), 'Đã cập nhật quyền xoá dữ liệu.', 'Không thể cập nhật quyền xoá dữ liệu.')
}

function handleUnassign(assignmentId: string) {
  void run(`unassign:${assignmentId}`, () => unassign(assignmentId), 'Đã bỏ gán khỏi tòa nhà.', 'Không thể bỏ gán khỏi tòa nhà.')
}

async function handleRemove(id: string) {
  if (await run(`delete:${id}`, () => deleteUser(id), 'Đã xoá người dùng.', 'Không thể xoá người dùng.')) {
    selectedUserId.value = null
  }
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Người dùng"
      :description="authStore.isAdmin
        ? 'Chủ nhà và quản lý, phạm vi theo tòa nhà và quyền xoá dữ liệu.'
        : 'Quản lý trong phạm vi tòa nhà của bạn.'"
      back-to="/dashboard/settings"
      back-mobile-only
      :reserve-global-actions="false"
    >
      <div ref="titleSentinel" aria-hidden="true" />
      <template #actions>
        <UiButton @click="createOpen = true">
          <IconPlus class="h-4 w-4" aria-hidden="true" />
          Thêm người dùng
        </UiButton>
      </template>
    </UiPageHeader>

    <UiAlert
      v-if="buildingsWithoutManager.length > 0"
      class="mb-4"
      severity="warning"
      :title="`${buildingsWithoutManager.length} tòa nhà chưa có quản lý`"
    >
      {{ buildingsWithoutManager.map(building => building.name).join(', ') }}
    </UiAlert>

    <div v-if="users.length > 0" class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <UiSearchInput
        v-model="query"
        placeholder="Tìm theo tên hoặc email"
        aria-label="Tìm người dùng"
        density="normal"
        class="sm:max-w-xs sm:flex-1"
      />
      <UiTabs v-if="authStore.isAdmin" v-model="roleFilter" :tabs="roleTabs" variant="segmented" />
    </div>

    <UiAlert v-if="error" severity="danger" title="Không tải được danh sách người dùng">
      <p>{{ getApiErrorMessage(error, 'Hãy thử lại sau.') }}</p>
      <UiButton class="mt-2" size="sm" variant="secondary" @click="refresh()">Thử lại</UiButton>
    </UiAlert>

    <div v-else-if="isLoading" class="space-y-2">
      <UiSkeleton v-for="i in 4" :key="i" class="h-14 w-full" />
    </div>

    <UiEmptyState
      v-else-if="users.length === 0"
      title="Chưa có người dùng nào"
      description="Thêm chủ nhà hoặc quản lý để bắt đầu phân quyền tòa nhà."
    />

    <UiEmptyState
      v-else-if="filteredUsers.length === 0"
      variant="search"
      title="Không tìm thấy người dùng"
      description="Thử từ khoá khác hoặc bỏ bộ lọc vai trò."
    />

    <ul
      v-else
      role="list"
      class="-mx-4 divide-y divide-ui-border border-y border-ui-border bg-ui-surface sm:mx-0 sm:overflow-hidden sm:rounded-lg sm:border"
    >
      <li v-for="row in filteredUsers" :key="row.user.id">
        <UserListRow :row="row" :manageable="canManageRow(row)" @open="selectedUserId = $event" />
      </li>
    </ul>

    <UserCreateModal
      :open="createOpen"
      :buildings="buildingChoices"
      :role-options="roleOptions"
      :default-role="defaultRole"
      :busy="createBusy"
      @close="createOpen = false"
      @submit="handleCreate"
    />

    <UserDetailDrawer
      v-model:editing="editing"
      :row="selectedRow"
      :buildings="buildingChoices"
      :role-options="roleOptions"
      :can-edit-role="authStore.isAdmin"
      :busy-key="busyKey"
      @close="selectedUserId = null"
      @update="handleUpdate"
      @assign="handleAssign"
      @toggle-delete="handleToggle"
      @unassign="handleUnassign"
      @remove="handleRemove"
    />
  </div>
</template>
```

Check that `UiTabItem` is exported from `UiTabs.vue` (it is: `export interface UiTabItem`). If importing a type from an SFC fails typecheck, move nothing; use `import type { UiTabItem } from '~/components/ui/UiTabs.vue'` exactly as other pages import `UiTableColumn`.

- [ ] **Step 7: Run tests and lint**

Run: `npx vitest run tests/utils/users-display.test.ts tests/components/users tests/pages/settings-users.test.ts`
Expected: PASS. Then `npx eslint app/components/users app/pages/dashboard/settings/managers.vue app/utils/users`.

- [ ] **Step 8: Browser check**

At 390px and 1280px, light and dark, as admin then owner:
- The first screen shows the list (no form); "Thêm người dùng" opens the modal; a validation error stays inside the modal; a success closes it and adds the row.
- Clicking a row opens the drawer (bottom sheet on mobile). Toggle, assign, unassign each show a toast and update both the drawer and the row count. Edit inline, save, see it close; failure keeps the form.
- Delete asks for the second step, focus lands on "Huỷ", confirm closes the drawer.
- Owner: no role tabs; other owners' rows have no chevron and do nothing.
- Keyboard: Tab reaches each row; Enter opens; Escape closes and returns focus to the row.

- [ ] **Step 9: Commit**

```bash
git add app/utils/users app/components/users app/pages/dashboard/settings/managers.vue tests/utils/users-display.test.ts tests/components/users tests/pages/settings-users.test.ts
git commit -m "feat(settings): rebuild users page with list and detail drawer"
```

---

### Task 8: Tenant accounts polish

**Files:**
- Modify: `app/pages/dashboard/settings/tenant-accounts.vue`
- Test: `tests/pages/settings-tenant-accounts.test.ts`

- [ ] **Step 1: Failing test**

Create `tests/pages/settings-tenant-accounts.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import Page from '~/pages/dashboard/settings/tenant-accounts.vue'

const accounts = ref([
  { tenantId: 't1', tenantName: 'Hoàng Lam Thi', tenantCode: 'hlt-2026-0001', email: 'thyy1280@gmail.com', health: 'linked', status: 'active' },
  { tenantId: 't2', tenantName: 'Nguyễn Tuấn Anh', tenantCode: 'nta-2026-0001', email: 'tuan.anh@gmail.com', health: 'linked', status: 'active' },
])
const orphans = ref<unknown[]>([])
const setStatus = vi.fn()
const toast = { success: vi.fn(), error: vi.fn() }

const UiTable = defineComponent({
  props: ['rows', 'emptyTitle'],
  setup: (props, { slots }) => () => h('div', [
    ...(props.rows as Record<string, unknown>[]).map(row => h('div', { 'data-row': row.tenantId }, [slots['cell-tenant']?.({ row }), slots['cell-actions']?.({ row })])),
    (props.rows as unknown[]).length === 0 ? h('p', { 'data-empty': '' }, props.emptyTitle as string) : null,
  ]),
})

const stubs = {
  UiPageHeader: { template: '<header><slot /><slot name="actions" /></header>' },
  UiTable,
  UiSearchInput: defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], setup: (_, { emit }) => () => h('input', { 'data-search': '', onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value) }) }),
  UiDropdownMenu: { template: '<div data-menu><slot /></div>' },
  UiDropdownMenuItem: defineComponent({ emits: ['click'], setup: (_, { slots, emit }) => () => h('button', { 'data-item': '', onClick: () => emit('click') }, slots.default?.()) }),
  UiStatusBadge: true, UiAlert: true, UiSkeleton: true, UiEmptyState: true, UiModal: true, UiConfirmModal: true, UiCombobox: true, UiInput: true,
  IconPlus: true, IconCheckCircle: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  orphans.value = []
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useIntersectionObserver', vi.fn())
  vi.stubGlobal('useAppHeaderTitle', () => ref(null))
  vi.stubGlobal('useToast', () => toast)
  vi.stubGlobal('useAuthStore', () => ({ can: () => true }))
  vi.stubGlobal('useTenantAccounts', () => ({
    accounts, status: ref('success'), error: ref(null), orphans, orphansLoading: ref(false), orphansError: ref(null),
    loadOrphans: vi.fn(), provision: vi.fn(), setStatus, resetPassword: vi.fn(), revoke: vi.fn(), reconcileOrphan: vi.fn(),
  }))
})

const mountPage = async () => {
  const wrapper = mount(Page, { global: { stubs } })
  await flushPromises()
  return wrapper
}

describe('tenant accounts page', () => {
  it('filters by name, code or email', async () => {
    const wrapper = await mountPage()
    await wrapper.get('[data-search]').setValue('nta-2026')

    expect(wrapper.findAll('[data-row]').map(r => r.attributes('data-row'))).toEqual(['t2'])
    await wrapper.get('[data-search]').setValue('zzz')
    expect(wrapper.get('[data-empty]').text()).toBe('Không tìm thấy tài khoản')
  })

  it('puts every row action in the menu with the agreed wording', async () => {
    const wrapper = await mountPage()
    const items = wrapper.get('[data-row="t1"]').findAll('[data-item]').map(i => i.text())

    expect(items).toEqual(['Khoá', 'Đặt lại mật khẩu', 'Gỡ quyền truy cập'])
  })

  it('uses a specific fallback when locking fails', async () => {
    setStatus.mockRejectedValueOnce(new Error())
    const wrapper = await mountPage()
    await wrapper.get('[data-row="t1"]').findAll('[data-item]')[0]!.trigger('click')
    await flushPromises()

    expect(toast.error).toHaveBeenCalledWith('Không thể khoá tài khoản.')
  })

  it('collapses a clean orphan check into one status line', async () => {
    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('Không có tài khoản Auth mồ côi')
    expect(wrapper.text()).not.toContain('Mọi tài khoản tenant hiện có đều đang được liên kết')
  })
})
```

Run → FAIL.

- [ ] **Step 2: Implement**

In `app/pages/dashboard/settings/tenant-accounts.vue`:

1. In `<script setup>` after `const canReconcileOrphans = ...` add:

```ts
const query = ref('')
const filteredAccounts = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('vi')
  if (!needle) return accounts.value
  return accounts.value.filter(account =>
    [account.tenantName, account.tenantCode, account.email].some(value => value?.toLocaleLowerCase('vi').includes(needle)),
  )
})
```

2. Change the actions column to `{ key: 'actions', action: true, width: 'w-14' }`.

3. In `toggleStatus` catch: `toast.error(getApiErrorMessage(e, item.status === 'active' ? 'Không thể khoá tài khoản.' : 'Không thể mở lại tài khoản.'))`. In `confirmReset` catch: `toast.error(getApiErrorMessage(e, 'Không thể đặt lại mật khẩu.'))`. In `confirmRevoke` catch: `toast.error(getApiErrorMessage(e, 'Không thể gỡ quyền truy cập.'))`. Success toast for locking: `'Đã khoá tài khoản.'`.

4. In the template, insert before the `UiAlert v-if="error"`:

```vue
    <UiSearchInput
      v-if="accounts.length > 0"
      v-model="query"
      placeholder="Tìm theo tên, mã hoặc email"
      aria-label="Tìm tài khoản người thuê"
      density="normal"
      class="mb-4 sm:max-w-sm"
    />
```

5. On `UiTable`: `:rows="filteredAccounts"`, `:empty-title="query ? 'Không tìm thấy tài khoản' : 'Chưa có tài khoản nào'"`, `:empty-description="query ? 'Thử tên, mã hoặc email khác.' : 'Nhấn “Cấp tài khoản” để tạo tài khoản portal cho một khách thuê.'"`.

6. Replace `#cell-tenant` with:

```vue
      <template #cell-tenant="{ row }">
        <div class="min-w-0">
          <p class="break-words font-medium text-ui-primary">{{ row.tenantName }}</p>
          <p class="text-xs text-ui-muted">{{ row.tenantCode }}</p>
          <p class="mt-1 break-all text-xs text-ui-muted md:hidden">{{ row.email ?? 'Không có email Auth' }}</p>
        </div>
      </template>
```

7. Replace the whole `#cell-actions` template with:

```vue
      <template #cell-actions="{ row }">
        <UiDropdownMenu class="ml-auto" trigger-class="min-h-11 min-w-11 md:min-h-9 md:min-w-9" :aria-label="`Thao tác cho ${row.tenantName}`">
          <UiDropdownMenuItem
            :disabled="row.health !== 'linked' || busyTenantId === row.tenantId"
            :loading="busyTenantId === row.tenantId"
            @click="toggleStatus(row)"
          >
            {{ row.status === 'active' ? 'Khoá' : 'Mở lại' }}
          </UiDropdownMenuItem>
          <UiDropdownMenuItem :disabled="row.health !== 'linked'" @click="resetTarget = row">
            Đặt lại mật khẩu
          </UiDropdownMenuItem>
          <UiDropdownMenuItem variant="danger" @click="revokeTarget = row">
            {{ row.health === 'missing_auth' ? 'Dọn liên kết' : 'Gỡ quyền truy cập' }}
          </UiDropdownMenuItem>
        </UiDropdownMenu>
      </template>
```

8. Replace the whole orphan `<section>` with:

```vue
    <section v-if="canReconcileOrphans" class="mt-8 space-y-3" aria-label="Tài khoản Auth mồ côi">
      <UiAlert v-if="orphansError" severity="danger" title="Không thể kiểm tra tài khoản mồ côi">
        <p>{{ getApiErrorMessage(orphansError, 'Hãy thử lại sau.') }}</p>
        <UiButton class="mt-2" variant="secondary" size="sm" :loading="orphansLoading" @click="loadOrphans">Kiểm tra lại</UiButton>
      </UiAlert>
      <UiSkeleton v-else-if="orphansLoading && orphans.length === 0" class="h-12 w-full" />
      <div v-else-if="orphans.length === 0" class="flex items-center gap-3 rounded-lg border border-ui-border px-4 py-3">
        <IconCheckCircle class="h-4 w-4 shrink-0 text-status-success" aria-hidden="true" />
        <p class="min-w-0 flex-1 text-sm text-ui-muted">Không có tài khoản Auth mồ côi</p>
        <UiButton variant="secondary" size="sm" :loading="orphansLoading" @click="loadOrphans">Kiểm tra lại</UiButton>
      </div>
      <template v-else>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="text-sm font-semibold text-ui-primary">{{ orphans.length }} tài khoản Auth mồ côi</h2>
            <p class="mt-1 text-sm text-ui-muted">Tài khoản mang vai trò người thuê nhưng không còn liên kết tới hồ sơ người thuê.</p>
          </div>
          <UiButton variant="secondary" size="sm" :loading="orphansLoading" @click="loadOrphans">Kiểm tra lại</UiButton>
        </div>
        <!-- keep the existing orphan <article> list block here unchanged -->
      </template>
    </section>
```

Move the existing `<div v-else class="-mx-4 space-y-2 sm:mx-0"> ... </div>` orphan list into the marked spot, changing its `v-else` to nothing (it is now inside the `template v-else`).

9. Revoke confirm: title `Gỡ quyền truy cập`, confirm-label `Gỡ quyền truy cập`.

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/pages/settings-tenant-accounts.test.ts tests/pages/tenant-authorization-ui.spec.ts tests/pages/tenant-account-roommate-ui.spec.ts`
Expected: PASS. (`getApiErrorMessage` reads only `data.error.message`, so a plain `Error` yields the fallback.)

- [ ] **Step 4: Overflow check in the browser**

At 320px and 390px open `/dashboard/settings/tenant-accounts` and run in the page:

```js
[...document.querySelectorAll('#main-content *')].filter(el => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible').map(el => el.className)
```

Expected: an empty array, and the ⋯ button fully visible. If the table wrapper still scrolls, reduce the `health` cell to the badge only and confirm `UiTable` cells do not set `whitespace-nowrap` on the tenant column; fix in the page, not in `UiTable`.

- [ ] **Step 5: Commit**

```bash
git add app/pages/dashboard/settings/tenant-accounts.vue tests/pages/settings-tenant-accounts.test.ts
git commit -m "feat(settings): polish tenant accounts list and orphan check"
```

---

### Task 9: Access requests polish

**Files:**
- Modify: `app/pages/dashboard/settings/access-requests.vue`
- Test: `tests/pages/access-request-approval-search.spec.ts` (extend)

- [ ] **Step 1: Failing source-contract test**

Append to `tests/pages/access-request-approval-search.spec.ts` (it already reads the page source into `page`):

```ts
describe('access requests polish', () => {
  it('titles the page like the nav item and filters with tabs', () => {
    expect(page).toContain('title="Yêu cầu truy cập"')
    expect(page).not.toContain('Yêu cầu tài khoản')
    expect(page).toContain('<UiTabs')
    expect(page).not.toContain('label="Trạng thái" :options="statusOptions"')
  })

  it('uses product role names and huỷ spelling', () => {
    expect(page).toContain("{ value: 'owner', label: 'Chủ nhà' }")
    expect(page).toContain("{ value: 'manager', label: 'Quản lý' }")
    expect(page).toContain("{ value: 'tenant', label: 'Người thuê' }")
    expect(page).not.toContain('Hủy')
  })
})
```

If `describe` is not imported in that file, add it to the existing `vitest` import. Run → FAIL.

- [ ] **Step 2: Implement**

In `app/pages/dashboard/settings/access-requests.vue`:

1. Compact title `'Yêu cầu tài khoản'` → `'Yêu cầu truy cập'`; `UiPageHeader` title `Yêu cầu truy cập`, description `Duyệt danh tính mới, gán vai trò và phạm vi trước khi họ vào hệ thống.`; remove the `#actions` slot with the `UiSelect`.
2. `roleOptions` labels: `Chủ nhà`, `Quản lý`, `Người thuê`.
3. Add after `statusOptions`:

```ts
const pendingCount = useAccessRequestPendingCount(true)
const statusTabs = computed<UiTabItem[]>(() => statusOptions.map(option => ({
  key: option.value,
  label: option.label,
  count: option.value === 'pending' && pendingCount.value ? pendingCount.value : undefined,
})))

function roleLabel(role: string | null | undefined) {
  return roleOptions.find(option => option.value === role)?.label ?? '—'
}
```

and add `import type { UiTabItem } from '~/components/ui/UiTabs.vue'`.

4. Insert below the header:

```vue
    <UiTabs
      class="mb-4"
      :model-value="selectedStatus"
      :tabs="statusTabs"
      variant="segmented"
      @update:model-value="selectedStatus = $event as AccessRequestStatus"
    />
```

5. In `#cell-identity` delete the `<p v-if="!row.emailVerified" ...>` line.
6. Replace `#cell-actions` with:

```vue
      <template #cell-actions="{ row }">
        <div v-if="row.status === 'pending' || row.status === 'processing'" class="flex justify-end gap-2">
          <UiBadge v-if="!row.emailVerified" variant="warning">Chưa xác minh email</UiBadge>
          <template v-else>
            <UiButton v-if="row.status === 'pending'" size="sm" variant="ghost" @click="openRejection(row)">Từ chối</UiButton>
            <UiButton size="sm" @click="openApproval(row)">{{ row.status === 'processing' ? 'Tiếp tục' : 'Duyệt' }}</UiButton>
          </template>
        </div>
        <span v-else class="block text-right text-xs text-ui-muted">{{ roleLabel(row.decisionRole) }}</span>
      </template>
```

7. Replace every `Hủy` with `Huỷ`.

- [ ] **Step 3: Run tests, browser check, commit**

Run: `npx vitest run tests/pages/access-request-approval-search.spec.ts`
Expected: PASS.

Browser at 390px and 1280px: tabs scroll on mobile as a segmented pill, pending count shows; approving updates the nav badge.

```bash
git add app/pages/dashboard/settings/access-requests.vue tests/pages/access-request-approval-search.spec.ts
git commit -m "feat(settings): polish access request queue"
```

---

### Task 10: Activity log sentences

**Files:**
- Modify: `app/utils/audit/display.ts`, `app/pages/dashboard/settings/history.vue`
- Test: `tests/utils/audit-display.test.ts`, `tests/pages/settings-history.test.ts`

**Interfaces:**
- Produces: `auditEventSentence(event): { verb: string; entityNoun: string | null; subject: string | null; detail: string | null }`.

- [ ] **Step 1: Failing unit tests**

Append to `tests/utils/audit-display.test.ts` (add `auditEventSentence` to its import from `~/utils/audit/display` or the relative path it already uses):

```ts
describe('auditEventSentence', () => {
  const base = { entityId: 'e1', beforeData: null, afterData: null, entitySubLabel: null }

  it('drops the entity noun when the verb already names it', () => {
    expect(auditEventSentence({ ...base, action: 'reserve_fund.accrual_refreshed', entityType: 'reserve_fund', entityLabel: 'Quỹ tòa A' }))
      .toEqual({ verb: 'cập nhật quỹ dự phòng', entityNoun: null, subject: 'Quỹ tòa A', detail: null })
    expect(auditEventSentence({ ...base, action: 'contract.document.issued', entityType: 'contract', entityLabel: 'HD-0012' }).entityNoun).toBeNull()
    expect(auditEventSentence({ ...base, action: 'building.visibility_changed', entityType: 'building', entityLabel: 'Zeno' }).entityNoun).toBeNull()
  })

  it('keeps the entity noun for generic verbs', () => {
    expect(auditEventSentence({ ...base, action: 'room.updated', entityType: 'room', entityLabel: 'P101' }))
      .toEqual({ verb: 'cập nhật', entityNoun: 'phòng', subject: 'P101', detail: null })
  })

  it('hides technical keys and duplicated sub-labels', () => {
    expect(auditEventSentence({ ...base, action: 'building_service.updated', entityType: 'building_service', entityLabel: 'water_input', entitySubLabel: 'water_input' }))
      .toMatchObject({ subject: null, detail: null })
    expect(auditEventSentence({ ...base, action: 'room.updated', entityType: 'room', entityLabel: 'P101', entitySubLabel: 'P101' }).detail).toBeNull()
    expect(auditEventSentence({ ...base, action: 'room.updated', entityType: 'room', entityLabel: 'P101', entitySubLabel: 'Tòa A' }).detail).toBe('Tòa A')
  })
})

it('spells action labels with xoá and tòa', () => {
  expect(auditActionLabel('building.removed')).toBe('Xoá')
  expect(auditActionLabel('building.visibility_changed')).toBe('Đổi hiển thị tòa nhà')
})
```

Run → FAIL.

- [ ] **Step 2: Implement in `display.ts`**

- In `ACTION_SUFFIX_LABELS`: `removed: 'Xoá'`, `deleted: 'Xoá'`, `refreshed: 'Làm mới'`.
- In `ACTION_LABELS`: `'reserve_fund.accrual_refreshed': 'Cập nhật quỹ dự phòng'`, `'building.visibility_changed': 'Đổi hiển thị tòa nhà'`, `'building.contract_profile.updated': 'Cập nhật thông tin hợp đồng của tòa nhà'`, `'building_expense.receipt_removed': 'Xoá biên lai'`, `'contract_amendment.draft_removed': 'Xoá phụ lục nháp'`.
- Append:

```ts
const TECHNICAL_KEY_RE = /^[a-z0-9]+(?:_[a-z0-9]+)+$/

function comparable(text: string): string {
  return text.toLocaleLowerCase('vi').replaceAll('toà', 'tòa')
}

export interface AuditEventSentence {
  verb: string
  entityNoun: string | null
  subject: string | null
  detail: string | null
}

/** Readable parts of an activity line, without repeating the noun or leaking technical keys. */
export function auditEventSentence(
  event: Pick<AuditEvent, 'action' | 'entityType' | 'entityLabel' | 'entitySubLabel' | 'entityId' | 'beforeData' | 'afterData'>,
): AuditEventSentence {
  const verb = auditActionLabel(event.action).toLocaleLowerCase('vi')
  const noun = auditEntityLabel(event.entityType)
  const display = auditEntityDisplay(event)
  const sub = event.entitySubLabel?.trim() || null
  return {
    verb,
    entityNoun: comparable(verb).includes(comparable(noun)) ? null : noun.toLocaleLowerCase('vi'),
    subject: TECHNICAL_KEY_RE.test(display) ? null : display,
    detail: sub && sub !== display && !TECHNICAL_KEY_RE.test(sub) ? sub : null,
  }
}
```

Run: `npx vitest run tests/utils/audit-display.test.ts` → PASS. If the existing "Vietnamese display label for every declared audit action" test now fails for `refreshed`, it is because a declared action ends in `.refreshed`; that label is now `Làm mới`, which still differs from the raw suffix, so it should pass.

- [ ] **Step 3: Update the page and its contract test**

In `tests/pages/settings-history.test.ts` replace `expect(page).toContain('auditActionLabel')` and `expect(page).toContain('auditEntityDisplay')` with:

```ts
    expect(page).toContain('auditEventSentence')
    expect(page).not.toContain('<UiBadge :variant="auditActionVariant')
```

In `app/pages/dashboard/settings/history.vue`:
- Imports: remove `auditActionLabel`, `auditActionVariant`, `auditEntityDisplay`, `auditEntityLabel`; add `auditEventSentence`.
- `UiPageHeader` description: `Ai đã làm gì, ở tòa nhà nào.`
- `UiFilterResetButton` label `Xoá lọc`; empty-state description `Khi có thao tác tạo, cập nhật hoặc xoá, nhật ký sẽ hiện ở đây.`
- Replace the sentence `<div class="flex flex-wrap items-center gap-2"> ... </div>` block (the one containing the action/entity spans, the `UiBadge` and the `bulk` chip) with:

```vue
                <p class="text-sm text-ui-primary">
                  <span :class="{ italic: actorDisplay(event).isSystem }" class="font-medium" :title="actorDisplay(event).secondary ?? undefined">{{ actorDisplay(event).primary }}</span>
                  <span class="text-ui-muted"> {{ auditEventSentence(event).verb }}<template v-if="auditEventSentence(event).entityNoun"> {{ auditEventSentence(event).entityNoun }}</template></span>
                  <span v-if="auditEventSentence(event).subject" class="font-semibold"> {{ auditEventSentence(event).subject }}</span>
                  <span v-if="auditEventSentence(event).detail" class="text-xs text-ui-muted"> · {{ auditEventSentence(event).detail }}</span>
                  <span v-if="event.correlationId" class="ml-1 rounded-full bg-ui-surface px-1.5 py-0.5 text-[10px] font-medium text-ui-muted">hàng loạt</span>
                </p>
```

- Delete the following actor `<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ui-muted"> ... </div>` block (the actor now leads the sentence).

Run: `npx vitest run tests/utils/audit-display.test.ts tests/pages/settings-history.test.ts` → PASS.

- [ ] **Step 4: Browser check and commit**

At 390px and 1280px: lines read "Tùng Nguyễn cập nhật quỹ dự phòng …", no doubled nouns, no snake_case keys, timestamps not clipped.

```bash
git add app/utils/audit/display.ts app/pages/dashboard/settings/history.vue tests/utils/audit-display.test.ts tests/pages/settings-history.test.ts
git commit -m "feat(settings): readable activity log sentences"
```

---

### Task 11: Building visibility, profile and security polish

**Files:**
- Modify: `app/pages/dashboard/settings/buildings.vue`, `app/pages/dashboard/settings/profile.vue`, `app/pages/dashboard/settings/security.vue`
- Test: `tests/pages/settings-profile.test.ts`

- [ ] **Step 1: Failing profile test**

Create `tests/pages/settings-profile.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import Page from '~/pages/dashboard/settings/profile.vue'

const profile = ref({ id: 'u', email: 'me@zeno.test', fullName: 'Tùng Nguyễn Thanh', avatarUrl: null, hasCustomAvatar: true, role: 'admin' })
const removeAvatar = vi.fn()
const toast = { success: vi.fn(), error: vi.fn() }

const stubs = {
  UiPageHeader: { template: '<header><slot /></header>' },
  UiSkeleton: true, UiAlert: true, UiSurfacePanel: { template: '<div><slot /></div>' }, UiSection: { template: '<div><slot /></div>' },
  UiInput: true,
  UiButton: defineComponent({ emits: ['click'], setup: (_, { slots, emit }) => () => h('button', { onClick: () => emit('click') }, slots.default?.()) }),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('useIntersectionObserver', vi.fn())
  vi.stubGlobal('useAppHeaderTitle', () => ref(null))
  vi.stubGlobal('useToast', () => toast)
  vi.stubGlobal('useUserProfile', () => ({
    profile, status: ref('success'), error: ref(null), refresh: vi.fn(), saving: ref(false), uploadingAvatar: ref(false),
    fieldErrors: ref({}), updateFullName: vi.fn(), uploadAvatar: vi.fn(), removeAvatar,
  }))
})

describe('settings profile', () => {
  it('shows email and role as read-only text, not disabled inputs', async () => {
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    expect(wrapper.find('dl').text()).toContain('me@zeno.test')
    expect(wrapper.find('dl').text()).toContain('Quản trị viên')
  })

  it('reports a failed avatar removal', async () => {
    removeAvatar.mockResolvedValueOnce(false)
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    await wrapper.findAll('button').find(b => b.text() === 'Xoá ảnh')!.trigger('click')
    await flushPromises()
    expect(toast.error).toHaveBeenCalledWith('Không thể xoá ảnh đại diện.')
  })

  it('no longer links to a separate password page', async () => {
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('Đổi mật khẩu')
  })
})
```

Run → FAIL.

- [ ] **Step 2: Profile page**

In `app/pages/dashboard/settings/profile.vue`:

1. Script additions:

```ts
import { useDropZone, useFileDialog } from '@vueuse/core'
import { userAvatarUploadSchema } from '~/utils/validators/users'
import { managedRoleLabel } from '~/utils/users/display'
```

Replace `roleLabel` with `const roleLabel = computed(() => managedRoleLabel(profile.value?.role ?? null))`.

Add:

```ts
const avatarDropZone = ref<HTMLElement | null>(null)

function acceptAvatar(file: File | undefined) {
  if (!file) return
  if (!userAvatarUploadSchema.safeParse({ mimeType: file.type, size: file.size }).success) {
    toast.error('Ảnh phải là JPEG, PNG hoặc WebP và không quá 2 MB.')
    return
  }
  void onAvatarSelect(file)
}

const { open: openAvatarDialog, onChange: onAvatarDialogChange, reset: resetAvatarDialog } = useFileDialog({ multiple: false, accept: 'image/jpeg,image/png,image/webp' })
onAvatarDialogChange((files) => {
  acceptAvatar(files?.[0])
  resetAvatarDialog()
})
const { isOverDropZone } = useDropZone(avatarDropZone, { onDrop: files => acceptAvatar(files?.[0]) })
```

Change `onAvatarRemove`:

```ts
async function onAvatarRemove() {
  const ok = await removeAvatar()
  if (ok) toast.success('Đã xoá ảnh đại diện.')
  else toast.error('Không thể xoá ảnh đại diện.')
}
```

2. Replace the avatar `UiSurfacePanel` with:

```vue
      <section
        ref="avatarDropZone"
        aria-labelledby="avatar-heading"
        class="flex flex-wrap items-center gap-4 rounded-lg border p-4 transition-colors"
        :class="isOverDropZone ? 'border-ui-accent/60 bg-ui-accent/5' : 'border-ui-border bg-ui-surface'"
      >
        <img
          v-if="profile.avatarUrl"
          :src="profile.avatarUrl"
          alt="Ảnh đại diện hiện tại"
          class="h-14 w-14 shrink-0 rounded-full object-cover"
        >
        <span
          v-else
          class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ui-accent/20 text-lg font-semibold text-ui-accent"
          aria-hidden="true"
        >
          {{ (profile.fullName ?? profile.email ?? 'U').charAt(0).toUpperCase() }}
        </span>
        <div class="min-w-0 flex-1">
          <h2 id="avatar-heading" class="text-sm font-medium text-ui-primary">Ảnh đại diện</h2>
          <p class="text-xs text-ui-muted">JPEG, PNG hoặc WebP, tối đa 2 MB. Có thể kéo thả ảnh vào đây.</p>
        </div>
        <div class="flex shrink-0 gap-2">
          <UiButton size="sm" variant="secondary" :loading="uploadingAvatar" @click="openAvatarDialog()">
            {{ profile.hasCustomAvatar ? 'Đổi ảnh' : 'Tải ảnh lên' }}
          </UiButton>
          <UiButton v-if="profile.hasCustomAvatar" size="sm" variant="ghost" :disabled="uploadingAvatar" @click="onAvatarRemove">
            Xoá ảnh
          </UiButton>
        </div>
      </section>
```

3. In the personal info form, replace the two disabled `UiInput`s with:

```vue
            <UiDefinitionList>
              <UiDefinitionItem label="Email" :value="profile.email" />
              <UiDefinitionItem label="Vai trò" :value="roleLabel" />
            </UiDefinitionList>
```

Run: `npx vitest run tests/pages/settings-profile.test.ts` → PASS.

- [ ] **Step 3: Building visibility**

In `app/pages/dashboard/settings/buildings.vue`:
- Add `const visibleCount = computed(() => buildings.value.length - hiddenCount.value)`.
- `UiPageHeader` description: `Tòa nhà bị ẩn không xuất hiện trong danh sách và số liệu tổng hợp. Link trực tiếp vẫn mở được.`
- Replace `<UiFormSection v-else ...> <ul ...> ... </ul> </UiFormSection>` with:

```vue
    <div v-else>
      <p class="mb-2 text-xs text-ui-muted">{{ visibleCount }}/{{ buildings.length }} tòa nhà đang hiển thị</p>
      <ul role="list" class="-mx-4 divide-y divide-ui-border border-y border-ui-border bg-ui-surface sm:mx-0 sm:rounded-lg sm:border">
        <li
          v-for="building in buildings"
          :key="building.id"
          class="flex items-center justify-between gap-4 px-4 py-3"
        >
          <!-- keep the existing <div class="min-w-0"> … </div> and <UiToggle … /> unchanged -->
        </li>
      </ul>
    </div>
```

- [ ] **Step 4: Security page**

`settings/security.vue` already moved in Task 5. Confirm the form still resets and shows the toast without navigating, and that the page uses `UiSurfacePanel` at `max-w-2xl`. No further change.

- [ ] **Step 5: Browser check and commit**

At 390px and 1280px: avatar row wraps cleanly on 320px; drag an image onto the row uploads; invalid file shows the toast; email/role read as text; visibility list matches the other Settings lists.

```bash
git add app/pages/dashboard/settings/profile.vue app/pages/dashboard/settings/buildings.vue app/pages/dashboard/settings/security.vue tests/pages/settings-profile.test.ts
git commit -m "feat(settings): polish profile, security and building visibility"
```

---

### Task 12: Terminology guard and glossary

**Files:**
- Create: `tests/pages/settings-terminology.test.ts`
- Modify: any Settings file the guard flags; `docs/ui-patterns/design-system.md`

- [ ] **Step 1: Write the guard**

Create `tests/pages/settings-terminology.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SETTINGS_FILES = [
  ...readdirSync(resolve('app/pages/dashboard/settings')).map(f => join('app/pages/dashboard/settings', f)),
  'app/pages/dashboard/settings.vue',
  'app/components/app/AppSettingsNav.vue',
  ...readdirSync(resolve('app/components/users')).map(f => join('app/components/users', f)),
]

describe('settings terminology', () => {
  it.each(SETTINGS_FILES)('%s uses xoá, khoá, huỷ and tòa', (file) => {
    expect(readFileSync(resolve(file), 'utf8')).not.toMatch(/[Xx]óa|[Kk]hóa|[Hh]ủy|[Tt]oà/)
  })
})
```

Run: `npx vitest run tests/pages/settings-terminology.test.ts`.

- [ ] **Step 2: Fix every flagged file**

For each failing file run (macOS):

```bash
sed -i '' 's/xóa/xoá/g; s/Xóa/Xoá/g; s/khóa/khoá/g; s/Khóa/Khoá/g; s/hủy/huỷ/g; s/Hủy/Huỷ/g; s/toà/tòa/g; s/Toà/Tòa/g' <file>
```

Inspect `git diff` to confirm only those words changed ("vô hiệu hóa" stays). Re-run the guard → PASS.

- [ ] **Step 3: Glossary**

Append to `docs/ui-patterns/design-system.md`:

```markdown

## Settings terminology

| Term | Meaning | Use when |
| --- | --- | --- |
| Xoá | Delete a record or account permanently | Deleting a user, an avatar, a receipt |
| Bỏ gán | Remove a user from one building without deleting the user | Owner or manager building assignment |
| Gỡ quyền truy cập | Revoke a tenant's portal access | Tenant account revocation |
| Dọn liên kết | Clean up an orphaned account link | Orphaned tenant accounts |

Spelling inside the Settings area: "xoá", "khoá", "huỷ", "hoá đơn", "tòa nhà". Success toasts read "Đã <động từ> <đối tượng>."; failure toasts fall back to "Không thể <động từ> <đối tượng>.".
```

- [ ] **Step 4: Run and commit**

Run: `npx vitest run tests/pages` and `npm run knowledge:check`.

```bash
git add app tests docs/ui-patterns/design-system.md
git commit -m "docs(settings): settle terminology and guard it"
```

---

### Task 13: Verification and records

**Files:**
- Create: `docs/changes/settings-redesign/verification.md`
- Modify: `docs/changes/settings-redesign/index.md`, `docs/changes/index.md`

- [ ] **Step 1: Full gates**

```bash
npm run knowledge:check
npm run typecheck
npm test
npm run lint
```

All must pass; fix root causes.

- [ ] **Step 2: Browser QA matrix**

For admin, owner and manager, at 320, 390 and 1280px, light and dark, visit `/dashboard/settings` and every item the role sees. Check: no horizontal overflow; first screen shows the primary action; focus rings visible; drawer and modals trap and return focus; reduced motion (`prefers-reduced-motion: reduce` in devtools) removes sheet/drawer motion; old `/dashboard/profile` URLs redirect.

- [ ] **Step 3: Verification record**

Create `docs/changes/settings-redesign/verification.md`:

```markdown
---
type: Change Verification
title: "settings-redesign-verification"
status: draft
tags: [superpowers, change, settings, verification]
---

# Settings redesign verification

| Gate | Result | Evidence |
| --- | --- | --- |
| `npm run knowledge:check` | <result> | <summary> |
| `npm run typecheck` | <result> | <summary> |
| `npm test` | <result> | <summary> |
| `npm run lint` | <result> | <summary> |
| Browser QA (admin, owner, manager × 320/390/1280 × light/dark) | <result> | <pages and findings> |

Open items: <list, or "none">
```

Replace every `<…>` with the real result before committing.

- [ ] **Step 4: Status**

- `docs/changes/settings-redesign/index.md`: status line → actual state (for example `implementation complete; verification recorded; capability promotion pending acceptance`), add `- [Verification](./verification.md)`.
- `docs/changes/index.md`: update the `settings-redesign` line to match.
- Do not edit `docs/capabilities/**` until the user accepts the change; then reconcile `admin-shell` and `manager-assignment-ui` as listed in design §9.

- [ ] **Step 5: Commit**

```bash
npm run knowledge:check
git add docs
git commit -m "docs(settings): record settings redesign verification"
```
