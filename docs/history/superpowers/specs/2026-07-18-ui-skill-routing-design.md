# UI Skill Routing Design

## Goal

Every Zeno House UI change must ship at production-polish quality on its first implementation pass. Agents must apply the relevant design skills automatically while preserving the existing operational design system, component contracts, and frontend architecture.

## Scope

This change restructures agent guidance only. It does not change application behavior, UI code, dependencies, or OpenSpec requirements.

The affected guidance surfaces are:

- `AGENTS.md`
- `.github/copilot-instructions.md`
- `.agents/skills/zeno-house/SKILL.md`
- `.agents/skills/zeno-house/references/context-map.md`
- a new `.agents/skills/zeno-house/references/ui-polish-workflow.md`
- relevant `.agents/instructions/*.instructions.md`
- Hallmark invocation metadata or local override guidance
- `docs/agent-context.md`, `docs/architecture/frontend.md`, and `docs/ui-patterns/design-system.md`

## Architecture

Do not create a separate `zeno-ui` skill. Extend the existing `zeno-house` skill as the project router and add a progressively loaded UI workflow reference.

```text
AGENTS.md
  -> zeno-house
       -> references/ui-polish-workflow.md
       -> frontend-design
       -> hallmark
       -> Nuxt/project instructions and UI design-system docs
```

Platform discovery remains shared:

- Codex discovers repository skills directly from `.agents/skills`; `.codex/skills` remains a compatibility symlink.
- GitHub Copilot discovers `.agents/skills` and path-specific instructions through `.github/instructions`; existing symlinks remain intact.
- `AGENTS.md` is the canonical cross-agent contract.
- `.github/copilot-instructions.md` stays thin and reinforces the canonical UI route without duplicating the workflow.

## Authority Order

All UI decisions use this precedence:

1. Explicit user requirements
2. Accepted product requirements and current application behavior
3. Zeno House design system and UI primitive contracts
4. Zeno House frontend architecture and path-specific instructions
5. `frontend-design` judgment
6. Hallmark critique and anti-slop guidance
7. Model defaults

Lower layers may improve execution but must not override higher layers.

## Skill Responsibilities

### `zeno-house`

- Detect UI work and route to the UI polish workflow.
- Select the narrow project docs and instructions required by the touched files.
- Resolve conflicts using the authority order.
- Keep non-UI tasks on their existing routes.

### `frontend-design`

- Establish intentional hierarchy, composition, density, interaction emphasis, and visual signature.
- Improve clarity and distinctiveness without turning the operational app into a marketing surface.
- Work inside existing tokens, typography, and primitives unless the user approves a design-system change.

### Hallmark

- Act as the anti-slop critique, responsive, interaction-state, copy-honesty, and final polish layer.
- Use component/page scope as appropriate.
- In Zeno House, do not independently introduce catalog themes, font pairings, root `tokens.css`, `design.md`, `.hallmark/*`, CSS stamps, or parallel token systems.
- May propose a design-system optimization, but must explain the benefit, affected surfaces, migration cost, and trade-off before requesting user approval.

## Required UI Workflow

The new reference defines one workflow for every visual UI change:

1. Classify scope: visual UI, behavior-only UI, or non-UI.
2. Read the current implementation, design-system source, applicable path instructions, and existing primitives.
3. State the intended files and a concise polish direction before editing.
4. Use `frontend-design` for design judgment and Hallmark for critique; automatically read only the relevant skill references.
5. Implement inside the current Nuxt/Tailwind/component architecture.
6. Cover applicable states: loading, empty, error, default, hover, focus-visible, active, disabled, loading action, success, responsive behavior, and reduced motion.
7. Run narrow functional checks.
8. Perform a visual verification at representative desktop and mobile widths when a runnable UI is available.
9. Run a final polish pass and fix meaningful findings before handoff.

Behavior-only edits inside Vue files do not require inventing a new visual direction, but they must preserve existing polish and still be checked for affected states.

## User Decisions

Agents proceed autonomously when existing requirements and the design system determine the answer. They ask one focused question when a decision would materially change any of these:

- information architecture or workflow
- design-system tokens, typography, or primitive contracts
- destructive or high-risk interaction behavior
- responsive content priority
- accessibility semantics with product consequences
- addition of a new reusable primitive

When proposing an optimization, the agent explains the problem, recommendation, affected files/surfaces, benefit, cost, and fallback.

## Instruction Cleanup

Path-specific instructions must agree with the canonical dark operational design system. Existing examples using light surfaces, generic gray palettes, or blue primary actions will be replaced or removed where they can mislead agents.

Instructions should enforce durable constraints and link to the design system rather than duplicate its full token map. Examples must use current primitives and tokens.

## Hallmark Trigger Control

Hallmark currently overlaps with `frontend-design` and may implicitly apply its standalone greenfield defaults. The local integration will narrow Hallmark's implicit role so normal Zeno House UI work enters through `zeno-house` and the UI polish workflow.

Explicit `hallmark audit`, `hallmark redesign`, or `hallmark study` requests remain supported. Even then, Zeno House authority order applies unless the user explicitly authorizes a design-system change.

## Verification

The implementation is complete when:

- all shared symlinks still resolve;
- Codex and GitHub skill locations expose the same project skills;
- every UI route points to the canonical polish workflow;
- no guidance claims Hallmark may bypass the Zeno House design system;
- stale light-theme examples are removed from applicable admin UI instructions;
- skill metadata remains valid YAML frontmatter;
- project skill validation passes;
- documentation links resolve;
- `git diff --check` passes.

Application tests are not required unless implementation unexpectedly touches application code.
