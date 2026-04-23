## MODIFIED Requirements

### Requirement: Auth Pinia store caches role to avoid duplicate API calls
The system SHALL have a `useAuthStore` Pinia store that caches the authenticated user's `user` object (from Supabase Auth) and full `profile` (from `profiles` table) after the first `/api/auth/me` call. `role` is derived from `profile.role`. Subsequent calls within the same session return the cached value. The store exposes `$reset()` that clears all state on logout.

#### Scenario: Role fetched once per session
- **WHEN** a user logs in and navigates between pages
- **THEN** `/api/auth/me` is called exactly once; subsequent role reads hit the store cache

#### Scenario: Cache cleared on logout
- **WHEN** a user logs out
- **THEN** `$reset()` is called, clearing `user`, `profile`, and `role`

#### Scenario: Store exposes user and profile
- **WHEN** a component reads `useAuthStore().profile`
- **THEN** it receives the full profile object including `full_name`, `email`, `role`
