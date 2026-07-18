---
applyTo: "app/app.vue, app/layouts/**/*.vue, app/pages/**/*.vue, app/components/**/*.vue, app/assets/scss/**/*.scss"
---

# Styling

Follow the repository UI polish workflow in `.agents/skills/zeno-house/references/ui-polish-workflow.md` and the canonical design system in `docs/ui-patterns/design-system.md` before choosing visual styles. For every user-visible UI change, use both `frontend-design` and `hallmark` at the depth required by that workflow.

The Zeno House design system wins when a skill's general aesthetic guidance conflicts with project tokens, typography, density, primitives, status mappings, or icon conventions.

## Core rules

- Use Tailwind utilities and existing semantic tokens. The admin shell is dark-first with cyan as the sole interaction accent.
- Reuse existing `Ui*` primitives before composing a new control or surface.
- Use `clsx` for conditional classes; write static classes directly in the template.
- Do not use inline styles for colors, spacing, shadows, or other design values.
- Preserve visible hover, focus, active, disabled, loading, empty, error, and responsive states that apply to the surface.
- Treat spacing, hierarchy, typography, and interaction feedback as part of correctness, not optional cleanup.

## Correct usage

Static classes:

```vue
<div class="flex items-center gap-3 rounded-xl border border-dark-border bg-dark-surface px-4 py-3 shadow-sm">
  <IconBuilding class="size-5 shrink-0 text-muted" aria-hidden="true" />
  <span class="truncate text-sm font-medium text-white">{{ building.name }}</span>
</div>
```

Conditional classes:

```vue
<script setup lang="ts">
import clsx from 'clsx'

const props = defineProps<{
  interactive?: boolean
  selected?: boolean
}>()

const panelClass = computed(() =>
  clsx(
    'rounded-xl border bg-dark-surface text-white transition-colors',
    props.interactive && 'hover:bg-dark-hover',
    props.selected
      ? 'border-cyan ring-1 ring-cyan/30'
      : 'border-dark-border',
  )
)
</script>
```

Use the existing button and status primitives instead of inventing variants:

```vue
<UiButton :loading="isSaving" :disabled="!canSave">
  Lưu thay đổi
</UiButton>

<UiStatusBadge :status="building.status" />
```

Status colors must come from `app/utils/constants/statuses.ts`. Do not map domain statuses to ad hoc palette classes in a page or component.

## Do not

- Concatenate class strings manually or use class template literals for conditional styling.
- remove a focus outline without an equivalent visible `focus-visible` treatment.
- hardcode HEX/RGB values when a repository token exists.
- create a parallel theme, typography stack, token file, primitive, or CSS stamp to satisfy generic skill output.
- repeat panel class bundles across features; use `UiSurfacePanel` or another matching primitive.
- generalize a new primitive from one isolated use without evidence that the pattern recurs.

## Custom CSS exceptions

Use scoped CSS or `app/assets/scss/main.scss` only when the behavior cannot be expressed clearly with existing Tailwind utilities, such as a browser-specific scrollbar rule, `@font-face`, or a genuinely unsupported layout property. Custom CSS still uses project variables/tokens where available and must not introduce a second visual system.

```scss
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
```

## Responsive behavior

Write mobile-first breakpoints and verify the changed surface at narrow and wide widths. Dense admin workspaces may keep desktop-oriented information architecture, but controls and reading order must remain usable on mobile.

```vue
<div
  :class="clsx(
    'fixed inset-y-0 left-0 z-50 w-64 border-r border-dark-border bg-dark-surface',
    'transition-transform duration-200',
    sidebarOpen ? 'translate-x-0' : '-translate-x-full',
    'lg:static lg:translate-x-0',
  )"
>
```

Before completion, inspect the rendered result when tooling is available. Confirm hierarchy, spacing rhythm, typography, token use, interaction states, accessibility, and responsive behavior—not only typecheck success.
