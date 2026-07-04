# Zeno House Instructions

Use checked-in project context and treat `AGENTS.md` as the canonical rule source.

## First Reads

1. `AGENTS.md`
2. `docs/agent-context.md`
3. The one architecture, feature, or OpenSpec file that matches the task.

## Context Budget

- Work delta-first: read the active `openspec/changes/<change-id>/tasks.md` before broader specs.
- Read only one matching capability spec under `openspec/specs/**` unless the task is explicitly cross-capability.
- Avoid full-repo doc scans; pull only files needed for the current checklist item.

## Rule Ownership

- Repository rules, non-negotiables, and verification commands are owned by `AGENTS.md`.
- Architecture details live in `docs/**`.
- Requirement truth lives in `openspec/specs/**` and active tasks in `openspec/changes/**`.
