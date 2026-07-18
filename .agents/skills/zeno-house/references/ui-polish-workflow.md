# UI Polish Workflow

Use this workflow for every change that creates or modifies user-visible UI in `app/app.vue`, `app/layouts/**`, `app/pages/**`, `app/components/**`, or shared UI styling.

## Authority

Resolve UI decisions in this order:

1. Explicit user requirements
2. Accepted requirements and current product behavior
3. `docs/ui-patterns/design-system.md` and existing UI primitive contracts
4. `docs/architecture/frontend.md` and applicable `.agents/instructions/**`
5. `frontend-design`
6. Hallmark
7. Model defaults

Design skills improve execution. They do not replace the Zeno House dark operational design system.

## Scope

| Change | Required depth |
| --- | --- |
| New page, layout, component, or visual redesign | Full design direction and polish pass |
| Existing UI with visual, responsive, accessibility, copy, or interaction-state changes | Focused design judgment and affected-state polish |
| Behavior-only change inside UI code | Preserve the current visual direction; inspect and verify affected states |
| Non-user-visible refactor | Skip this workflow |

Every user-visible change must finish polished. Scope controls exploration depth, not quality.

## Workflow

1. Read the touched implementation, `docs/architecture/frontend.md`, `docs/ui-patterns/design-system.md`, and only the path instructions that match the target files. Inspect existing primitives before proposing new markup or CSS.
2. State the intended files and one concise polish direction before editing. Preserve route behavior, permissions, information architecture, business copy intent, and component ownership unless the request changes them.
3. Use `frontend-design` for hierarchy, composition, density, interaction emphasis, and copy judgment. Read its complete `SKILL.md` before acting.
4. Use Hallmark for anti-slop critique, responsive behavior, interaction states, honest copy, restraint, and final polish. Read its complete `SKILL.md`, then load only references relevant to the current page/component and verb.
5. Implement with existing Nuxt, Tailwind, tokens, icons, and UI primitives. Do not create a parallel theme, font system, root `tokens.css`, `design.md`, `.hallmark/*`, CSS stamp, or new reusable primitive as part of ordinary UI work.
6. Cover every applicable state: loading, empty, error, default, hover, focus-visible, active, disabled, in-flight action, success, responsive layout, overflow, and reduced motion.
7. Run narrow functional checks. When a runnable UI is available, inspect representative desktop and mobile widths and fix material visual findings. Finish with a final polish pass before handoff.

## Hallmark Adaptation

For Zeno House, inherit the existing dark/cyan/Inter system and dense work-tool rhythm. Use Hallmark's critique and component/page reasoning without its standalone catalog rotation or export artifacts.

An explicit `hallmark audit`, `hallmark redesign`, or `hallmark study` request may widen the design exploration. It does not authorize a design-system change by itself. Ask before changing canonical tokens, typography, density, primitives, status semantics, icon conventions, or information architecture.

## Optimization Escalation

Proceed autonomously when current requirements and the design system determine the answer. When a material optimization needs a user decision, present:

- Problem
- Recommendation
- Affected surfaces/files
- Benefit
- Cost or migration risk
- Safe fallback

Ask one focused question only when the choice changes workflow, design-system contracts, responsive content priority, accessibility semantics with product impact, destructive interaction behavior, or the need for a reusable primitive.
