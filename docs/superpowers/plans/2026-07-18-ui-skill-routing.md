# UI Skill Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Zeno House UI task automatically follow the project design system and complete a frontend-design plus Hallmark polish workflow before handoff.

**Architecture:** Keep `AGENTS.md` as the cross-agent contract and `zeno-house` as the project router. Add one progressively loaded UI workflow reference, route Codex and GitHub Copilot to it, narrow Hallmark's standalone trigger, and remove stale UI instruction examples that conflict with the current dark operational design system.

**Tech Stack:** Markdown agent instructions, Agent Skills `SKILL.md`, YAML frontmatter, Codex repository skills, GitHub Copilot repository/path instructions.

## Global Constraints

- Do not create a separate `zeno-ui` skill.
- Explicit user requirements and Zeno House design-system rules override design skills.
- Every visual UI change uses `frontend-design` for judgment and Hallmark for critique/polish.
- Hallmark must not create parallel themes, fonts, tokens, `tokens.css`, `design.md`, `.hallmark/*`, or CSS stamps without explicit design-system approval.
- Keep `.codex` and `.github` symlinks intact.
- Do not change application code, dependencies, or OpenSpec requirements.

---

### Task 1: Add the canonical UI polish workflow and route project agents to it

**Files:**
- Create: `.agents/skills/zeno-house/references/ui-polish-workflow.md`
- Modify: `.agents/skills/zeno-house/SKILL.md`
- Modify: `.agents/skills/zeno-house/references/context-map.md`
- Modify: `AGENTS.md`
- Modify: `docs/agent-context.md`

**Interfaces:**
- Consumes: the authority order and required workflow from `docs/superpowers/specs/2026-07-18-ui-skill-routing-design.md`.
- Produces: a canonical UI workflow reachable from every project entrypoint.

- [ ] **Step 1: Add the UI workflow reference**

Write a focused reference containing:

```markdown
# UI Polish Workflow

Use for every change that creates or modifies user-visible UI.

## Authority

User requirement -> accepted behavior -> Zeno House design system and primitives
-> frontend architecture/instructions -> frontend-design -> Hallmark -> defaults.

## Workflow

1. Classify scope and read the touched implementation.
2. Load design-system docs, applicable instructions, and existing primitives.
3. State target files and polish direction.
4. Use frontend-design for design judgment and Hallmark for critique.
5. Implement within Nuxt/Tailwind/component contracts.
6. Cover applicable interaction, data, responsive, and motion states.
7. Run functional checks, visual verification when runnable, and a final polish pass.
```

Include exact optimization escalation fields: problem, recommendation, affected surfaces, benefit, cost, fallback.

- [ ] **Step 2: Extend `zeno-house` progressive routing**

Add a `UI Work` section that requires reading `references/ui-polish-workflow.md` for pages, layouts, components, styling, visual states, responsive behavior, accessibility presentation, UI copy, and design-system work. Require relevant references from `frontend-design` and Hallmark to be read automatically rather than loading their entire reference trees.

- [ ] **Step 3: Update cross-agent entrypoints**

Add an `UI Quality Gate` to `AGENTS.md` with the authority order, required skills, no-first-pass-shortcuts rule, Hallmark restrictions, and visual verification expectation. Update the UI rows in `context-map.md` and `docs/agent-context.md` to point to the new workflow.

- [ ] **Step 4: Remove stale OpenSpec snapshot from the context map**

Replace the dated active-change counts with a dynamic instruction to run:

```bash
openspec list --json
openspec list --specs
```

- [ ] **Step 5: Validate Task 1**

Run:

```bash
test -f .agents/skills/zeno-house/references/ui-polish-workflow.md
rg -n "ui-polish-workflow|frontend-design|Hallmark|design system" \
  AGENTS.md .agents/skills/zeno-house docs/agent-context.md
git diff --check
```

Expected: the file exists, every router names the workflow/skills, and `git diff --check` exits 0.

- [ ] **Step 6: Commit Task 1**

```bash
git add AGENTS.md .agents/skills/zeno-house docs/agent-context.md
git commit -m "docs: route UI work through polish skills"
```

---

### Task 2: Align GitHub Copilot and Hallmark invocation behavior

**Files:**
- Modify: `.github/copilot-instructions.md`
- Modify: `.agents/skills/hallmark/SKILL.md`
- Modify: `docs/architecture/frontend.md`

**Interfaces:**
- Consumes: canonical workflow from Task 1.
- Produces: cross-platform discovery guidance and a Hallmark role that cannot silently override Zeno House.

- [ ] **Step 1: Add a thin Copilot UI route**

Keep `.github/copilot-instructions.md` concise. Add one rule requiring all user-visible UI work to follow `AGENTS.md` and `.agents/skills/zeno-house/references/ui-polish-workflow.md`, using `frontend-design` and Hallmark without bypassing the design system.

- [ ] **Step 2: Narrow Hallmark metadata**

Change only Hallmark's frontmatter description so implicit matching is restricted to explicit Hallmark verbs and the Zeno House UI workflow:

```yaml
description: Use when explicitly asked for Hallmark audit, redesign, or study, or when the Zeno House UI polish workflow requires anti-slop critique for user-visible UI work.
```

Do not rewrite the vendored Hallmark body.

- [ ] **Step 3: Document the frontend skill gate**

Add a `UI Polish Workflow` subsection to `docs/architecture/frontend.md` that states design-system precedence, automatic use of both design skills, first-pass polish expectations, and the requirement to surface material optimizations for user decision.

- [ ] **Step 4: Validate Task 2**

Run:

```bash
sed -n '1,8p' .agents/skills/hallmark/SKILL.md
rg -n "ui-polish-workflow|frontend-design|Hallmark" \
  .github/copilot-instructions.md docs/architecture/frontend.md
git diff --check
```

Expected: Hallmark metadata is narrow, both platform routes name the workflow, and diff check exits 0.

- [ ] **Step 5: Commit Task 2**

```bash
git add .github/copilot-instructions.md .agents/skills/hallmark/SKILL.md docs/architecture/frontend.md
git commit -m "docs: align UI skill invocation across agents"
```

---

### Task 3: Remove stale UI guidance and verify the complete routing system

**Files:**
- Modify: `.agents/instructions/styling.instructions.md`
- Modify: `.agents/instructions/components.instructions.md`
- Modify: `.agents/instructions/images.instructions.md`
- Modify: `docs/ui-patterns/design-system.md`

**Interfaces:**
- Consumes: current tokens and primitive contracts from `docs/ui-patterns/design-system.md` and `tailwind.config.ts`.
- Produces: path-specific instructions consistent with the canonical dark operational UI.

- [ ] **Step 1: Rewrite stale styling examples**

Replace misleading light/blue examples with current roles:

```text
bg-dark, bg-dark-card, bg-dark-surface, bg-dark-hover,
border-dark-border, text-white, text-muted, text-cyan
```

Require existing tokens/primitives before adding CSS or tokens. Add a short pointer to the canonical UI workflow; do not duplicate the full workflow.

- [ ] **Step 2: Align component and image examples**

Replace admin-shell examples that use `text-gray-*`, `bg-blue-*`, `text-body`, or other legacy light tokens. Preserve generic architecture, icon, and accessibility rules.

- [ ] **Step 3: Record the skill authority in the design-system source**

Add a concise `Agent UI quality` section stating that skills improve execution but cannot override tokens, typography, density, primitives, status mapping, or icon conventions. Link to the canonical UI workflow.

- [ ] **Step 4: Run skill validation**

Run:

```bash
python3 /Users/thanhtung.nguyen/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/zeno-house
python3 /Users/thanhtung.nguyen/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/hallmark
```

Expected: both skills report valid structure/frontmatter.

- [ ] **Step 5: Run cross-platform and stale-guidance checks**

Run:

```bash
test "$(readlink .codex/skills)" = "../.agents/skills"
test "$(readlink .github/skills)" = "../.agents/skills"
test "$(readlink .github/instructions)" = "../.agents/instructions"
cmp .agents/skills/zeno-house/SKILL.md .codex/skills/zeno-house/SKILL.md
cmp .agents/skills/zeno-house/SKILL.md .github/skills/zeno-house/SKILL.md
rg -n "ui-polish-workflow" AGENTS.md .github/copilot-instructions.md \
  .agents/skills/zeno-house docs/agent-context.md docs/architecture/frontend.md \
  docs/ui-patterns/design-system.md
```

Expected: every `test` and `cmp` exits 0 and all canonical routes are listed.

- [ ] **Step 6: Scan applicable UI instructions for known stale admin examples**

Run:

```bash
rg -n "bg-white|bg-blue-600|text-gray-[0-9]+|text-body" \
  .agents/instructions/styling.instructions.md \
  .agents/instructions/components.instructions.md \
  .agents/instructions/images.instructions.md
```

Expected: no matches in active admin-shell examples. Any intentionally retained negative example must be explicitly labelled forbidden and use wording that cannot be copied as a recommendation.

- [ ] **Step 7: Final documentation verification**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only the planned guidance files and this plan are changed.

- [ ] **Step 8: Commit Task 3**

```bash
git add .agents/instructions docs/ui-patterns/design-system.md \
  docs/superpowers/plans/2026-07-18-ui-skill-routing.md
git commit -m "docs: enforce polished design-system UI guidance"
```
