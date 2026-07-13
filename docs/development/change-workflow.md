# Change Workflow

Zeno House uses OpenSpec for structured product and architecture changes.

## Where Specs Live

- Current specs: `openspec/specs/**`
- Archived changes: `openspec/changes/archive/**`
- OpenSpec config: `openspec/config.yaml`

Use `openspec list --json` for the current active set. As of 2026-07-02, the active change is `add-owner-scoped-access`.

## When To Use OpenSpec

Use OpenSpec when a change affects:

- product behavior
- data model
- API contracts
- business rules
- permissions
- multi-file workflows
- billing or financial behavior
- internal AI agent behavior, tool policy, or permission boundaries

Small docs-only fixes and tiny implementation corrections do not always need a proposal, but keep specs updated when behavior changes.

Internal AI agent work should be treated as behavior work when it changes:

- tool availability or tool-call policy
- confirm-before-write rules
- role/capability or scope enforcement paths
- conversation state transitions for multi-step workflows

## Typical Flow

1. Explore the problem and read the current code/specs.
2. Create or update an OpenSpec change with proposal, design, specs, and tasks.
3. Implement code against the accepted artifacts.
4. Verify implementation against tasks and specs.
5. Archive the change after completion.

For internal AI agent changes, include explicit verification that prompt content cannot bypass server-side checks.

## Source Docs Vs OpenSpec

Use `docs/**` for current engineering guidance:

- current architecture
- current endpoint inventory
- current feature behavior
- setup and testing

Use `openspec/**` for requirement history and planned/accepted product changes.

When a change lands, update both:

- OpenSpec specs for requirements.
- `docs/**` for developer-facing operating guidance.

For internal AI agent platform changes, also update architecture/API docs for:

- runtime boundaries (model vs tool gateway vs service)
- mutation confirmation and idempotency requirements
- rollout state by domain wave (pilot vs enabled)

Do not replay archived change deltas into main specs without checking later specs and later archives. Archived deltas can be intentionally superseded by a newer change.

## Verification

Before considering a change complete:

```bash
npm run lint
npm run typecheck
npm test
```

For database changes, also verify migrations and regenerate database types when schema changes.
