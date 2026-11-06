---
type: Historical Design
title: "2026-07-28-portal-component-showcase-design"
status: deprecated
archive_state: historical
tags: [superpowers, history, migration]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/060d0d77e07095c593b9ff154450580db8ba0f41/docs/superpowers/specs/2026-07-28-portal-component-showcase-design.md"
generated:
  by: "process:docs-okf-consolidation"
  at: "2026-11-06T00:00:00Z"
---

> Historical Superpowers design/execution record. The document is preserved for provenance and is not a second accepted specification. For current rules, use `docs/capabilities/**` and `docs/changes/**`.

# Portal Component Showcase Design

## Scope

Create a development-only portal page at `/portal/ui-showcase`. It renders the
tenant portal components with local, non-business demo data and does not change
the dashboard, portal navigation, APIs, or database.

## Access

The page uses the existing `tenant` layout so its header, theme control,
desktop rail, and mobile tab bar remain visible. Its page middleware returns a
404 outside development mode. The route is not added to `PORTAL_NAV_ITEMS`.

## Composition

The showcase is a vertically scrollable collection of sections:

- Shell navigation: the inherited header, side rail, and tab bar.
- Actions and fields: `PortalButton` and `PortalInput` in default, error,
  disabled, and loading states.
- Information: `PortalCard`, `PortalStatusBadge`, `PortalPaymentRing`, and
  `PortalIdentityImageSlot` with representative portal-safe values.
- Data feedback: `PortalSkeleton`, `PortalEmptyState`, and
  `PortalSpendingChart` with fixture invoices.
- Interactions: `PortalBottomSheet`, `PortalToastHost`, `PortalPullToRefresh`,
  and `PortalInstallPrompt`; the page controls only the bottom-sheet demo and
  uses the existing toast composable for feedback.

No component is modified solely for the showcase. The page composes existing
public props and emits, allowing it to detect visual regressions in both
MapTrack light and dark modes.

## Visual direction

The page follows the portal's MapTrack token system and remains intentionally
utility-like: compact section labels, grouped surfaces, one simple action per
demo, and no fabricated tenant metrics. It preserves 44px touch targets,
visible focus, reduced motion, and mobile overflow rules.

## Verification

- Unit test development access and production 404 behavior.
- Page test verifies that the component sections and bottom-sheet trigger
  render with fixture data.
- Run portal-focused tests, typecheck, and lint. Inspect light/dark at mobile
  and desktop widths when the local preview environment can bind a port.
