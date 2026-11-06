# Portal Profile Figma Layout

**Date:** 2026-07-29
**Status:** Approved by direct implementation instruction
**Reference:** Figma account frames `14:2190` (light) and `25:3851` (dark)

## Goal

Align `/portal/profile` with the Figma account-screen composition while preserving the current
tenant-portal behavior, data ownership, accessibility, and light/dark theme system.

## Direction

The page uses a centered account identity card followed by a single vertical reading column. Each
profile group has an icon-led heading and a quiet bordered surface containing divider-separated
rows. Values use the portal accent for scanability. The avatar, name, tenant code, status, and
`Sửa thông tin` action form the only visually prominent block.

The implementation maps Figma's raw green/light/dark values to existing portal semantic tokens.
It does not copy Figma colors, introduce new tokens, or change Inter typography.

## Layout

- Keep the existing tenant portal shell, title, navigation, and safe-area behavior.
- Move the edit action from the portal header into the centered identity card as
  `Sửa thông tin`, matching the Figma hierarchy.
- Render dossier groups in this order:
  - `Thông tin cá nhân`
  - `Liên hệ`
  - `Giấy tờ tùy thân`
  - `Liên hệ khẩn cấp`
  - `Ghi chú`
- Give each group an existing SVG icon, heading, and one `PortalCard`.
- Keep every real profile DTO field. Do not repeat room or contract data.
- Stack front/back identity images vertically on mobile, matching Figma. Use two columns only at
  wider desktop widths where the portal reading column allows it.
- Keep security, documents, and logout behavior. Present them with the same icon-led section rhythm.
- Keep identity images read-only on `/portal/profile`; editing remains on `/portal/profile/edit`.

## Responsive and Theme Behavior

- Use only portal token-backed classes and CSS variables so both `data-theme="light"` and
  `data-theme="dark"` remain supported.
- Preserve readable wrapping for email, addresses, notes, and identity values.
- At 320, 375, 414, and 768 pixels, the page must not overflow horizontally.
- Interactive targets remain at least 44px, with visible focus, disabled/busy states, and reduced
  motion behavior inherited from portal primitives.

## Boundaries

Expected production edits:

- `app/components/portal/PortalProfileDossier.vue`
- `app/pages/portal/profile/index.vue`

Expected test edits:

- `tests/components/portal/PortalProfileDossier.spec.ts`
- `tests/pages/portal-profile-ui.spec.ts`

No API, composable, validator, database, route, token, or primitive changes are required.

## Verification

- Focused profile component and page tests
- Typecheck and lint for changed Vue files
- Visual inspection in light and dark at representative mobile and desktop widths when a runnable
  authenticated portal session is available

