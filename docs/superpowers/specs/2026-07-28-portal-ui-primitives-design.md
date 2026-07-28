# Portal UI Primitives Design

## Goal

Turn the MapTrack portal foundation into a small, reusable primitive set for the tenant portal only. The set must render correctly under the existing dark-first and light portal themes, while the dashboard remains untouched.

## Scope

- Replace `PortalTextField` with `PortalInput` as the portal's single text, date, telephone, and textarea control.
- Add `PortalChip` for compact selectable and informational tokens, with neutral, accent, success, warning, and danger tones.
- Keep semantic MapTrack variables scoped to `.portal-shell`; document color, type, spacing, and elevation through the development-only portal showcase.
- Apply the new input primitive to the profile edit form and showcase. The existing segmented gender buttons remain page-specific because they encode profile choice, not a generic chip contract.

## Component contracts

### `PortalInput`

- Supports `v-model`, label, hint, error, disabled, required, native type, `textarea`, and native input attributes already used by the portal.
- Owns label-to-control association and accessible error/hint descriptions.
- Uses a 44px minimum height for single-line controls, a visible focus ring, and a distinct invalid state.

### `PortalChip`

- Supports `tone` (`neutral`, `accent`, `success`, `warning`, `danger`) and `selected`.
- Renders a non-interactive label by default; when `interactive` is set, renders a keyboard-focusable button with pressed state and emits the named `select` intent.
- Does not own domain status mapping; `PortalStatusBadge` continues to map business status through `PORTAL_STATUS_STYLES`.

## Foundation reference

The showcase exposes the existing semantic palette, typography roles, spacing rhythm, and two elevation levels. It does not create a second token system: all examples reference `--portal-*` variables and the existing utility roles.

## Visual direction

MapTrack's signal is calm navigation: navy chrome, teal route marker, and cool slate surfaces. The primitives stay dense and tactile: rounded controls, a single clear focus ring, short press feedback, and no decorative gradients or additional shadows.

## Accessibility and responsive behavior

- Interactive chips and inputs keep visible keyboard focus and suitable disabled/invalid state.
- The showcase token grids collapse to one column without overflow at 320px.
- Motion stays limited to the existing micro-duration and respects reduced motion.

## Non-goals

- No dashboard or shared `Ui*` primitive changes.
- No data/API/composable/schema changes.
- No new font, dependency, root token file, or portal route available in production.
