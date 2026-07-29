# Portal Profile Redesign

**Date:** 2026-07-29
**Status:** Approved for implementation

## Goal

Redesign the tenant profile experience so it feels like a focused native application: compact,
professional, easy to scan, and explicit about which personal data the tenant can edit.

The profile remains a personal dossier. It must not duplicate the active room, building, contract,
or occupancy information already available on the portal room screen.

## Scope

This change covers:

- the tenant profile view at `/portal/profile`
- a dedicated profile edit screen at `/portal/profile/edit`
- client-side edit state, changed-field submission, validation feedback, and unsaved-change handling
- the existing identity-image and tenant-document management surfaces on the profile screen
- focused tests and the active tenant portal OpenSpec artifacts

This change does not alter:

- the database schema
- the `/api/tenant/me` request or response contract
- the profile update whitelist
- identity-image or document storage conventions
- room, building, contract, or occupancy presentation
- tenant permissions

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

### Verified identity surface

A second surface is labelled `Định danh đã xác minh` and includes:

- ID card number
- issue date
- issue place

Supporting copy explains that management verifies these fields and that the tenant must contact
management to change them. The surface is visibly read-only and does not present disabled inputs.

### Identity images and documents

Identity images and tenant documents remain on `/portal/profile`, after the textual dossier.

Identity images:

- retain the front and back slots
- stack below the `sm` breakpoint and use two columns from `sm` upward
- preserve capture/select, replace, remove, upload progress, local MIME/size validation, and errors

Documents:

- use compact file rows with name, size, open, and remove actions
- retain upload progress, empty, loading, error, retry, and completed states
- keep server-returned signed URLs ephemeral

Removal behavior remains unchanged in this redesign. No new destructive confirmation contract is
introduced.

### Logout

Logout is separated from profile management at the end of the page. It uses a restrained danger
treatment and a full touch target without competing visually with the primary edit action.

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
4. Notes

The page edits only the current server whitelist:

- `full_name`
- `phone`
- `gender`
- `date_of_birth`
- `occupation`
- `permanent_address`
- `emergency_contact_name`
- `emergency_contact_phone`
- `notes`

Email, tenant status, tenant code, ID number, ID issue date, and ID issue place are not rendered as
editable controls. A short read-only notice explains that login and verified identity data are
managed separately.

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

## Data and Ownership

The page consumes `TenantProfile` from the keyed `/api/tenant/bootstrap` payload through
`usePortalProfile`. Identity images and documents continue through their existing tenant-scoped
composables and `/api/tenant/**` endpoints.

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
- hover where available, active touch feedback, visible focus, disabled, and busy states
- reduced motion
- safe areas and mobile widths of 320, 375, 414, and 768 pixels

All interactive targets remain at least 44 pixels where required by the portal touch contract.
Actions have visible text or an explicit accessible name. Status is not communicated by color
alone. Error messages remain associated with their fields through `PortalInput`.

## Implementation Boundaries

Expected production changes:

- reshape `app/pages/portal/profile.vue` into the dossier view
- add `app/pages/portal/profile/edit.vue`
- extract focused profile presentation or form components only if the page files would otherwise
  mix multiple responsibilities
- adjust `app/composables/tenant-portal/usePortalProfile.ts` only for shared changed-field or
  reconciliation behavior that cannot remain local to the edit page
- update focused tests under `tests/pages/**`, `tests/components/**`, and
  `tests/composables/tenant-portal.test.ts`
- update the active `refresh-tenant-portal-ui` change artifacts and accepted portal UI spec when
  behavior changes

Do not create a reusable primitive from a one-page pattern. Existing `PortalCard`, `PortalButton`,
`PortalInput`, `PortalBottomSheet`, `PortalIdentityImageSlot`, skeleton, empty-state, and toast
components should be reused.

## Verification

Implementation verification will run:

1. focused profile page/component/composable tests
2. `npm run typecheck`
3. portal-related tests
4. `npm run lint`
5. `openspec validate refresh-tenant-portal-ui --strict`
6. visual inspection of profile view and edit flow at representative desktop and mobile widths,
   including loading, error, populated, empty-field, dirty, saving, and unsaved-exit states

The implementation is complete only after the final visual pass confirms hierarchy, spacing,
overflow, focus visibility, touch ergonomics, safe-area behavior, and reduced motion.
