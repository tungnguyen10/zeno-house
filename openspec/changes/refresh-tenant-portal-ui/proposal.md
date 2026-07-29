## Why

The tenant portal works but reads as a set of loosely coordinated screens: typography sizing, page spacing, card padding, form controls, and status colors were each decided per page, so the experience lacks a single confident identity. For a customer-facing product where the core moment is "how much do I owe and is it paid", the presentation should feel like a calm, trustworthy fintech statement rather than a generic web card list. This change gives the portal one deliberate visual identity and removes the accumulated inconsistencies before more portal features are added on top.

## What Changes

- Refine the portal design tokens scoped to `.portal-shell` (color, text contrast, elevation, radius) toward a "clean fintech / trustworthy statement" direction. Primary accent moves to a more confident blue (`#1554F0`), body text contrast is raised, and the canvas cools slightly.
- Establish an explicit portal type scale (display / heading / label / body / caption) and a dedicated money-display treatment (tabular numerals, tightened tracking, muted currency unit, status-colored balance) reused across screens. No new font is added — Inter only.
- Introduce a reusable "statement" amount presentation with a thin status-colored hairline accent (paid / due / overdue) as the portal's signature element, used on the Home hero, the invoices list rows, and the invoice detail summary.
- Normalize spacing rhythm, card padding, radius, and elevation across all portal components and pages.
- Unify form input UX on the shared `PortalInput` (replace ad-hoc inline `<input>` usage in the profile and requests forms) and unify invoice/request status badges through a single status→style map.
- Refine shared components (`PortalCard`, `PortalButton`, `PortalEmptyState`, `PortalSkeleton`, `PortalHeader`, `PortalTabBar`) and apply the refreshed identity to all six portal pages (overview, invoices list, invoice detail, room, requests, profile).
- Redesign the profile as a complete identity-first personal dossier and move self-service editing to `/portal/profile/edit`, with changed-only whitelist submission and guarded unsaved navigation.
- Tighten motion, focus-visible affordances, and text contrast to keep the quality floor (reduced-motion respected, visible keyboard focus, AA-legible body text).

The profile route gains one dedicated edit child route and focused client-side form/leave-guard helpers. Existing `/api/tenant/**` contracts, server ownership, storage conventions, permissions, database schema, and shell architecture remain unchanged.

## Capabilities

### New Capabilities
<!-- None. This is a presentation refresh of an existing capability. -->

### Modified Capabilities
- `tenant-portal-ui`: Sharpen the "Distinct customer-facing identity" requirement into a concrete portal design-system contract (token roles, type scale, money/statement treatment, unified form control and status-badge semantics, spacing/radius/elevation consistency) while preserving the existing shell, touch-first, and API-consumption requirements.

## Impact

- Styling/tokens: `app/assets/scss/main.scss` (`.portal-shell` tokens, type-scale/money utilities, transitions), `tailwind.config.ts` (color aliases only; generated `app/types/database.types.ts` untouched).
- Shared components: `app/components/portal/**` (`PortalCard`, `PortalButton`, `PortalInput`, `PortalChip`, `PortalInvoiceStatusBadge`, `PortalEmptyState`, `PortalSkeleton`, `PortalHeader`, `PortalTabBar`).
- Pages: `app/pages/portal/index.vue`, `app/pages/portal/invoices/index.vue`, `app/pages/portal/invoices/[id].vue`, `app/pages/portal/room.vue`, `app/pages/portal/requests.vue`, `app/pages/portal/profile.vue`, `app/pages/portal/profile/edit.vue`.
- Profile client helpers: `app/utils/portal-profile.ts`, `app/composables/tenant-portal/usePortalUnsavedChanges.ts`, and `app/components/portal/PortalProfileDossier.vue`.
- No changes to `server/**`, database schema, API contracts, permissions, or the `tenant.vue` shell structure.
- Risk: visual and profile-workflow regression; verified via focused form/guard tests, typecheck, portal component/page tests, lint, OpenSpec validation, and a manual pass with mobile safe areas and reduced motion.
