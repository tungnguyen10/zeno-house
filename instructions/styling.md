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

## Mobile First

Write CSS for mobile (375px) FIRST, then scale up. Breakpoint order: base → `sm:` → `md:` → `lg:` → `xl:`.

```html
<!-- ✅ Mobile first -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">

<!-- ❌ Desktop first -->
<div class="grid grid-cols-3 sm:grid-cols-2 grid-cols-1">
```

- Never use `max-width` to hide elements on mobile
- Test every component at 375px, 390px (iPhone), 430px before marking done

## Responsive Layout

```text
Container:    max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8

Spacing scale (stick to these values):
  4 → 8 → 12 → 16 → 20 → 24 → 32 → 48 → 64 → 80 → 96

Gap standard:
  Mobile:  gap-4
  Tablet:  sm:gap-6
  Desktop: lg:gap-8
```

## Touch & Interaction

- Minimum touch target: **44×44px** (WCAG 2.5.5)
- No hover-only interaction — must have tap equivalent
- Use bottom navigation instead of top navigation on mobile

## Typography Scale

```text
Display:  text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight
H1:       text-3xl sm:text-4xl font-bold leading-tight
H2:       text-2xl sm:text-3xl font-semibold leading-snug
H3:       text-xl sm:text-2xl font-semibold leading-snug
Body lg:  text-lg leading-relaxed
Body:     text-base leading-relaxed
Small:    text-sm leading-normal
Caption:  text-xs leading-normal text-muted
```

## Spacing Rhythm

```text
Section padding:  py-16 sm:py-20 lg:py-24
Card padding:     p-4 sm:p-6
Content gap:      space-y-4 sm:space-y-6
Inline gap:       gap-2 sm:gap-3
```

## Color Usage

### NuxtUI component colors

Use NuxtUI color props — never hardcode hex values on components:

```text
Primary action:    color="primary"
Destructive:       color="error"
Success:           color="success"
Neutral:           color="neutral"
Muted text:        class="text-muted"
Background subtle: class="bg-muted"
```

> **`app.config.ts` required**: NuxtUI's `color="primary"` resolves through its own internal token system. Without `app.config.ts` at project root declaring `ui: { colors: { primary: 'blue' } }`, the two color systems diverge silently. Always ensure this file exists.

### Custom design tokens

`app/assets/css/main.css` defines `@theme` tokens for non-NuxtUI elements. Use them via CSS variable syntax — never hardcode their hex values directly:

| Token | Use for |
| --- | --- |
| `--color-theme` | Active nav items, primary links, focus rings (custom elements) |
| `--color-theme-purple` | Secondary badges, premium feature highlights |
| `--color-brand` | Logo gradient, landing/marketing pages only — **not in app UI** |
| `--color-title` | H1, H2, H3, label text |
| `--color-body` | Body text, descriptions, secondary info |
| `--color-smoke` | Page background (admin content area) |
| `--color-smoke-blue` | Table row hover, selected state backgrounds |
| `--color-smoke-card` | Custom card backgrounds (when overriding NuxtUI defaults) |
| `--color-border` | Dividers, table borders, input borders (custom elements) |
| `--color-dark-nav` | Sidebar background in dark/navy variant |
| `--color-success/error/warning` | Status states on custom (non-NuxtUI) elements only |

```vue
<!-- ✅ Custom token via CSS var -->
<nav :class="'bg-[--color-dark-nav]'">...</nav>
<p class="text-[--color-body]">...</p>

<!-- ❌ Hardcoded hex -->
<nav style="background: #001C49">...</nav>
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

## Animation & Motion

```text
Micro-interaction:  transition-all duration-200 ease-out
Fade in/out:        transition-opacity duration-300
Slide:              transition-transform duration-300
Page transition:    300–500ms
```

Always respect the reduced-motion preference:

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; }
}
```

Vue `<Transition>` pattern:

```vue
<Transition
  enter-active-class="transition-all duration-300 ease-out"
  enter-from-class="opacity-0 translate-y-2"
  enter-to-class="opacity-100 translate-y-0"
  leave-active-class="transition-all duration-200 ease-in"
  leave-from-class="opacity-100 translate-y-0"
  leave-to-class="opacity-0 translate-y-2"
>
  <div v-if="show">...</div>
</Transition>
```

## Responsive Patterns

### Navigation

```text
Mobile:  Bottom tab bar or hamburger menu
Tablet:  Side drawer
Desktop: Top horizontal nav
```

### Grid Layouts

```html
<!-- Card grid -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

<!-- Content + sidebar -->
<div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">

<!-- Hero section -->
<div class="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
```

### Images — always use NuxtImg

```vue
<NuxtImg
  src="/image.jpg"
  alt="description"
  width="800"
  height="600"
  class="w-full h-auto object-cover"
  loading="lazy"
  format="webp"
/>
```

## Performance

- `loading="lazy"` for all below-the-fold images
- `useLazyFetch` for data that doesn't need SSR
- Never import a full library for a single function
- `defineAsyncComponent` for heavy components
- Always set `width`/`height` on `<NuxtImg>` to avoid layout shift

## Anti-patterns

- **DON'T** reimplement Nuxt UI components with custom HTML + Tailwind
- **DON'T** use inline styles (`:style` binding) for presentational purposes
- **DON'T** hardcode hex colors (`#fff`, `#000`) — use Tailwind tokens or Nuxt UI color props
- **DON'T** use arbitrary Tailwind values (`w-[347px]`) unless truly necessary — prefer scale values
- **DON'T** add `<style scoped>` blocks for things achievable with Tailwind utilities
- **DON'T** write desktop-first CSS — always mobile-first
- **DON'T** use hover-only interactions — always provide a tap equivalent
- **DON'T** use `!important`
