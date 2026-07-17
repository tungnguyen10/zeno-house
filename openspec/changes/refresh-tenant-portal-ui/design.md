## Context

The tenant portal is an isolated, light-theme, mobile-first PWA under `/portal` that renders the `tenant.vue` shell (sticky header, scrollable content, fixed bottom tab bar) and never mounts internal admin chrome. Its identity is intentionally separate from the internal dark operational theme, with tokens scoped to `.portal-shell` in `app/assets/scss/main.scss`. Data flows page → `useState`-based portal composables → `/api/tenant/**`.

Today the visual layer was decided per page: heading sizes mix `text-xl`/`text-lg`/`text-sm` without a scale, page containers alternate between `space-y-4`/`space-y-3`, `PortalCard` `padded` is toggled inconsistently, two pages hand-roll `<input>` instead of `PortalTextField`, and invoice vs request status colors overlap in meaning. Body text (`--portal-body: #6e7070`) is borderline for contrast.

This change is presentation-only. It must not touch composables, server code, routing, database, or the shell architecture, and must not add a component library or a new font (Inter only). It must keep the customer-facing identity distinct from the admin dark theme, keep Vietnamese copy correctly accented, use Tailwind + `clsx` (no inline styles), and preserve the quality floor (reduced motion, visible focus, AA-legible body text).

## Goals / Non-Goals

**Goals:**
- One deliberate "clean fintech / trustworthy statement" identity expressed as a small, named token system reused everywhere.
- An explicit portal type scale and a distinctive money/statement treatment as the signature element.
- Consistent spacing rhythm, card padding, radius, and elevation across all portal components and pages.
- A single form-field primitive (`PortalTextField`) and a single status→style source of truth for badges.
- Refreshed identity applied to all six portal pages with correct loading/empty/error/data states.

**Non-Goals:**
- No changes to data fetching, composables, server APIs, routing, or the `tenant.vue` shell structure.
- No new component library, no new web font, no admin dark-theme changes.
- No database or schema changes.
- No new portal features or pages.

## Decisions

### D1 — Keep tokens scoped to `.portal-shell`; refine values in place
Portal tokens already live as CSS variables under `.portal-shell` and are mapped to existing Tailwind aliases (`text-title`, `text-body`, `bg-smoke`, `border-border-light`, `text-theme`). We refine the variable values and add missing semantic tokens rather than renaming aliases, so component churn stays low and the identity cannot leak into the admin theme.
- Palette: ink/title `#0B1422`; body raised to `#5B6472`; new muted `#8A93A3`; primary `#1554F0` with soft `#EAF0FF`; surface `#FFFFFF`; canvas cooled to `#F4F6FB`; border `#E6E9EF`; positive `#0E9F6E`; warning `#B7791F`; danger `#E02424`.
- Alternatives: (a) full token rename to `--portal-*` semantic names everywhere — rejected as high-churn for little gain; (b) Tailwind theme extension only — rejected because runtime CSS vars already exist and scope the identity cleanly.

### D2 — Explicit type scale + money treatment as portal utilities
Add a small set of portal-scoped utility classes for the type scale and the money treatment where Tailwind cannot express them (feature settings / tabular numerals / tracking); everything else stays as Tailwind utility classes in templates.
- Money treatment: `font-variant-numeric: tabular-nums`, tightened tracking, currency unit rendered smaller/muted, balance colored by status. This is the signature and is the reason for a dedicated utility rather than scattered inline classes.
- Alternative: a `PortalAmount` component — deferred; a utility-class treatment plus the existing `PortalCard` composition covers the 3 usages without adding a primitive for a single visual concern. If a fourth distinct usage appears, promote to a component.

### D3 — "Statement" signature via `PortalCard` variant, not a new component
Add an optional `accent`/`tone` prop to `PortalCard` that renders a thin (3px) status-colored hairline (emerald=paid, amber=due, red=overdue). Reused on Home hero, invoice list rows, and invoice detail summary.
- Rationale: the hairline encodes real financial status (structure is information), stays quiet, and avoids heavy bands/gradients that read as templated.
- Alternative: per-page bespoke markup — rejected for inconsistency; a heavy colored band/gradient — rejected as noisy.

### D4 — Single form primitive and single status map
Route the profile edit and request-create forms through `PortalTextField`, and drive both invoice and request badges from one status→style map so "paid/resolved" = positive, "overdue" = danger, "pending/partial" = warning/accent consistently.
- Rationale: removes duplicated inline `<input>` and conflicting color semantics; aligns with the codebase rule to reuse primitives.
- Alternative: keep per-page inputs — rejected; it is the main source of the current inconsistency.

### D5 — Standardized rhythm and elevation
Adopt one page rhythm (`px-4 py-5`, section `space-y-5`, in-section `space-y-3`), standard card `p-4`, card radius `rounded-2xl`, control radius `rounded-xl`, pill `rounded-full`, and only two elevation levels (resting subtle `shadow-sm`, raised for sheets). Replace inconsistent `padded={false}` + manual per-item padding in invoice detail/room with divider-separated key-value rows (no nested-card clutter).

## Risks / Trade-offs

- [Token value changes ripple to any admin surface that shares an alias like `text-title`/`bg-smoke`] → Values are set on `.portal-shell` scope only; verify no admin page depends on the portal-scoped overrides and run the full test suite + typecheck.
- [Contrast/legibility regressions from new colors] → Check body/muted against surfaces for WCAG AA before finalizing; body bumped specifically to improve this.
- [Skeletons drift from refreshed layouts causing layout shift] → Update `PortalSkeleton` usages alongside each page so placeholder shapes match final content.
- [Visual regressions across six pages] → Manual browser pass at `/portal` covering loading/empty/error/data on each page, mobile viewport, safe areas, and reduced-motion; keep changes utility-first so diffs stay reviewable.
- [Over-engineering by extracting premature primitives] → Explicitly defer `PortalAmount`; only promote to a component at a fourth distinct usage.

## Migration Plan

Presentation-only; ship as a single change. Rollback is a straight revert of the touched SCSS/Tailwind/component/page files with no data or API implications.

## Open Questions

None outstanding — design direction (primary `#1554F0`, status hairline signature, Inter-only + tabular numerals) is decided.
