## Context

`nuxt-svgo` v4 is already installed and configured:
- `autoImportPath: "~/assets/icons"` — all SVGs under `app/assets/icons/` are auto-imported as Vue components
- `componentPrefix: "icon"` — a file `app/assets/icons/search.svg` becomes `<IconSearch />`

62 SVG icon files exist in `app/assets/icons/`. There is no instruction file documenting how to use them, so usage conventions must be inferred from the library docs rather than project conventions. `instructions/` already has files for components, composables, stores, styling, etc. — SVG is the only missing topic.

## Goals / Non-Goals

**Goals:**
- Document the conventions for placing, naming, and using SVG icons in this project
- Reference `CLAUDE.md` so AI codegen and developers always apply the conventions

**Non-Goals:**
- Change how `nuxt-svgo` is configured in `nuxt.config.ts`
- Add or remove SVG files from `app/assets/icons/`
- Support SVG outside of the icon use-case (e.g., full-page illustrations embedded inline)

## Decisions

### 1. Single source of truth: `app/assets/icons/`

All SVG icons live in `app/assets/icons/`. No subdirectories — `nuxt-svgo` auto-import is configured at the root of that path, so nested files would require manual import.

### 2. Component naming follows nuxt-svgo prefix convention

File `app/assets/icons/<name>.svg` → component `<Icon<PascalCase(name)> />`.  
Examples: `search.svg` → `<IconSearch />`, `chevron-down.svg` → `<IconChevronDown />`.  
This is enforced by `nuxt-svgo` automatically — no extra config needed.

### 3. Sizing via Tailwind `size-*` or `w-* h-*`

SVGs rendered as Vue components accept `class`. Use Tailwind size utilities (`size-4`, `w-5 h-5`) for consistent sizing. Avoid inline `width`/`height` HTML attributes.

### 4. Color via `currentColor`

Icons should use `currentColor` for strokes/fills so that Tailwind text color utilities (`text-primary`, `text-gray-500`) propagate naturally. When adding new SVG files, ensure they use `currentColor` rather than hardcoded hex.

### 5. No raw `<img>` or `<svg>` for icons

Inline `<img src="...svg">` loses theming and accessibility. Raw copy-pasted `<svg>` markup is unmanageable at scale. Always use the auto-imported component.

## Risks / Trade-offs

- **nuxt-svgo flat structure limitation**: Nested subdirectories under `app/assets/icons/` are not supported by current config. If the icon library grows very large (>200 icons), a flat directory becomes unwieldy. → Mitigation: acceptable for now; revisit if icon count grows significantly.
- **currentColor dependency**: Icons that ship with hardcoded colors (e.g., brand SVGs) need manual editing to use `currentColor`, or they should be placed outside `app/assets/icons/` and used via `<img>`. → Document this edge case in the instruction file.
