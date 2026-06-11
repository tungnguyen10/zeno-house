## Context

The archived `operational-design-system` change created the design-system contract and implemented the first UI primitive set. The current source scan shows the system is useful but not fully adopted:

- `app/components/ui/` contains the expected foundation primitives.
- Existing screens still contain raw `input`, `select`, `textarea`, `button`, and `table` markup outside primitives.
- Current primitives do not cover two recurring needs:
  - searchable subject selection for rooms/tenants;
  - compact controls for editable table cells.
- Page-level consistency is uneven: `/rooms` and `/ui-showcase` are close to the new pattern, while most list/detail/create/edit pages still use hand-written headers, sections, error blocks, and filters.
- `/billing` is still a placeholder and should not become the model for monthly operations unless it is brought under the system or replaced by the workspace change.

This change is intentionally UI-only. It should make the existing UI foundation reliable before implementation of `monthly-operations-workspace` continues.

## Goals / Non-Goals

**Goals:**

- Close the primitive gaps discovered during source scan.
- Make primitive adoption enforceable through specs and tasks, not tribal memory.
- Migrate existing high-risk raw UI surfaces:
  - searchable selectors;
  - editable tables;
  - raw page/API error boxes;
  - ad-hoc page sections and toolbars;
  - raw select/textarea controls in domain forms.
- Keep billing implementation unblocked by ensuring `/billing` and future billing workspace screens have the needed primitive vocabulary.
- Preserve current domain behavior while changing presentation structure.

**Non-Goals:**

- No Supabase schema changes.
- No domain model or API behavior changes.
- No monthly billing data model implementation.
- No new third-party component library.
- No light mode.
- No broad product redesign beyond adopting the existing operational dark UI system.

## Decisions

### Decision: Add a dedicated searchable selection primitive

Create `UiCombobox` or `UiSearchSelect` rather than leaving each form to implement room/tenant search markup.

Rationale:

- `ContractForm.vue` and `ContractOccupantForm.vue` both need searchable entity selection with label, required, disabled/loading, empty, error, and selected-option behavior.
- Billing will also need searchable subject/context selection for buildings, rooms, tenants, contracts, or invoices.
- A standard primitive gives consistent keyboard/focus/error behavior and keeps domain forms from copying dropdown classes.

Alternative considered: use `UiInput` plus custom list per form. Rejected because it preserves the current duplication and makes accessibility/focus behavior inconsistent.

### Decision: Extend existing controls with density instead of creating table-only input components

Add `size` or `density` support to `UiInput`, `UiSelect`, and `UiTextarea` with at least normal and compact modes.

Rationale:

- Existing table/matrix components require small numeric inputs and selects.
- A density prop lets tables use the same primitive styling and validation behavior without bloating the primitive catalog.
- Future billing charge review and meter-reading tables will need dense editable controls.

Alternative considered: create `UiInlineNumberInput`. Rejected for now because compact density on the existing primitive is more flexible and covers text, number, select, and textarea variants.

### Decision: Migrate in dependency order

Implementation should first harden primitives, then migrate domain components, then migrate pages.

Rationale:

- Migrating pages before primitive gaps are closed would force more ad-hoc wrappers.
- Component migration reduces repeated UI debt before page-level layout work.
- Page migration can then be mostly composition from stable primitives.

### Decision: Treat `/billing` as a design-system gate, not a full billing implementation

This change should either clean the existing `/billing` placeholder with primitives or replace it with a primitive-backed entry shell that can be safely superseded by `monthly-operations-workspace`.

Rationale:

- The monthly billing workspace owns billing domain behavior.
- This change only ensures the route does not keep raw UI patterns that future billing code copies.

### Decision: Verification must include source scans

Use source scans for raw controls, tables, and error blocks as part of completion.

Rationale:

- The problem was found by scan, so the same scan should guard against omissions.
- Some raw controls may be legitimate inside primitives or special shell internals; the implementer should document any accepted exceptions instead of silently ignoring them.

## Risks / Trade-offs

- Searchable select accessibility could grow complex -> keep the first version pragmatic but ensure label, focus, disabled, loading, empty, error, and keyboard selection behavior are covered enough for current forms.
- Migrating many pages can introduce regressions -> preserve existing composables and event handlers; change layout/control components without changing business logic.
- Raw table migration can be noisy -> migrate the highest-value editable tables first and record justified exceptions.
- `UiSection` overuse can create card-in-card layouts -> use it for page sections, not nested decorative wrappers.
- Billing placeholder cleanup could duplicate later billing work -> keep it thin and primitive-backed, or explicitly replace it during `monthly-operations-workspace`.

## Migration Plan

1. Harden primitives:
   - add compact density to `UiInput`, `UiSelect`, `UiTextarea`;
   - add searchable select primitive;
   - confirm `UiButton iconOnly` covers shell/row actions;
   - update `ui-showcase`.
2. Migrate shared/domain components:
   - forms;
   - searchable selectors;
   - editable table cells;
   - service/meter/contract tables.
3. Migrate pages:
   - list pages;
   - create/edit pages;
   - detail/settings pages;
   - raw error/loading/empty states.
4. Normalize `/billing` placeholder or replace it with the primitive-backed billing entry shell.
5. Run validation:
   - OpenSpec strict validation;
   - lint/type/test commands available in the repo;
   - raw UI scan with documented exceptions;
   - visual review of `/ui-showcase` and representative pages.

## Open Questions

- Name choice: prefer `UiCombobox` if it behaves like a selectable input, or `UiSearchSelect` if the implementation is intentionally simpler and domain-oriented.
- Drawer timing: `UiDrawer` is not required for this cleanup unless the billing correction flow starts during the same implementation window.
