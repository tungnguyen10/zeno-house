## 1. Auth Layout & Store

- [ ] 1.1 Create `app/layouts/auth.vue` — centered card wrapper, no sidebar/header
- [ ] 1.2 Extend `app/stores/auth.ts` — add `user` and `profile` state, implement `$reset()`
- [ ] 1.3 Add `clearRole()` as alias to `$reset()` for backwards compatibility in existing middleware

## 2. i18n Keys

- [ ] 2.1 Create `locales/vi/auth.json` with keys: login form labels, error messages, success messages, forgot-password labels
- [ ] 2.2 Create `locales/en/auth.json` with identical key set (English translations)

## 3. Reusable Auth Components

- [ ] 3.1 Create `app/components/auth/LoginForm.vue` — email/password form, `variant` prop (`admin` | `tenant`), emits `submit` event
- [ ] 3.2 Create `app/components/auth/ForgotPasswordForm.vue` — email input, emits `submit` event, shows success state

## 4. useAuth Composable

- [ ] 4.1 Create `app/composables/useAuth.ts`
- [ ] 4.2 Implement `login(email, password)` — calls `useSupabaseClient().auth.signInWithPassword()`, updates store
- [ ] 4.3 Implement `logout()` — calls `useSupabaseClient().auth.signOut()`, calls `useAuthStore().$reset()`, redirects to `/login`
- [ ] 4.4 Implement `fetchProfile()` — calls `GET /api/auth/me`, populates store, no-op if already cached
- [ ] 4.5 Expose `isAdmin`, `isManager`, `isTenant` as computed refs from store
- [ ] 4.6 Implement `hasPermission(role)` — checks role hierarchy (admin ≥ manager ≥ tenant)

## 5. Middleware

- [ ] 5.1 Create `app/middleware/guest.ts` — fetch role, redirect authenticated users to their dashboard
- [ ] 5.2 Create `app/middleware/admin.ts` — require `role === 'admin'`, else redirect to `/login`
- [ ] 5.3 Create `app/middleware/manager.ts` — require `role === 'admin' || 'manager'`, else redirect to `/login`
- [ ] 5.4 Create `app/middleware/tenant.ts` — require `role === 'tenant'`, else redirect to `/login`

## 6. Pages

- [ ] 6.1 Update `app/pages/login.vue` — use `AuthLoginForm` component, `layout: 'auth'`, all text via `$t()`
- [ ] 6.2 Create `app/pages/tenant/login.vue` — tenant login page using `AuthLoginForm variant="tenant"`, `layout: 'auth'`, guest middleware
- [ ] 6.3 Create `app/pages/forgot-password.vue` — uses `AuthForgotPasswordForm`, `layout: 'auth'`, guest middleware
