## Context

Supabase password reset uses a two-step flow:
1. `/forgot-password` calls `resetPasswordForEmail()` → Supabase emails a link to `/reset-password`
2. User clicks the link → Supabase appends a PKCE token to the URL → `@nuxtjs/supabase` automatically exchanges the token and establishes a short-lived **recovery session**
3. The `/reset-password` page calls `updateUser({ password })` using that session to set the new password

The recovery session is a real Supabase session — `useSupabaseUser()` returns the user. This means `guest.ts` middleware would redirect the user away from `/reset-password` if we don't exclude it.

## Goals / Non-Goals

**Goals:**
- Complete the password reset flow so the email link isn't a dead end
- Handle expired/invalid links gracefully (no session → show error, redirect to `/forgot-password`)
- Client-side password confirmation validation (passwords match, min length)
- Show success state after update, then redirect to `/login`

**Non-Goals:**
- Email change or other `updateUser` fields — only password
- Force-logout of other sessions after password reset (Supabase does this by default)
- Admin-initiated password reset

## Decisions

**Decision: `/reset-password` does NOT use `guest` middleware**  
The page must be accessible while the user holds a recovery session (which registers as "authenticated"). Applying `guest.ts` would immediately redirect them to their dashboard. Instead, the page validates the session type on mount — if no session exists (expired link), it redirects to `/forgot-password` with an error query param.

*Alternative considered*: Detect `PASSWORD_RECOVERY` event via `onAuthStateChange`. Rejected — adds complexity and doesn't handle the case where the page is refreshed after the event fires.

**Decision: `resetPassword(password)` lives in `useAuth()`**  
Keeps all Supabase auth calls in one composable, consistent with `login()`, `logout()`, `forgotPassword()`. The page calls `useAuth().resetPassword(password)` directly.

**Decision: Password confirmation is form-level validation only (Zod)**  
`supabase.auth.updateUser()` only takes one password field. The "confirm password" field is a UX guard — validated client-side with Zod's `.refine()`. No server round-trip for the mismatch check.

**Decision: Page uses `auth` layout (no sidebar/header)**  
Consistent with `/login`, `/forgot-password`, `/tenant/login`. Same `definePageMeta({ layout: 'auth' })` pattern.

## Risks / Trade-offs

- **Token expiration**: Supabase recovery tokens expire (default 1 hour). If the user opens the link late, `getSession()` returns null. → Redirect to `/forgot-password?error=expired` and show a hint to request a new link.
- **Double-submit**: User clicks "Update password" twice quickly. → `loading` ref disables the button during the request.
- **Session after success**: After `updateUser()`, the recovery session is still valid. → Call `signOut()` after success so the user must log in fresh with their new password, preventing stale session issues.

## Migration Plan

No database changes. No migration needed. Ship as a new page.
