## Why

Phase 0 established the auth skeleton (middleware, store, login page) but left the UI layer incomplete — no tenant-specific login flow, no forgot-password page, no `useAuth` composable, no i18n keys, and no reusable form components. Phase 1 cannot proceed without a fully functional auth surface.

## What Changes

- Add `auth.vue` layout for login pages (no sidebar/header)
- Add `/tenant/login` page with separate Supabase session flow for tenants
- Add `/forgot-password` page with password reset email
- Add `guest.ts` middleware to redirect already-authenticated users away from login pages
- Add fine-grained middleware: `admin.ts`, `manager.ts`, `tenant.ts` (per-role guards)
- Add `useAuth` composable: `login()`, `logout()`, `fetchProfile()`, `isAdmin/isManager/isTenant` computed, `hasPermission(role)`
- Extend `useAuthStore` with `user` and `profile` state (currently only has `role`)
- Add `LoginForm.vue` and `ForgotPasswordForm.vue` reusable components
- Add i18n translation keys in `locales/vi/auth.json` + `locales/en/auth.json`

## Capabilities

### New Capabilities

- `auth-login-flows`: Two separate login pages — `/login` for admin/manager, `/tenant/login` for tenants — each with role-based post-login redirect
- `auth-composable`: `useAuth()` composable exposing login, logout, fetchProfile, and role-based computed flags
- `auth-i18n`: Full i18n coverage for auth screens (labels, errors, success messages)

### Modified Capabilities

- `auth-infrastructure`: Extending existing spec — adds guest middleware, per-role middleware files, forgot-password flow, and enriched auth store shape (user + profile state)

## Impact

- `app/layouts/auth.vue` — new layout
- `app/pages/tenant/login.vue` — new page
- `app/pages/forgot-password.vue` — new page
- `app/middleware/guest.ts`, `admin.ts`, `manager.ts`, `tenant.ts` — new middleware files
- `app/composables/useAuth.ts` — new composable
- `app/stores/auth.ts` — extended (breaking shape change: adds `user`, `profile`)
- `app/components/auth/LoginForm.vue`, `ForgotPasswordForm.vue` — new components
- `locales/vi/auth.json`, `locales/en/auth.json` — new translation files
- `@nuxtjs/supabase` — uses `useSupabaseAuth()` for login/logout on client
