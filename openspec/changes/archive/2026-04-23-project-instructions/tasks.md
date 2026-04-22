## 1. Update CLAUDE.md

- [x] 1.1 Fix Nuxt version: change "Nuxt 3" → "Nuxt 4" in stack section
- [x] 1.2 Refactor CLAUDE.md to thin index: keep stack overview + role matrix, remove lengthy inline content
- [x] 1.3 Add `@instructions/<file>.md` imports for all 7 instruction files
- [x] 1.4 Add maintenance note: "When a convention changes, update the matching instruction file in the same PR"

## 2. Create instructions/ directory and core files

- [x] 2.1 Create `instructions/project-structure.md` — Nuxt 4 `app/` layout, file placement rules, naming conventions
- [x] 2.2 Create `instructions/typescript.md` — strict mode rules, Zod schemas at API boundaries, shared types in `app/types/`, no `any`
- [x] 2.3 Create `instructions/supabase-platform.md` — service-role vs user-scoped client, RLS rules, SSR session via cookies, Realtime teardown
- [x] 2.4 Create `instructions/api-conventions.md` — server/api/ REST patterns, HTTP methods, Zod validation, error shape `{ error: string }`, auth check pattern

## 3. Create instructions/ component and state files

- [x] 3.1 Create `instructions/components.md` — dumb/presentational only, no Supabase calls, auto-import prefix, naming `XxxYyy.vue`
- [x] 3.2 Create `instructions/composables.md` — `useX` prefix, return reactive refs, Realtime subscription teardown in `onUnmounted`, call server/api/ not Supabase
- [x] 3.3 Create `instructions/stores.md` — Pinia setup store pattern, loading/error state shape, `useAuthStore` as reference, clear on logout
- [x] 3.4 Create `instructions/styling.md` — Nuxt UI components first, TailwindCSS utilities, room-status color tokens (`bg-room-available` etc.), no inline styles

## 4. Verify

- [x] 4.1 Verify all `@instructions/<file>.md` imports in CLAUDE.md resolve to existing files
- [x] 4.2 Verify each instruction file has at least one anti-pattern (DON'T) section
- [x] 4.3 Run `npm run typecheck` to ensure no issues introduced
