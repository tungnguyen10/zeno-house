# Vue Components

## Directory Structure

```
app/components/
├── ui/                        # Generic, reusable UI — no business logic
│   ├── Button.vue             # → <UIButton />
│   ├── Input.vue              # → <UIInput />
│   └── LoadingSpinner.vue     # → <UILoadingSpinner />
│
├── layout/                    # App shell structure
│   ├── nav/
│   │   ├── index.vue          # → <LayoutNav />
│   │   └── NavLinks.vue       # internal sub-component
│   ├── Header.vue             # → <LayoutHeader />
│   └── Sidebar.vue            # → <LayoutSidebar />
│
├── form/                      # Form fields, inputs, validation wrappers
│   ├── Field.vue              # → <FormField />
│   └── Select.vue             # → <FormSelect />
│
└── features/                  # Feature-specific components with domain logic
    ├── room/
    │   ├── StatusBadge.vue    # → <RoomStatusBadge />
    │   └── Card.vue           # → <RoomCard />
    ├── invoice/
    │   └── Table.vue          # → <InvoiceTable />
    └── tenant/
        └── Card.vue           # → <TenantCard />
```

**How auto-import works**: Nuxt prefixes by folder — `ui/` → `<UI.../>`, `layout/` → `<Layout.../>`, `form/` → `<Form.../>`. For `features/`, the **immediate subfolder** is the prefix: `features/room/Card.vue` → `<RoomCard />`.

## Categories

| Category | Prefix | Purpose | May access stores? |
|---|---|---|---|
| `ui/` | `<UI.../>` | Generic, reusable, no business logic | No |
| `layout/` | `<Layout.../>` | App shell, used in app.vue or all pages | Yes (auth state) |
| `form/` | `<Form.../>` | Form fields, validation display | No |
| `features/` | `<FeatureName.../>` | Domain-specific, feature-scoped | Yes |

## Using Pinia Stores in Components

Pinia stores (`useAuthStore`, `useRoomsStore`, etc.) are **auto-imported** by Nuxt — no explicit import needed:

```vue
<script setup lang="ts">
// ✅ No import needed — Nuxt auto-imports all stores from app/stores/
const authStore = useAuthStore();
const { role } = storeToRefs(authStore);
</script>
```

Only `layout/` and `features/` components may access stores (see Categories table above).

## Rule: Components are presentational

Components receive data via props and emit events. They call composables when they need data — they do **not** call APIs or Supabase directly.

```vue
<!-- Good -->
<script setup lang="ts">
import type { Room } from '~/types'
defineProps<{ room: Room; loading?: boolean }>()
const emit = defineEmits<{ (e: 'edit', id: string): void }>()
</script>
```

## Script Setup

Always `<script setup lang="ts">`. No Options API.

```vue
<script setup lang="ts">
import type { Room } from '~/types'
const props = defineProps<{ room: Room; editable?: boolean }>()
const emit = defineEmits<{ (e: 'save', room: Room): void }>()
</script>
```

## Nuxt UI First

Use Nuxt UI components before building custom HTML + Tailwind:

```vue
<!-- Good -->
<UButton color="primary" @click="emit('save', room)">Save</UButton>
<UBadge :color="statusColor[room.status]">{{ room.status }}</UBadge>
<UTable :rows="rooms" :columns="columns" :loading="loading" />

<!-- Avoid reinventing -->
<button class="px-4 py-2 bg-blue-600 rounded">Save</button>
```

## Single-file vs Folder

Use a **folder + `index.vue`** only when there are sibling files. A component with no siblings MUST be a single `.vue` file.

```
✅ features/room/Card.vue              (single file, no siblings)
✅ layout/nav/index.vue + NavLinks.vue (folder needed — has sibling)
❌ features/room/Card/index.vue        (folder with no siblings — anti-pattern)
```

## Naming — Avoid Prefix Repetition

The subfolder name becomes the prefix — don't repeat it in the filename:

```
❌ features/room/RoomCard.vue   → <RoomRoomCard />  (duplicated)
✅ features/room/Card.vue       → <RoomCard />       (clean)
```

## i18n

Always use `$t()` for user-facing strings:

```vue
<template>
  <h1>{{ $t('rooms.title') }}</h1>
  <UButton>{{ $t('common.save') }}</UButton>
</template>
```

## Code Standards

**Use `v-for` for repeated markup** — never duplicate template blocks that differ only in data:
```vue
<a v-for="item in navItems" :key="item.id">{{ item.label }}</a>
```

**No inline styles** — use Tailwind classes or `<style scoped>`:
```vue
<!-- Bad -->  <div :style="{ color: '#ff0000' }">
<!-- Good -->  <div class="text-red-500">
```

**No external CDN URLs** for static assets — put them in `public/` and use root-relative paths:
```vue
<!-- Bad -->  <img src="https://cdn.example.com/logo.svg" />
<!-- Good --> <img src="/logo.svg" />
```

## Anti-patterns

- **DON'T** call `$fetch`, `useFetch`, or `useSupabaseClient()` in components
- **DON'T** put generic UI in `features/` or feature-specific logic in `ui/`
- **DON'T** hardcode Vietnamese/English strings — use `$t()` keys
- **DON'T** create a folder with only `index.vue` and no siblings
- **DON'T** use Options API (`export default defineComponent({...})`)
