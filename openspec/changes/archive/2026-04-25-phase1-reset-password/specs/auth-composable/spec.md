## ADDED Requirements

### Requirement: useAuth composable exposes resetPassword function
The system SHALL expose `resetPassword(password: string)` in `useAuth()` that calls `supabase.auth.updateUser({ password })` using the current recovery session. On success it calls `signOut()` to clear the recovery session. Throws if Supabase returns an error.

#### Scenario: Successful password update clears session
- **WHEN** `resetPassword(password)` is called with a valid new password during a recovery session
- **THEN** `supabase.auth.updateUser({ password })` succeeds, `signOut()` is called, and the caller can navigate to `/login`

#### Scenario: Supabase error propagates to caller
- **WHEN** `supabase.auth.updateUser()` returns an error
- **THEN** `resetPassword()` throws with the Supabase error message so the page can display it
