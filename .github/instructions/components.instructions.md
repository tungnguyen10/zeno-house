---
applyTo: "app/components/**"
---

# Components

Ba lớp component, mỗi lớp có scope và rule riêng. Không được mix.

## 3 Lớp

| Lớp | Folder | Prefix | Mục đích |
|-----|--------|--------|---------|
| UI primitive | `app/components/ui/` | `Ui` | Generic, không có domain, không gọi API |
| Domain | `app/components/<domain>/` | Tên domain | Hiển thị data domain, nhận qua props |
| App shell | `app/components/app/` | `App` | Sidebar, Header, Breadcrumb — app-level |

## ✓ Cách dùng đúng

**UI primitive — generic, typed props, không domain:**
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

**Domain component — nhận DTO đã map, emit intent rõ ràng:**
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

**Handle đủ 3 trạng thái trong list/detail:**
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

**App shell component — không chứa domain logic:**
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

**Props typed rõ ràng, không truyền raw object lớn:**
```vue
<!-- ✓ Đúng: chỉ pass field cần thiết -->
<BuildingCard
  :building="building"   <!-- typed Building DTO -->
/>

<!-- ✓ Đúng: dùng accessor nếu component chỉ cần 1 field -->
<UiStatusBadge :status="building.status" />
```

## ✗ Cách không được dùng

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

| Tình huống | Cách đặt |
|---|---|
| Component đơn giản, tự chứa | Single `.vue` file (e.g., `ui/UiButton.vue`) |
| Component có sub-components hoặc helper riêng | Folder + `index.vue` + siblings |

> **Anti-pattern**: Tạo folder chỉ chứa `index.vue` duy nhất — không có siblings. Nếu không có file nào khác, dùng single `.vue` file.
>
> - ❌ `buildings/BuildingCard/index.vue` — không có siblings
> - ✅ `buildings/BuildingCard.vue` — single file
> - ✅ `buildings/BuildingForm/index.vue` + `buildings/BuildingForm/AddressSection.vue` — có sub-component

## Code Standards

### Dùng `v-for` cho markup lặp lại giống nhau

Khi render danh sách phần tử có cấu trúc giống nhau (chỉ khác data), dùng `v-for` với data array. Không duplicate template block chỉ khác nhau giá trị.

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

### Dùng `<IconName />` cho tất cả icon

Không được nhúng raw `<svg>` markup trong template. Đặt file SVG vào `app/assets/icons/` và dùng component được nuxt-svgo auto-import.

```vue
<!-- ✅ -->
<IconBuilding class="w-5 h-5 text-gray-500" aria-hidden="true" />
<IconChevronRight class="w-4 h-4" aria-hidden="true" />

<!-- ❌ -->
<svg viewBox="0 0 20 20" fill="currentColor">
  <path d="M4 6h16M4 12h16M4 18h16" />
</svg>
```

> Exception: Icon placeholder tạm thời trong quá trình dev (khi SVG chưa có) — phải có comment ghi rõ để thay thế sau.

### Không dùng inline `style` cho design values

Màu sắc, gradient, shadow, spacing không được viết dưới dạng `style=""`. Dùng Tailwind class hoặc `<style scoped>` nếu Tailwind không đủ.

```vue
<!-- ✅ -->
<div class="bg-blue-600 shadow-md px-4">...</div>

<!-- ✅ khi Tailwind không đủ -->
<h2 class="gradient-heading">...</h2>
<style scoped lang="scss">
.gradient-heading {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}
</style>

<!-- ❌ -->
<div style="background-color: #3b82f6; box-shadow: 0 4px 6px rgba(0,0,0,.1)">...</div>
```

### Không dùng CDN URL cho static asset

Logo, ảnh placeholder, asset tĩnh phải đặt trong `public/` và dùng root-relative path.

```vue
<!-- ✅ -->
<img src="/logo.svg" alt="Logo" />
<img src="/avatar-placeholder.jpg" alt="Avatar" />

<!-- ❌ -->
<img src="https://cdn.example.com/abc/logo.png" />
```

## Accessibility

- Mọi input phải có `label` (hoặc `aria-label`)
- Mọi button phải có text hoặc `aria-label` rõ ràng
- Icon trang trí phải có `aria-hidden="true"`
- Heading phải theo thứ tự `h1 → h2 → h3`, không nhảy cấp
- Focus state không được xoá (`outline-none` phải kèm `focus-visible` style thay thế)
