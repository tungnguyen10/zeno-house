# Change Workflow

Zeno House uses OpenSpec for structured product and architecture changes.

## Where Specs Live

- Current specs: `openspec/specs/**`
- Archived changes: `openspec/changes/archive/**`
- OpenSpec config: `openspec/config.yaml`

There are currently no active changes in `openspec/changes`.

## When To Use OpenSpec

Use OpenSpec when a change affects:

- product behavior
- data model
- API contracts
- business rules
- permissions
- multi-file workflows
- billing or financial behavior

Small docs-only fixes and tiny implementation corrections do not always need a proposal, but keep specs updated when behavior changes.

## Typical Flow

1. Explore the problem and read the current code/specs.
2. Create or update an OpenSpec change with proposal, design, specs, and tasks.
3. Implement code against the accepted artifacts.
4. Verify implementation against tasks and specs.
5. Archive the change after completion.

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

## Verification

Before considering a change complete:

```bash
npm run lint
npm run typecheck
npm test
```

For database changes, also verify migrations and regenerate database types when schema changes.
