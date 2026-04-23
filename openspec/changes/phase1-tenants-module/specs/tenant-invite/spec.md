## ADDED Requirements

### Requirement: Admin can invite a tenant to create their login account
The system SHALL allow an admin or manager to send an email invite to a tenant's email address via `POST /api/tenants/[id]/invite`. Supabase sends the invite email; on first login the tenant sets their password at `/tenant/login`.

#### Scenario: Invite sends email
- **WHEN** an admin clicks "Gửi lời mời" on the tenant detail page
- **THEN** a Supabase invite email is sent to the tenant's email address and the button shows "Đã gửi"

#### Scenario: Invite fails for already-registered email
- **WHEN** the tenant already has a Supabase Auth account
- **THEN** the API returns HTTP 409 and an error toast is shown

#### Scenario: Tenant lands on /tenant/login after clicking invite link
- **WHEN** a tenant clicks the invite link in their email
- **THEN** they are directed to `/tenant/login` to set their password

### Requirement: Invited tenant is assigned role = 'tenant' in profiles
The system SHALL ensure that when an invite is accepted and the tenant sets their password, a `profiles` row is created (or updated) with `role = 'tenant'`.

#### Scenario: Profile created on invite acceptance
- **WHEN** a tenant accepts the invite and sets a password
- **THEN** a `profiles` row exists with `role = 'tenant'` and `id` matching `auth.users.id`
