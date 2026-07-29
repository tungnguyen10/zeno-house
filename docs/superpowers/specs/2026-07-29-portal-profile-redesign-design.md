# Portal Profile Redesign

**Date:** 2026-07-29
**Status:** Approved, amended for self-service identity and password management

## Goal

Redesign the tenant profile experience so it feels like a focused native application: compact,
professional, easy to scan, and explicit about which personal data the tenant can edit.

The profile remains a personal dossier. It must not duplicate the active room, building, contract,
or occupancy information already available on the portal room screen.

## Scope

This change covers:

- the tenant profile view at `/portal/profile`
- a dedicated profile edit screen at `/portal/profile/edit`
- a dedicated password screen at `/portal/profile/password`
- client-side edit state, changed-field submission, validation feedback, and unsaved-change handling
- self-service identity fields and identity-image management
- the existing tenant-document management surface on the profile screen
- focused tests and the active tenant portal OpenSpec artifacts

This change does not alter:

- the database schema
- identity-image or document storage conventions
- room, building, contract, or occupancy presentation
- tenant permissions

The change extends the `/api/tenant/me` update whitelist with `id_number`, `id_issued_date`, and
`id_issued_place`. It also adds a self-service password endpoint that verifies the current password
through the authenticated Supabase session. No password value is stored in application tables or
audit payloads.

## Design Direction

Use the approved **Identity-first dossier** direction.

The portal's existing customer-facing light/dark theme, semantic tokens, Inter typography, safe-area
handling, and portal primitives remain authoritative. The redesign introduces no new theme, font,
token system, component library, or one-off global primitive.

The visual signature is a compact horizontal identity block followed by two calm, divider-led
information surfaces. Boldness is spent on hierarchy and spacing, not decoration. The page avoids
the current card-per-section rhythm.

## Profile View

### Header and identity block

The portal chrome title remains `Tài khoản`.

The page teleports one labelled `Chỉnh sửa` action into the existing portal header action target.
The current small pencil button inside the identity card is removed.

The identity block uses a compact horizontal composition:

- initials avatar
- full name
- tenant code
- login email
- tenant status

The tenant status uses the existing portal semantic status treatment. No fabricated metadata is
shown.

### Personal dossier surface

One surface contains the tenant-owned profile information. Internal labels and dividers establish
groups without nesting additional cards:

1. Personal details
   - full name
   - gender
   - date of birth
   - occupation
2. Contact
   - phone
   - email
   - permanent address
3. Emergency contact
   - contact name
   - contact phone
4. Notes

All fields render even when empty. Missing values use a consistent `Chưa cập nhật` treatment rather
than an ambiguous em dash, except where a compact table-like row requires the existing neutral
placeholder.

Long email, address, occupation, and notes content wraps without horizontal overflow. Labels remain
readable at 320 pixels and values do not get forced into an unusably narrow right column.

### Identity surface

A second surface is labelled `Thông tin định danh` and includes:

- ID card number
- issue date
- issue place

Supporting copy explains that the information is used to verify the tenant's identity. The surface
remains view-only on `/portal/profile`; its values are edited from the dedicated edit screen.

### Identity images and documents

Identity images remain visible on `/portal/profile`, after the textual dossier. Upload, replacement,
and removal controls move to `/portal/profile/edit`, so the profile screen remains a view surface.
Tenant documents remain manageable on `/portal/profile`.

Identity images:

- show the front and back previews on the profile view
- retain front/back capture, select, replace, remove, upload progress, local MIME/size validation,
  and error behavior on the edit screen
- stack below the `sm` breakpoint and use two columns from `sm` upward

Documents:

- use compact file rows with name, size, open, and remove actions
- retain upload progress, empty, loading, error, retry, and completed states
- keep server-returned signed URLs ephemeral

Removal behavior remains unchanged in this redesign. No new destructive confirmation contract is
introduced.

### Logout

Logout is separated from profile management at the end of the page. It uses a restrained danger
treatment and a full touch target without competing visually with the primary edit action.

### Security action

A compact `Bảo mật` surface on `/portal/profile` contains a clearly labelled `Đổi mật khẩu` action.
It routes to `/portal/profile/password`. The action is visible without opening the profile edit
screen and does not compete with the primary profile edit action in the header.

## Dedicated Edit Screen

### Route and page structure

Create `/portal/profile/edit` using the tenant layout.

The portal chrome uses:

- title: `Chỉnh sửa hồ sơ`
- back destination: `/portal/profile`
- a labelled `Lưu` action teleported into the existing header action target

The form is grouped into:

1. Personal details
2. Contact
3. Emergency contact
4. Identity
5. Identity images
6. Notes

The page edits the server whitelist:

- `full_name`
- `phone`
- `gender`
- `date_of_birth`
- `occupation`
- `permanent_address`
- `emergency_contact_name`
- `emergency_contact_phone`
- `id_number`
- `id_issued_date`
- `id_issued_place`
- `notes`

Email, tenant status, and tenant code are not rendered as editable controls. A short read-only
notice explains that login email is managed separately.

`id_number` remains optional, is trimmed, and is checked for conflicts with every other tenant
record while excluding the current tenant. A duplicate returns a conflict response that the client
associates with the ID-number field. Empty issue date and issue place normalize to `null`.

### Controls and actions

Reuse `PortalInput`, `PortalButton`, and the current accessible gender segmented-control pattern.
Do not introduce a second portal form primitive.

A safe-area-aware action bar keeps `Hủy` and `Lưu thay đổi` reachable near the bottom of the
viewport without covering the final field. The content region reserves enough bottom padding for
the action bar.

The save action is disabled when:

- the form has no changes
- a save is already in progress
- client validation has established that the current value is invalid

The header save action and bottom save action call the same submit function and expose the same
busy/disabled state.

### Form initialization and changed-field payload

The form initializes from the profile DTO after the portal bootstrap succeeds.

Keep a normalized baseline snapshot. Dirty state compares normalized current values with this
baseline. Empty optional strings normalize to `null`; required strings are trimmed before
comparison and submission.

Submission validates through `tenantProfileUpdateSchema`, then sends only whitelisted fields whose
normalized values changed. A no-change submission does not call the API.

`usePortalProfile.save` retains optimistic reconciliation and rollback. After a successful save:

1. the shared bootstrap profile contains the server response
2. the page navigates to `/portal/profile`
3. the portal toast says `Đã cập nhật hồ sơ.`

On failure, the edit page remains open, the previous shared profile is restored, field values are
preserved, and the server error is rendered near the actions.

Identity-image upload and removal remain immediate per-side operations. They do not wait for the
profile form's `Lưu` action and do not mark the text form dirty. Uploading a side exposes progress
and disables conflicting actions for that side while leaving the other side usable.

### Unsaved changes

Cancel, the portal header back action, browser history navigation, and route changes must not
silently discard dirty form values.

When the form is dirty, leaving opens a portal bottom sheet with:

- title: `Bỏ thay đổi?`
- explanation that unsaved profile changes will be lost
- secondary action: `Tiếp tục chỉnh sửa`
- destructive action: `Bỏ thay đổi`

Confirming resolves the pending navigation once. Continuing closes the sheet and remains on the
edit page. No prompt appears when the form is clean or after a successful save.

A browser `beforeunload` guard covers tab close or hard refresh while dirty. This native browser
prompt is limited to unload events; in-app navigation uses the portal bottom sheet.

## Dedicated Password Screen

Create `/portal/profile/password` using the tenant layout.

The page contains:

- current password
- new password
- new-password confirmation

All controls reuse the accessible password field pattern with show/hide actions, correct
`current-password` / `new-password` autocomplete values, visible focus, fixed helper space, and
field-associated errors. The new password is 8–72 characters, must differ from the current
password, and must match its confirmation.

Submission uses a dedicated authenticated server endpoint. The server validates the request,
updates Supabase Auth with both `current_password` and `password`, and maps wrong-current-password,
same-password, validation, and rate/auth failures to safe Vietnamese messages. The password values
must never appear in logs, application tables, error metadata, or audit snapshots.

On success, the current session remains active, the form is cleared, a restrained confirmation is
shown, and the page returns to `/portal/profile`. The system appends only the existing
password-changed audit action and non-sensitive actor/target metadata.

## Data and Ownership

The page consumes `TenantProfile` from the keyed `/api/tenant/bootstrap` payload through
`usePortalProfile`. Identity images and documents continue through their existing tenant-scoped
composables and `/api/tenant/**` endpoints. Password changes go through a dedicated authenticated
server endpoint and Supabase Auth; they are not profile-table mutations.

No browser-side Supabase table access is introduced. The existing service, repository, mapper,
validator, audit, and scope boundaries remain unchanged.

The current `TenantProfile` DTO already contains every tenant field required by this design. Raw
storage paths, database timestamps, and internal identifiers beyond the existing tenant ID are not
added to the UI.

## States and Accessibility

The redesign covers:

- profile bootstrap loading, error, retry, and loaded states
- empty field values
- identity-image loading, empty, uploading, success, and error states
- document loading, empty, uploading, success, error, retry, and removal states
- form default, dirty, field-error, API-error, saving, success, and unsaved-exit states
- password default, invalid-current, mismatch, same-password, saving, success, and API-error states
- hover where available, active touch feedback, visible focus, disabled, and busy states
- reduced motion
- safe areas and mobile widths of 320, 375, 414, and 768 pixels

All interactive targets remain at least 44 pixels where required by the portal touch contract.
Actions have visible text or an explicit accessible name. Status is not communicated by color
alone. Error messages remain associated with their fields through `PortalInput`.

## Implementation Boundaries

Expected production changes:

- keep `app/pages/portal/profile/index.vue` as the dossier view
- extend `app/pages/portal/profile/edit.vue`
- add `app/pages/portal/profile/password.vue`
- extract focused profile presentation or form components only if the page files would otherwise
  mix multiple responsibilities
- extend the shared tenant profile validator, service, repository, optimistic mapper, and tests for
  the three identity fields
- add a focused password validator, authenticated endpoint/service path, and composable action
- update focused tests under `tests/pages/**`, `tests/components/**`, and
  `tests/composables/**`, plus tenant portal server tests
- update the active `refresh-tenant-portal-ui` change artifacts and accepted portal UI spec when
  behavior changes

Do not create a reusable primitive from a one-page pattern. Existing `PortalCard`, `PortalButton`,
`PortalInput`, `PortalBottomSheet`, `PortalIdentityImageSlot`, skeleton, empty-state, and toast
components should be reused.

## Verification

Implementation verification will run:

1. focused profile, identity-image, password, page/component/composable/service tests
2. `npm run typecheck`
3. portal-related tests
4. `npm run lint`
5. `openspec validate refresh-tenant-portal-ui --strict`
6. visual inspection of profile view, edit flow, and password flow at representative desktop and
   mobile widths, including loading, error, populated, empty-field, dirty, saving, success, and
   unsaved-exit states

The implementation is complete only after the final visual pass confirms hierarchy, spacing,
overflow, focus visibility, touch ergonomics, safe-area behavior, and reduced motion.
