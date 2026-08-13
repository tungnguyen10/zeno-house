## Context

Dashboard templates currently encode appearance through `dark.*`, `white`, `muted`, cyan, and neon status Tailwind colors. More than one hundred dashboard-bound Vue files consume those values directly, while Chart.js and a few scoped styles use literal dark palette values. The tenant portal already has an independent variable-based theme and must remain unchanged; shared `Ui*` primitives are also used by dark auth surfaces.

## Goals / Non-Goals

**Goals:**

- Provide system-first, persisted light/dark theming for all `/dashboard` UI without first-paint flash.
- Keep Tailwind utilities as the component styling interface while moving color decisions to semantic CSS variables.
- Preserve operational density, typography, information architecture, status meaning, accessibility, and responsive behavior.
- Keep teleported overlays and Chart.js output synchronized with the active dashboard theme.

**Non-Goals:**

- Changing tenant portal, auth presentation, invoice print output, routes, APIs, permissions, or business behavior.
- Adding a color-mode dependency or a three-option settings UI.
- Redesigning component structure, typography, density, or status categories.

## Decisions

### Semantic Tailwind colors backed by RGB channels

Add `ui.*` and `status.*` Tailwind colors using `rgb(var(--token) / <alpha-value>)`. Dark values live at `:root`; `html[data-dashboard-theme='light']` overrides them with the approved cool operational palette. Templates use stable utilities such as `bg-ui-surface/95`, `text-ui-primary`, and `border-ui-border`, retaining Tailwind opacity modifiers without duplicating `dark:` variants.

Alternatives rejected: redefining `dark.*` would make names misleading, scoped CSS utility overrides would be specificity-sensitive, and per-element light/dark variants would duplicate hundreds of classes.

### Dashboard-only theme controller

`useDashboardTheme` owns `system | light | dark` preference, resolves media-query changes, persists explicit choices under `dashboard-theme-preference`, applies the resolved value to the document, and cleans up when the dashboard layout unmounts. It does not share state with the portal theme because the products have separate shells and existing storage contracts.

### Pre-paint bootstrap

A small inline head script checks whether the initial location is `/dashboard`, resolves stored/system preference, and sets the document attribute and `color-scheme` before styles paint. The composable adopts that resolved value during hydration. Invalid storage and unavailable browser APIs fall back safely to system/dark behavior.

### Shared primitives use dark fallback

Shared primitives migrate to semantic utilities. Their root values remain the existing dark palette, so auth retains its current appearance; only the dashboard document attribute activates light values. Portal components continue to use `--portal-*` variables.

### Theme-aware charts

`useChartTheme` derives colors from the same resolved dashboard theme and exposes reactive options/palette. Dashboard chart components consume computed values or a theme key so Chart.js redraws immediately when the user toggles.

## Risks / Trade-offs

- [Large mechanical migration can miss literal colors] → Add a source contract test and retain explicit allowlists for invoice print and purposeful overlays.
- [Document-scoped variables can leak after SPA navigation] → Dashboard layout calls `dispose()` and tests dashboard-to-auth cleanup.
- [System mode can mismatch SSR] → Pre-paint bootstrap resolves before render and hydration reads the applied attribute.
- [Subtle light borders can make controls ambiguous] → Use a separate strong border token for form-control boundaries and an accent focus ring.
- [Chart options may not react automatically] → Make palette/options computed and key chart rendering to resolved theme where the wrapper requires recreation.

## Migration Plan

1. Add tested theme resolver/runtime and semantic tokens with dark values matching current presentation.
2. Migrate shared primitives and shell, then domain/dashboard components and charts.
3. Enable the header toggle after all dashboard surfaces consume semantic tokens.
4. Run source-contract, component, full automated, and visual responsive verification.
5. Roll back by removing the toggle/bootstrap and restoring the previous classes; no persisted data or server rollback is required.

## Open Questions

None. Palette, preference behavior, dependency policy, and scope were approved before implementation.
