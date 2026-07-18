---
applyTo: "app/components/**"
---

# Components

Three component layers, each with its own scope and rules. Do not mix layers.

## Layers

| Layer | Folder | Prefix | Purpose |
|-----|--------|--------|---------||
| UI primitive | `app/components/ui/` | `Ui` | Generic, no domain logic, no API calls |
| Domain | `app/components/<domain>/` | Domain name | Presents domain data received via props |
| App shell | `app/components/app/` | `App` | Sidebar, Header, Breadcrumb — app-level |

## ✓ Correct Usage

**UI primitive — generic, typed props, no domain logic:**
```vue
<!-- app/components/ui/UiStatusBadge.vue -->
<script setup lang="ts">
const props = defineProps<{
  status: 'active' | 'inactive' | 'pending' | 'terminated'
  size?: 'sm' | 'md'
}>()
</script>

<template>
  <span :class="badgeClass">{{ label }}</span>
</template>
```

**Domain component — accepts mapped DTO, emits explicit intent events:**
```vue
<!-- app/components/buildings/BuildingCard.vue -->
<script setup lang="ts">
import type { Building } from '~/types/buildings'

const props = defineProps<{
  building: Building
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'edit', id: string): void
  (e: 'remove', id: string): void
  (e: 'changeStatus', id: string, status: BuildingStatus): void
}>()
</script>
```

**Handle all 3 states in list/detail screens:**
```vue
<!-- app/pages/buildings/index.vue -->
<template>
  <div>
    <UiSkeleton v-if="status === 'pending'" />
    <UiEmptyState
      v-else-if="buildings.length === 0"
      title="Chưa có tòa nhà nào"
      description="Tạo tòa nhà đầu tiên để bắt đầu"
    />
    <BuildingCard
      v-for="building in buildings"
      v-else
      :key="building.id"
      :building="building"
      @edit="onEdit"
      @remove="onRemove"
    />
  </div>
</template>
```

**App shell component — no domain logic:**
```vue
<!-- app/components/app/AppSidebar.vue -->
<script setup lang="ts">
const props = defineProps<{
  navItems: NavItem[]
  collapsed?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
}>()
// Chỉ layout, không biết về buildings hay rooms
</script>
```

**Explicitly typed props, do not pass large raw objects:**
```vue
<!-- ✓ Đúng: chỉ pass field cần thiết -->
<BuildingCard
  :building="building"   <!-- typed Building DTO -->
/>

<!-- ✓ Đúng: dùng accessor nếu component chỉ cần 1 field -->
<UiStatusBadge :status="building.status" />
```

## ✗ Do Not

```vue
<!-- ✗ Đừng fetch data trong domain component -->
<script setup>
const { data } = await useFetch('/api/buildings') // thuộc về page hoặc composable
</script>

<!-- ✗ Đừng dùng domain string trong ui/ component -->
<!-- app/components/ui/UiBuildingStatus.vue ← sai lớp, nên là domain component -->

<!-- ✗ Đừng pass raw DB row chưa map -->
<BuildingCard :building="rawDatabaseRow" />
<!-- Phải map qua mapBuilding() trước -->

<!-- ✗ Đừng dùng emit chung chung -->
const emit = defineEmits<{ (e: 'click'): void }>()
<!-- Dùng intent rõ: 'edit', 'remove', 'submit', 'changeStatus' -->

<!-- ✗ Đừng bỏ qua loading/empty/error state -->
<BuildingCard v-for="b in buildings" :key="b.id" :building="b" />
<!-- Thiếu case khi đang load hoặc khi list rỗng -->

<!-- ✗ Đừng đặt business condition trong ui/ component -->
<!-- UiButton không nên biết user có phải admin không -->
<UiButton v-if="user.role === 'admin'">Delete</UiButton>
<!-- Logic permission này thuộc về page hoặc RoleGate component -->
```

## Single-file vs Folder

| Case | Convention |
|---|---|
| Simple, self-contained | Single `.vue` file (e.g., `ui/UiButton.vue`) |
| Has sub-components or local helpers | Folder + `index.vue` + siblings |

> **Anti-pattern**: Creating a folder that only contains `index.vue` with no siblings. Use a single `.vue` file instead.
>
> - ❌ `buildings/BuildingCard/index.vue` — không có siblings
> - ✅ `buildings/BuildingCard.vue` — single file
> - ✅ `buildings/BuildingForm/index.vue` + `buildings/BuildingForm/AddressSection.vue` — có sub-component

## Code Standards

### Use `v-for` for repeated markup

When rendering a list of structurally identical elements that differ only in data, use `v-for` with a data array. Do not duplicate template blocks that differ only in values.

```vue
<!-- ✅ app/components/app/AppSidebar.vue -->
<NuxtLink
  v-for="item in navItems"
  :key="item.key"
  :to="item.to"
  :class="navItemClass(item.to)"
>
  {{ item.label }}
</NuxtLink>

<!-- ❌ viết lặp thủ công -->
<NuxtLink to="/" :class="...">Dashboard</NuxtLink>
<NuxtLink to="/buildings" :class="...">Tòa nhà</NuxtLink>
<NuxtLink to="/rooms" :class="...">Phòng</NuxtLink>
```

### Use `<IconName />` for all icons

Do not embed raw `<svg>` markup in templates. Place SVG files in `app/assets/icons/` and use the auto-imported components from nuxt-svgo.

```vue
<!-- ✅ -->
<IconBuilding class="w-5 h-5 text-muted" aria-hidden="true" />
<IconChevronRight class="w-4 h-4" aria-hidden="true" />

<!-- ❌ -->
<svg viewBox="0 0 20 20" fill="currentColor">
  <path d="M4 6h16M4 12h16M4 18h16" />
</svg>
```

> Exception: Temporary icon placeholders during development (when the SVG is not yet available) — must include a comment to replace later.

### Do not use inline `style` for design values

Colors, gradients, shadows, and spacing must not be written as `style=""` attributes. Use Tailwind classes or `<style scoped>` when Tailwind is insufficient.

```vue
<!-- ✅ -->
<div class="bg-cyan px-4 text-dark shadow-md">...</div>

<!-- ✅ khi Tailwind không đủ -->
<div class="workspace-grid">...</div>
<style scoped lang="scss">
.workspace-grid {
  grid-template-columns: minmax(0, 1fr) auto;
}
</style>

<!-- ❌ -->
<div style="background-color: #3b82f6; box-shadow: 0 4px 6px rgba(0,0,0,.1)">...</div>
```

### Do not use CDN URLs for static assets

Logos, placeholder images, and static assets must be stored under `public/` and referenced with root-relative paths.

```vue
<!-- ✅ -->
<img src="/logo.svg" alt="Logo" />
<img src="/avatar-placeholder.jpg" alt="Avatar" />

<!-- ❌ -->
<img src="https://cdn.example.com/abc/logo.png" />
```

## Accessibility

- Every input must have a `label` or `aria-label`
- Every button must have text or a clear `aria-label`
- Decorative icons must have `aria-hidden="true"`
- Headings must follow order `h1 → h2 → h3`, no skipped levels
- Focus state must not be removed (`outline-none` must be paired with a `focus-visible` replacement style)
