# Spec: Server Role Guard

## Purpose

Provides a reusable `requireRole(event, ...roles)` utility for Nuxt server routes that enforces both authentication and role-based authorization. The utility reads the user's role from the `profiles` table (not from JWT metadata), making role checks trustworthy and consistent across all server routes.

## Requirements

### Requirement: Role guard utility enforces authentication
The system SHALL provide a `requireRole(event, ...roles)` utility in `server/utils/requireRole.ts` that verifies the caller is authenticated before checking their role.

#### Scenario: Unauthenticated request
- **WHEN** a server route calls `requireRole(event, 'admin')` and no valid Supabase session exists
- **THEN** the utility SHALL throw a 401 error with message "Unauthorized"

### Requirement: Role guard utility enforces authorization
The utility SHALL verify the authenticated user's role against the `profiles` table and reject requests from users whose role is not in the allowed set.

#### Scenario: Insufficient role
- **WHEN** a server route calls `requireRole(event, 'admin')` and the authenticated user has role `'tenant'`
- **THEN** the utility SHALL throw a 403 error with message "Forbidden"

#### Scenario: Allowed role — single
- **WHEN** a server route calls `requireRole(event, 'admin')` and the authenticated user has role `'admin'`
- **THEN** the utility SHALL return `{ user, role }` without throwing

#### Scenario: Allowed role — multiple
- **WHEN** a server route calls `requireRole(event, 'admin', 'manager')` and the authenticated user has role `'manager'`
- **THEN** the utility SHALL return `{ user, role }` without throwing

### Requirement: Role guard reads role from profiles table
The utility SHALL fetch the user's role from the `profiles` table using the service-role Supabase client, not from JWT metadata.

#### Scenario: Role sourced from database
- **WHEN** `requireRole` is called with a valid session
- **THEN** the role used for authorization SHALL be the value of `profiles.role` for the authenticated user's ID

### Requirement: Dead requireSuperAdmin helper is removed
The `requireSuperAdmin` function in `server/utils/supabase.ts` SHALL be removed as it references a non-existent role and an incorrect data source.

#### Scenario: Function no longer exists
- **WHEN** a developer searches `server/utils/` for `requireSuperAdmin`
- **THEN** no such export SHALL be found
