## 1. i18n Keys

- [x] 1.1 Add reset-password keys to `i18n/locales/vi/auth.json`: `reset_password_title`, `reset_password_description`, `new_password`, `new_password_placeholder`, `confirm_password`, `confirm_password_placeholder`, `update_password`, `password_updated`, `password_updated_description`, `errors.password_mismatch`, `errors.password_too_short`, `errors.invalid_reset_link`
- [x] 1.2 Add the same keys to `i18n/locales/en/auth.json`

## 2. useAuth Composable

- [x] 2.1 Add `resetPassword(password: string)` to `app/composables/useAuth.ts` — calls `supabase.auth.updateUser({ password })`, then `signOut()` on success, throws on error

## 3. ResetPasswordForm Component

- [x] 3.1 Create `app/components/auth/ResetPasswordForm.vue` with `new_password` and `confirm_password` fields, Zod schema with `.refine()` for match check, props: `loading?`, `error?`; emits: `submit({ password })`

## 4. Reset Password Page

- [x] 4.1 Create `app/pages/reset-password.vue` with `definePageMeta({ layout: 'auth' })` (no guest middleware)
- [x] 4.2 On mount: call `useSupabaseClient().auth.getSession()` — if no session, redirect to `/forgot-password`
- [x] 4.3 Wire `ResetPasswordForm` submit to `useAuth().resetPassword()` — on success show a success state, then redirect to `/login`
- [x] 4.4 Handle Supabase error — set `error` ref and display via form's `error` prop

## 5. Spec Sync

- [x] 5.1 Remove the "not yet implemented" note from the `Forgot password page` requirement in `openspec/specs/auth-login-flows/spec.md`
