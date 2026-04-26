# Styling

## Priority Order

1. **Nuxt UI components** — use first; they handle dark mode, accessibility, and theming
2. **TailwindCSS utilities** — for layout, spacing, custom styling not covered by Nuxt UI
3. **Custom CSS** — only when neither Nuxt UI nor Tailwind can achieve the result

## Nuxt UI Components

Prefer Nuxt UI over raw HTML + Tailwind:

```vue
<!-- Good -->
<UButton color="primary" variant="solid" @click="save">Save</UButton>
<UInput v-model="name" placeholder="Room name" />
<UBadge :color="statusColor">{{ room.status }}</UBadge>
<UTable :rows="rooms" :columns="columns" :loading="loading" />
<UCard>
  <template #header>Rooms</template>
  <!-- content -->
</UCard>

<!-- Avoid -->
<button class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
```

## Room Status Color Tokens

Use the custom Tailwind tokens defined in the theme for room statuses:

```vue
<!-- Correct — semantic tokens -->
<span :class="`bg-room-${room.status} text-white`">{{ room.status }}</span>

<!-- Or via UBadge with status map -->
<script setup lang="ts">
const statusColor = {
  available: 'green',
  occupied: 'blue',
  maintenance: 'orange',
  reserved: 'purple',
} as const
</script>
<UBadge :color="statusColor[room.status]">{{ room.status }}</UBadge>
```

Available tokens: `room-available`, `room-occupied`, `room-maintenance`, `room-reserved`

## `cn()` — Conditional & Merged Classes

Use `cn()` (auto-imported from `app/utils/cn.ts`) when classes are conditional or composed from props. It combines **clsx** (conditional logic) + **tailwind-merge** (conflict resolution):

```vue
<script setup lang="ts">
const props = defineProps<{ variant?: "primary" | "danger"; disabled?: boolean }>();
</script>

<template>
  <!-- Conditional classes -->
  <div :class="cn('rounded px-4 py-2', props.disabled && 'opacity-50 cursor-not-allowed')">
    ...
  </div>

  <!-- Variant-based composition -->
  <button
    :class="cn(
      'rounded px-4 py-2 font-medium',
      props.variant === 'danger' ? 'bg-red-500 text-white' : 'bg-primary text-white',
    )"
  >
    ...
  </button>
</template>
```

**When to use `cn()` vs plain `:class`:**

| Situation | Use |
| --- | --- |
| Static classes only | `class="..."` |
| One condition (`v-if`-style toggle) | `:class="{ 'opacity-50': disabled }"` |
| Multiple conditions / prop-driven variants | `cn(...)` |
| Merging base + override (component API) | `cn(baseClasses, props.class)` |

`cn()` is especially useful in reusable components that accept a `class` prop:

```vue
<script setup lang="ts">
const props = defineProps<{ class?: string }>();
</script>

<template>
  <div :class="cn('base-styles here', props.class)">
    <slot />
  </div>
</template>
```

## TailwindCSS Usage

Use Tailwind utilities for layout and spacing. Follow mobile-first responsive prefixes:

```vue
<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
  <RoomCard v-for="room in rooms" :key="room.id" :room="room" />
</div>
```

## Dark Mode

Nuxt UI handles dark mode automatically via its color system. Don't add manual `dark:` overrides unless building custom components outside Nuxt UI.

## No Inline Styles

```vue
<!-- Bad -->
<div :style="{ color: '#ff0000', marginTop: '16px' }">...</div>

<!-- Good -->
<div class="text-red-500 mt-4">...</div>
```

## Anti-patterns

- **DON'T** reimplement Nuxt UI components with custom HTML + Tailwind
- **DON'T** use inline styles (`:style` binding) for presentational purposes
- **DON'T** hardcode hex colors — use Tailwind tokens or Nuxt UI color props
- **DON'T** use arbitrary Tailwind values (`w-[347px]`) unless truly necessary — prefer scale values
- **DON'T** add `<style scoped>` blocks for things achievable with Tailwind utilities
