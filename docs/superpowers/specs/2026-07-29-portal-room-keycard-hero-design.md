# Portal Room Keycard Hero Design

## Goal

Improve the portal home identity hero so the tenant's current room is the
primary piece of information while preserving the existing MapTrack portal
design system, tenant identity context, and navigation behavior.

## Scope

This change applies only to the identity hero at the top of
`app/pages/portal/index.vue`.

In scope:

- Reorder and restyle existing room, building, contract, identity, greeting,
  and date information.
- Preserve the existing `/portal/room` navigation.
- Preserve loading and no-active-contract states.
- Update the focused portal home UI tests.

Out of scope:

- Dashboard UI.
- Portal theme tokens, typography tokens, or shared primitives.
- Portal API, DTO, composable, or business behavior.
- Other portal home sections.

## Design Direction

Use a **Room Keycard** composition. The card should read first as the tenant's
current residence, then as their identity context.

The room number is the visual anchor. Building, contract, and identity details
support it without competing for attention. The result stays compact,
touch-first, and consistent with the existing MapTrack light and dark modes.

No new colors, type scales, fonts, gradients, shadows, icons, or reusable
primitives are introduced.

## Information Hierarchy

For an active contract, content appears in this order:

1. A compact header with the building name on the left and the formatted
   current date on the right.
2. A prominent `Phòng {roomNumber}` title.
3. The `Người ở cùng` role chip beside the room title when
   `assignmentRole === 'roommate'`.
4. A two-column contract summary containing:
   - monthly rent;
   - contract start and end dates.
5. A divided identity footer containing:
   - initials avatar;
   - time-aware greeting;
   - tenant full name, falling back to `Người thuê`;
   - a chevron communicating navigation to room details.
6. When the tenant is a roommate and a primary tenant is available, the
   identity footer also shows `Người đứng hợp đồng: {primaryTenantName}` as
   secondary metadata.

The entire card remains the single interactive target and navigates to
`/portal/room`.

## Responsive Behavior

- At 320, 375, and 414 pixels, the room title remains the dominant line and is
  not displaced by the date.
- Building and date use compact caption styling and may truncate or wrap only
  within their own constrained regions.
- Contract summary columns use `minmax(0, 1fr)` tracks to avoid overflow.
- Long tenant, building, and primary-tenant names truncate safely.
- Contract dates may wrap within the contract summary without causing
  horizontal scrolling.
- The existing desktop page width and spacing rhythm remain unchanged.

## States

### Loading

Keep the existing statement skeleton with the hero's reserved height so the
page does not shift materially when data resolves.

### Active contract

Render the complete Room Keycard and make the card interactive.

### No active contract

Render a non-interactive identity card. Keep the avatar, greeting, tenant name,
and current date, then show `Chưa có nơi ở đang hoạt động.` as the residence
state. Do not render room, rent, dates, role, or navigation affordance.

### Roommate

Render the `Người ở cùng` chip beside the room title and show the primary
tenant name in the identity footer when available.

## Interaction and Accessibility

- Continue using `PortalCard` as the interactive surface; do not add nested
  buttons or links.
- Preserve the card's keyboard focus, hover, active, and reduced-motion
  behavior.
- Keep the chevron decorative with `aria-hidden="true"`.
- Keep visible text as the accessible name/content of the card.
- No interaction depends on hover.

## Implementation Boundary

The visual composition remains inline in `app/pages/portal/index.vue`.
Extracting a new component is unnecessary because the block has one consumer
and does not introduce independent behavior.

Expected production file:

- `app/pages/portal/index.vue`

Expected verification file:

- `tests/pages/portal-home-ui.spec.ts`

No files are deleted.

## Testing and Verification

- Add source-level assertions that room information precedes the identity
  footer and that the Room Keycard retains existing roommate and navigation
  behavior.
- Verify the loading skeleton and no-contract copy remain present.
- Run the focused portal home test first.
- Run portal component/page regressions, typecheck, lint, OpenSpec validation,
  and the full test suite.
- When a runnable authenticated portal is available, inspect 320, 375, 414,
  and 768 pixel widths in both portal themes.

