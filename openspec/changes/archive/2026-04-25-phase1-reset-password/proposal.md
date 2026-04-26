## Why

The `/forgot-password` page is implemented and sends a Supabase password reset email whose link points to `/reset-password` — but that page doesn't exist yet, making the entire password reset flow broken for end users. This change completes the loop.

## What Changes

- New page `/reset-password` (auth layout, no guest middleware — Supabase creates a temporary recovery session from the email link)
- New `resetPassword(password)` function exposed by `useAuth()` — calls `supabase.auth.updateUser({ password })`
- New reusable form component `app/components/auth/ResetPasswordForm.vue`
- New i18n keys for the reset-password page in `vi` and `en` locales
- The "not yet implemented" note removed from the `Forgot password page` requirement in `auth-login-flows`

## Capabilities

### New Capabilities
- *(none)*

### Modified Capabilities
- `auth-login-flows`: add the `/reset-password` page requirement (fulfilling the deferred note in the forgot-password requirement)
- `auth-composable`: add `resetPassword(password)` function to `useAuth()`
- `auth-i18n`: add translation keys for the reset-password page (`reset_password_title`, `reset_password_description`, `new_password`, `confirm_password`, `update_password`, `password_updated`, `password_updated_description`, `invalid_reset_link`, `errors.password_mismatch`, `errors.password_too_short`)

## Impact

- `app/pages/reset-password.vue` — new file
- `app/components/auth/ResetPasswordForm.vue` — new file
- `app/composables/useAuth.ts` — add `resetPassword()`
- `i18n/locales/vi/auth.json` and `i18n/locales/en/auth.json` — new keys
- `openspec/specs/auth-login-flows/spec.md` — remove deferred note, add new requirement
- `openspec/specs/auth-composable/spec.md` — add `resetPassword` requirement
- `openspec/specs/auth-i18n/spec.md` — update key list
