---
applyTo: "app/**/*.vue, app/**/*.scss"
---

# Styling

Dùng Tailwind utility classes. Dùng `clsx` cho conditional/dynamic class. Không inline style.

## ✓ Cách dùng đúng

**Static classes — viết thẳng trong template:**
```vue
<div class="flex items-center gap-3 px-4 py-2 rounded-lg bg-white border border-gray-200 shadow-sm">
  <IconBuilding class="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
  <span class="text-sm font-medium text-gray-900 truncate">{{ building.name }}</span>
</div>
```

**Conditional classes — dùng `clsx`:**
```vue
<script setup lang="ts">
import clsx from 'clsx'

const props = defineProps<{
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
}>()

const buttonClass = computed(() =>
  clsx(
    // Base
    'inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    // Size
    {
      'px-3 py-1.5 text-xs': props.size === 'sm',
      'px-4 py-2 text-sm': !props.size || props.size === 'md',
      'px-5 py-2.5 text-base': props.size === 'lg',
    },
    // Variant
    {
      'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500':
        !props.variant || props.variant === 'primary',
      'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus-visible:ring-gray-400':
        props.variant === 'secondary',
      'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500':
        props.variant === 'danger',
    },
    // State
    {
      'opacity-50 cursor-not-allowed pointer-events-none': props.disabled || props.loading,
    },
  )
)
</script>

<template>
  <button :class="buttonClass" :disabled="disabled || loading">
    <slot />
  </button>
</template>
```

**Status badge — nhiều variant:**
```vue
<script setup lang="ts">
import clsx from 'clsx'
import type { BuildingStatus } from '~/types/buildings'

const props = defineProps<{ status: BuildingStatus }>()

const badgeClass = computed(() =>
  clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', {
    'bg-green-100 text-green-800':  props.status === 'active',
    'bg-gray-100 text-gray-600':    props.status === 'inactive',
    'bg-yellow-100 text-yellow-800': props.status === 'pending',
    'bg-red-100 text-red-800':      props.status === 'terminated',
  })
)

const label: Record<BuildingStatus, string> = {
  active: 'Đang hoạt động',
  inactive: 'Ngừng hoạt động',
  pending: 'Chờ duyệt',
  terminated: 'Đã chấm dứt',
}
</script>

<template>
  <span :class="badgeClass">{{ label[status] }}</span>
</template>
```

**Multiple class groups tách biệt cho dễ đọc:**
```vue
<div
  :class="clsx(
    'relative flex flex-col',           // layout
    'rounded-xl border bg-white',       // appearance
    'p-4 gap-4',                        // spacing
    { 'ring-2 ring-blue-500': selected } // state
  )"
>
```

## ✗ Cách không được dùng

```vue
<!-- ✗ Đừng dùng inline style -->
<div :style="{ backgroundColor: isActive ? '#22c55e' : '#e5e7eb' }">

<!-- ✗ Đừng nối string class thủ công -->
<div :class="'base ' + (isActive ? 'active-class' : 'inactive-class')">

<!-- ✗ Đừng dùng class string template literal -->
<div :class="`flex ${isOpen ? 'block' : 'hidden'}`">

<!-- ✗ Đừng viết CSS custom cho những thứ Tailwind làm được -->
<style scoped>
.card {
  padding: 16px;
  border-radius: 8px;
  display: flex;
}
/* → dùng: class="p-4 rounded-lg flex" */
</style>

<!-- ✗ Đừng xoá focus outline mà không thay thế -->
<button class="focus:outline-none">  <!-- mất accessibility -->
<!-- → dùng: focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 -->

<!-- ✗ Đừng hardcode màu HEX thay vì dùng Tailwind palette -->
<div :style="{ color: '#6b7280' }">  <!-- → class="text-gray-500" -->
```

## Exceptions — custom CSS trong main.scss

Chỉ viết custom CSS ở `app/assets/scss/main.scss` cho những thứ Tailwind không express được:

```scss
// app/assets/scss/main.scss
// ✓ Scrollbar utility — Tailwind không có
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

// ✓ Font-face — phải viết trong CSS
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-VariableFont_opsz,wght.ttf') format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
```

## Responsive

- Mobile-first theo Tailwind convention: `sm:`, `md:`, `lg:`, `xl:`
- Admin shell: desktop-first về mặt layout, nhưng viết mobile-first về mặt breakpoint

```vue
<!-- Sidebar collapse trên mobile -->
<div :class="clsx(
  'fixed inset-y-0 left-0 z-50',
  'w-64 bg-white border-r border-gray-200',
  'transition-transform duration-200',
  { '-translate-x-full': !sidebarOpen, 'translate-x-0': sidebarOpen },
  'lg:static lg:translate-x-0'  // luôn visible trên large screen
)">
```
