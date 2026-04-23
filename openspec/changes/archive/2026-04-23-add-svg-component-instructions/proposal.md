## Why

`nuxt-svgo` is already installed and configured with auto-import from `~/assets/icons` and component prefix `icon`, but there are no coding conventions documenting how developers should use it. Without a convention file, SVG icons get used inconsistently (inline `<img>`, raw `<svg>`, or component) and the correct usage pattern is undiscoverable.

## What Changes

- Add `instructions/svg.md` documenting SVG icon conventions for this project
- Register the new instruction file as a sub-instruction in `CLAUDE.md`

## Capabilities

### New Capabilities

- `svg-component-conventions`: Coding conventions for using SVG icons via `nuxt-svgo` — placement, naming, component usage, sizing, color, and anti-patterns

### Modified Capabilities

- `project-instructions`: `CLAUDE.md` gains a new `@instructions/svg.md` sub-instruction reference

## Impact

- `instructions/svg.md` (new file)
- `CLAUDE.md` (add one `@instructions/svg.md` line to Sub-instructions section)
- No code changes, no migrations, no new dependencies
