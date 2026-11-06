---
type: Workflow
title: "Unified OKF and Superpowers development"
status: active
---

# Development Workflow — OKF + Superpowers

OKF is the **only specification and knowledge format**. Superpowers is the **only feature/implementation method**. `AGENTS.md` routes agents; it is not a competing workflow. Do not invoke OpenSpec CLI or its old skills/prompts.

## Sources and authority

- `knowledge/capabilities/<name>.md`: approved requirements and their WHEN/THEN scenarios; preserve granularity.
- `knowledge/changes/<slug>/`: active work. Keep a `proposal.md`, `design.md` (only if needed), `tasks.md`, and optional `specs/<capability>/spec.md` delta, all with OKF frontmatter.
- `knowledge/history/<slug>.md`: archived provenance with immutable baseline URLs; do **not** replay deltas blindly.
- `docs/superpowers/specs/**`, `docs/superpowers/plans/**`: detailed design and execution records. These must reference, never contradict, canonical OKF requirements. Preserve existing execution plans.
- `docs/**`, source and tests: runtime/engineering details and evidence.

## Change lifecycle

1. **Orient**: read `knowledge/index.md`, one matching capability and source/tests; scan active changes for conflicting scope. If details differ, record discrepancies before changing behavior.
2. **Brainstorm** (Superpowers skill, when available): explore scope and trade-offs. User-approved decisions become `knowledge/changes/<slug>/proposal.md`; do not duplicate the same requirements in a second spec system.
3. **Design/plan** (Superpowers): produce technical design and test-first tasks; put normative behavior in `knowledge/changes/<slug>/specs/**` and task checklist in `knowledge/changes/<slug>/tasks.md`. Longer step-by-step implementation plans may live in `docs/superpowers/plans/**` and link to the active OKF change.
4. **Implement** (Superpowers): apply TDD, small commits, systematic debugging and code review; maintain task checkboxes and record test results.
5. **Verify**: test relevant authorization, access scope, concurrency, financial invariants, regression, and migration/rollout separately. A completed checkbox never proves production deployment.
6. **Promote**: after acceptance, reconcile each delta into its corresponding `knowledge/capabilities/*.md` (do not blindly concatenate). Update supporting developer docs. Link evidence and mark change completed. Maintain history through Git commits and `knowledge/history/**`.

## Migration/compatibility policy

The current 97 accepted capabilities are imported without modifying requirement text. Four change bundles are *still open* at baseline regardless of checkbox counts. Original 86 archived changes (600 files) remain traceable by immutable Git links in `knowledge/history/**`. The import does not certify that every text claim matches production. Cloud SQL verification and manual visual QA remain separate gates.

## Minimum quality gate

- New or revised OKF nodes begin with YAML `---` frontmatter containing `type`.
- Keep titles, links and source provenance; avoid two authoritative copies of one rule.
- Resolve relative links and detect references to removed `openspec/**` paths.
- Run narrow tests plus `npm run typecheck`, `npm test`, `npm run lint` as needed.
- Never delete evidence or claim a migration/rollout occurred without verification.
