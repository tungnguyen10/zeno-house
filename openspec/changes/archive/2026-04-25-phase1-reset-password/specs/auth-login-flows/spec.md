## MODIFIED Requirements

### Requirement: Forgot password page sends reset email
The system SHALL provide a `/forgot-password` page where users can enter their email to receive a Supabase password reset link. The `forgotPassword(email)` composable function calls `supabase.auth.resetPasswordForEmail()` with `redirectTo` set to `{origin}/reset-password`.

#### Scenario: Valid email triggers reset email
- **WHEN** a user submits a valid email on `/forgot-password`
- **THEN** Supabase sends a password reset email with a link back to `/reset-password`, and the page shows a success message

#### Scenario: Unknown email shows generic success
- **WHEN** a user submits an email that doesn't exist in auth.users
- **THEN** the page shows the same success message (no enumeration of valid emails)

#### Scenario: Empty email shows validation error
- **WHEN** a user submits the forgot-password form with no email
- **THEN** a validation error is shown inline

## ADDED Requirements

### Requirement: Reset password page completes the password update flow
The system SHALL provide a `/reset-password` page (auth layout, no guest middleware) that handles the password update after a user arrives via the Supabase password reset email link. `@nuxtjs/supabase` automatically exchanges the PKCE token from the URL and establishes a short-lived recovery session. The page calls `useAuth().resetPassword(password)` to update the password, then calls `signOut()` before redirecting to `/login`.

If no session is present on mount (link expired or invalid), the page redirects to `/forgot-password` without rendering the form.

#### Scenario: User arrives with valid reset link and sets new password
- **WHEN** a user lands on `/reset-password` from a valid email link and submits a new password
- **THEN** `supabase.auth.updateUser({ password })` is called, `signOut()` is called, and the user is redirected to `/login`

#### Scenario: Passwords do not match
- **WHEN** the user submits mismatched passwords
- **THEN** a validation error is shown inline and no API call is made

#### Scenario: Expired or invalid reset link
- **WHEN** a user arrives on `/reset-password` with an expired or invalid token (no session established)
- **THEN** they are redirected to `/forgot-password` with no form shown

#### Scenario: Password too short fails validation
- **WHEN** the user submits a password shorter than 6 characters
- **THEN** a validation error is shown inline and no API call is made

#### Scenario: Supabase update error surfaces to user
- **WHEN** `supabase.auth.updateUser()` returns an error
- **THEN** the error message is shown on the page and the user remains on `/reset-password`
