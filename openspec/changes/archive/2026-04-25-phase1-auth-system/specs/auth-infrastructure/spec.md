## MODIFIED Requirements

### Requirement: Auth Pinia store caches role to avoid duplicate API calls
The system SHALL have a `useAuthStore` Pinia store that caches the authenticated user's `user` object (from Supabase Auth) and full `profile` (from `profiles` table). `role` is derived from `profile.role`. Subsequent calls within the same session return the cached value. The store exposes:
- `$reset()` — clears all state on logout
- `setProfile(data: Profile)` — directly populates `user` and `profile` from a Profile object (used by `useAuth.login()` to bypass the server-side `/api/auth/me` call during login)
- `fetchProfile()` — fetches from `GET /api/auth/me` and populates the store; used by middleware on subsequent page navigations

#### Scenario: Role fetched once per session
- **WHEN** a user logs in and navigates between pages
- **THEN** `/api/auth/me` is called at most once per session; subsequent role reads hit the store cache

#### Scenario: setProfile populates store directly
- **WHEN** `setProfile(profile)` is called with a valid Profile object
- **THEN** `user` and `profile` are populated immediately without an API call

#### Scenario: Cache cleared on logout
- **WHEN** a user logs out
- **THEN** `$reset()` is called, clearing `user`, `profile`, and `role`

#### Scenario: Store exposes user and profile
- **WHEN** a component reads `useAuthStore().profile`
- **THEN** it receives the full profile object including `full_name`, `email`, `role`
