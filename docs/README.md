# Zeno House Docs

This directory contains source-of-truth engineering docs for the current Zeno House codebase.

## Start Here

- Agent context map: [agent-context.md](agent-context.md)
- Project status: [project-status.md](project-status.md)
- Architecture rules: [architecture/rules.md](architecture/rules.md)
- Local setup: [development/local-setup.md](development/local-setup.md)
- Testing: [development/testing.md](development/testing.md)
- Operational design system: [ui-patterns/design-system.md](ui-patterns/design-system.md)

## Architecture Docs

- Frontend architecture: [architecture/frontend.md](architecture/frontend.md)
- API reference: [architecture/api.md](architecture/api.md)
- Database and migrations: [architecture/database.md](architecture/database.md)
- Auth and permissions: [architecture/auth-permissions.md](architecture/auth-permissions.md)

## Feature Docs

- Billing and monthly operations: [features/billing.md](features/billing.md)
- Contracts and occupancy: [features/contracts.md](features/contracts.md)
- Property operations: [features/property-operations.md](features/property-operations.md)
- Services and meter readings: [features/services-meter-readings.md](features/services-meter-readings.md)
- Change workflow: [development/change-workflow.md](development/change-workflow.md)

## OpenSpec

OpenSpec specs live in `openspec/specs/**`. Archived implementation changes live in `openspec/changes/archive/**`. Use those files for requirement-level history; use this `docs/**` tree for source-level operating guidance.

When an implementation changes behavior, update the accepted OpenSpec capability spec and the relevant developer doc in the same change. Archived changes are historical context, not an automatic source to replay into main specs.
