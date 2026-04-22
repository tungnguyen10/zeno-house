# TypeScript

## Rules

- **Strict mode is on** (`typescript: { strict: true }`) — no escape hatches
- **No `any`** — use `unknown` and narrow, or define a proper type
- **Always `import type`** for type-only imports
- **`<script setup lang="ts">`** in all Vue components — no Options API

## No `any`

```ts
// ✅ Correct
function processData(data: unknown) {
  if (typeof data === 'string') { ... }
}
async function fetchItem<T>(id: string): Promise<T> { ... }

// ❌ Wrong
function processData(data: any) { ... }
const result: any = await fetch(url)
```

## `import type` for Types and Interfaces

```ts
// ✅ Correct
import type { Room } from '~/types'
import type { Ref } from 'vue'

// ❌ Wrong
import { Room } from '~/types'       // Room is a type, not a value
```

## Vue SFCs: `<script setup lang="ts">` Only

```vue
<!-- ✅ Correct -->
<script setup lang="ts">
import type { Room } from '~/types'
defineProps<{ room: Room }>()
defineEmits<{ (e: 'save', room: Room): void }>()
</script>

<!-- ❌ Wrong — Options API -->
<script lang="ts">
export default defineComponent({ props: { room: Object } })
</script>

<!-- ❌ Wrong — no lang="ts" -->
<script setup></script>
```

## Formatting Rules (ESLint-enforced)

| Rule | Correct | Wrong |
|---|---|---|
| Strings | `"double quotes"` | `'single quotes'` |
| Semicolons | Required `;` | Omitted |

```ts
// ✅ Correct — will pass ESLint
import type { Room } from "~/types";
const name = ref("");
const loading = ref(false);

// ❌ Wrong — will fail ESLint
import type { Room } from '~/types'
const name = ref('')
const loading = ref(false)
```

> **For AI codegen:** Always use **double quotes** and **semicolons**. Single-quoted strings and missing semicolons will cause ESLint errors.

## Shared Types

All shared types live in `app/types/`. Import from there, never redefine locally.

```ts
// app/types/index.ts
export type Role = 'admin' | 'manager' | 'tenant'
export type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'reserved'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  created_at: string
}
```

## Zod at API Boundaries

Define schemas in `app/types/` alongside TS interfaces. Validate in every `server/api/` handler:

```ts
// app/types/rooms.ts
export const createRoomSchema = z.object({
  name: z.string().min(1).max(50),
  monthly_rent: z.number().positive(),
  status: z.enum(['available', 'occupied', 'maintenance', 'reserved']),
})
export type CreateRoomInput = z.infer<typeof createRoomSchema>
```

## Anti-patterns

**✅ DO:**
- Use strict TypeScript — no `any`, no `@ts-ignore`
- Use `import type` for interfaces and schemas
- Use `<script setup lang="ts">` in every Vue SFC
- Use `defineProps<{...}>()` and `defineEmits<{...}>()`
- Use `ref<Type>()` with explicit generics when not inferable
- Use **double quotes** for all strings
- End every statement with a **semicolon**

**❌ DON'T:**
- Use `any` — use `unknown` or proper typing
- Mix value and type imports without `type` keyword
- Use Options API components
- Use non-null assertion `!` without a comment explaining the invariant
- Add `console.log` to committed code
- Expose `SUPABASE_SERVICE_KEY` or other secrets in client-side code
- Use single-quoted strings — ESLint will reject them
- Omit semicolons — ESLint will reject them
