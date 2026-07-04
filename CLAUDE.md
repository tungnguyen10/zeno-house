# Zeno House Claude Context

Use checked-in project context and treat AGENTS.md as the canonical rule source.

## First Reads

1. AGENTS.md
2. docs/agent-context.md
3. The single architecture/feature/OpenSpec file that matches the task

## Context Budget

- Work delta-first: start from openspec/changes/<active-change>/tasks.md.
- Read one matching capability spec in openspec/specs/**; do not scan all specs unless requested.
- Keep scope to one checklist task at a time.
- Avoid broad repo scans when focused reads are sufficient.

## Rule Ownership

- Repository rules, non-negotiables, and validation commands are owned by AGENTS.md.
- Deep architecture guidance lives in docs/agent-context.md and docs/architecture/**.
- Requirement truth lives in openspec/specs/** and active implementation scope in openspec/changes/**.
