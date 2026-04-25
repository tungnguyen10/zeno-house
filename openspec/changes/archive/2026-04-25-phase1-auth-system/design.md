## Context

Phase 0 delivered a minimal auth backbone: `auth.ts` middleware, `role.ts` middleware, a basic `useAuthStore` (role only), and a `/login` page. The `@nuxtjs/supabase` module handles SSR session cookies automatically. Supabase Auth is already configured via environment variables. The `profiles` table exists with `id`, `email`, `role`, `full_name` columns.

## Goals / Non-Goals

**Goals:**
- Complete the auth UI layer: two login pages, forgot-password, reusable components
- Expose a `useAuth` composable as the single entry point for all auth actions
- Full i18n coverage for auth screens
- Fine-grained per-role middleware guards replacing manual role checks in pages

**Non-Goals:**
- Social/OAuth login (future)
- Two-factor authentication (future)
- Email verification flow beyond Supabase's default
- Admin user management UI (Phase 2)

## Decisions

### 1. `useAuth` composable over direct store calls

Components and pages call `useAuth()` — not `useAuthStore()` directly. The composable wraps Supabase's `useSupabaseAuth()` + the store, exposing `login()`, `logout()`, `fetchProfile()`, and computed `isAdmin/isManager/isTenant`.

**Why**: Decouples pages from the store shape. If the store changes, only the composable needs updating.

### 2. Separate `/tenant/login` page, not a role selector on `/login`

Tenants get their own login URL. Admin/manager use `/login`.

**Why**: Cleaner UX, simpler routing logic — no need to detect role before redirecting. Matches the product requirement of a distinct tenant experience.

### 3. Per-role middleware files (`admin.ts`, `manager.ts`, `tenant.ts`)

Each file calls `useAuthStore().fetchRole()` and throws 403 if role doesn't match. The existing `role.ts` handles the general prefix-based check; the new files are used for explicit `definePageMeta({ middleware: ['auth', 'admin'] })` declarations.

**Why**: Pages can declare their access requirement declaratively rather than having imperative checks inside `<script setup>`.

### 4. `useAuthStore` stores full `user` + `profile` (not just role)

Store shape becomes `{ user, profile, role (computed from profile) }`.

**Why**: Components need `full_name`, `email`, `avatar_url` without extra API calls. Centralises the profile state.

### 5. `auth.vue` layout wraps login pages

Login pages use `definePageMeta({ layout: 'auth' })`. The layout renders a minimal centered card wrapper with no sidebar or header.

**Why**: Avoids conditional rendering inside `default.vue` based on auth state.

## Risks / Trade-offs

- **Guest middleware timing** → `useSupabaseSession()` may return `null` on first SSR render before cookie hydration. Mitigation: guard only on client (`import.meta.client`) or use `callOnce` pattern.
- **Store shape breaking change** → `useAuthStore` currently exposes `{ role, fetchRole, clearRole }`. Adding `user` and `profile` is additive but `clearRole` → `$reset()` rename could break middleware. Mitigation: keep `clearRole` as alias during transition.
- **Forgot password UX** → Supabase sends a magic link; user lands back on the app with a token in the URL. Must handle the `?token=...` param on redirect. Mitigation: Supabase module handles this via `redirectTo` config.

## Open Questions

- Should `/tenant/login` share the same `LoginForm.vue` component (with a `variant` prop) or be a completely separate template? → Recommend shared component with `variant="tenant"` to avoid duplication.
