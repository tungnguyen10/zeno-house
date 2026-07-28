# Portal MapTrack light and dark theme design

## Scope

Apply a MapTrack-inspired visual system only to the tenant portal (`/portal/**`).
The internal dashboard, its theme tokens, and its layouts are out of scope.

## Goals

- Provide light and dark portal appearances using MapTrack semantics: teal for
  primary interaction, orange for time-sensitive warnings, navy for shell
  chrome, and clear success/error states.
- Respect a tenant's stored preference on subsequent visits.
- On first visit, follow the operating-system preference, with dark as the
  fallback when that preference is unavailable.
- Preserve portal routes, data flow, copy intent, component ownership, and
  current responsive navigation.

## Theme model

`usePortalTheme` will own a three-state preference: `system`, `light`, or
`dark`. It resolves the active theme from `matchMedia('(prefers-color-scheme:
dark)')` when set to `system`, otherwise from the explicit choice. The choice
is persisted in browser storage and applied as a portal-only data attribute on
the tenant layout before child portal content is rendered. A system preference
change updates the active appearance only while the stored choice is `system`.

The tenant layout starts in dark mode when no browser preference can be read.
This avoids a bright flash and matches the product's dark-first direction.

## Visual direction

The portal keeps its native-app shell and dense, task-led information
architecture; it does not imitate a map or introduce map-specific controls.

| Semantic role | Light mode | Dark mode |
| --- | --- | --- |
| Page and shell | white / very pale teal surface with navy chrome | deep navy canvas and navy-black chrome |
| Card and input | white raised surface with slate divider | navy-charcoal raised surface with low-contrast divider |
| Primary action and active navigation | MapTrack teal | bright teal tuned for dark contrast |
| Due date and warning | MapTrack orange | warm orange tuned for dark contrast |
| Success / error | green / red | accessible green / red on dark surfaces |

Both modes use the same semantic CSS custom properties inside `.portal-shell`.
Existing portal utility aliases (`bg-white`, `text-title`, `text-theme`, and
related borders/forms) continue to resolve through this scoped bridge, so no
dashboard utility is changed.

## UI changes

- Add an accessible header control that switches between light and dark and
  exposes the current action in its label. Choosing either mode persists it.
- Keep the mobile tab bar, desktop side rail, cards, buttons, bottom sheets,
  forms, status badges, skeletons, charts, and toast surfaces token-driven.
- Maintain visible focus rings, 44px minimum touch targets, no wrapped tab or
  toggle labels, reduced-motion behavior, and safe-area spacing.

## Implementation boundaries

Expected code changes:

- `app/composables/usePortalTheme.ts` — preference resolution and persistence.
- `app/layouts/tenant.vue` — apply the portal-local theme attribute.
- `app/components/portal/PortalHeader.vue` — theme control.
- `app/assets/scss/main.scss` — MapTrack light/dark semantic tokens and
  portal-only utility/form bridges.
- Portal component/page tests that assert the header or theme behavior.

No database migration, API change, dashboard edit, or global theme setting is
required.

## Verification

- Unit-test initial resolution, explicit persistence, and system preference
  updates.
- Check header accessibility and current portal navigation tests.
- Run portal-focused tests, then typecheck and lint.
- Visually inspect representative portal pages at 320, 375, 414, 768, and
  desktop widths in both modes.

## Decisions

- User-approved approach: portal-scoped semantic tokens (option 1).
- User preference: stored manual toggle; system preference on first use;
  dark fallback.
- User-approved boundary: portal only; dashboard untouched.
