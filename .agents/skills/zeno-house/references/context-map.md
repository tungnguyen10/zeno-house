# Zeno House Context Map

Load this reference only when project orientation or file routing is needed.

## First Reads

- Always start with `AGENTS.md` and `docs/agent-context.md`.
- Use `openspec list --json` before assuming active OpenSpec changes.
- Use `openspec validate --specs` after editing accepted specs.

## Read By Task

| Task | Read |
| --- | --- |
| Architecture rule | `docs/architecture/rules.md` |
| Frontend/UI | `references/ui-polish-workflow.md`, `docs/architecture/frontend.md`, `docs/ui-patterns/design-system.md`; use `frontend-design` + Hallmark |
| Component conventions | `.agents/instructions/components.instructions.md` |
| Composables | `.agents/instructions/composables.instructions.md` |
| Forms/validators | `.agents/instructions/forms.instructions.md` |
| Server/API | `docs/architecture/api.md`, `.agents/instructions/server-api.instructions.md` |
| Database/Supabase | `docs/architecture/database.md`, `.agents/instructions/database-schema.instructions.md`, `.agents/instructions/supabase.instructions.md` |
| Auth/permissions | `docs/architecture/auth-permissions.md`, `server/utils/permissions.ts`, `server/utils/scope.ts` |
| Billing | `docs/features/billing.md`, `openspec/specs/billing-*`, `server/services/billing/**` |
| Contracts | `docs/features/contracts.md`, `openspec/specs/contracts-*`, `server/services/contracts/**` |
| Property operations | `docs/features/property-operations.md`, `buildings-*`, `rooms-*`, `tenants-*` specs |
| Services/meters | `docs/features/services-meter-readings.md`, `meter-readings-api`, service specs |
| OpenSpec workflow | `docs/development/change-workflow.md`, matching `.agents/skills/openspec-*` skill |

## Source Order

1. Code is final truth when docs are stale.
2. `openspec/specs/**` is accepted requirement truth.
3. Active `openspec/changes/<name>/**` is planned/in-progress behavior.
4. `docs/**` is current engineering guidance.
5. `openspec/changes/archive/**` is historical context only.

## Current OpenSpec State

Do not store active-change names or inventory counts here; they drift. Refresh the current state with:

```bash
openspec list --json
openspec list --specs
```

## Common Source Areas

- Pages: `app/pages/**`
- UI primitives: `app/components/ui/**`
- Domain components: `app/components/<domain>/**`
- App shell: `app/components/app/**`
- Composables: `app/composables/**`
- DTOs: `app/types/**`
- Validators: `app/utils/validators/**`
- Mappers: `app/utils/mappers/**`
- Route helpers: `app/utils/routes/operational.ts`
- API handlers: `server/api/**`
- Services: `server/services/**`
- Repositories: `server/repositories/**`
- Auth/permissions/scope: `server/utils/**`, `server/middleware/01.auth.ts`
- Migrations/seeds: `supabase/migrations/**`, `supabase/seeds/**`
- Tests: `tests/**`

## Stale Context Warnings

- Do not sync archived OpenSpec deltas into main specs without checking later accepted specs.
- Do not trust inventory counts in prose unless recently refreshed.
- Do not edit `app/types/database.types.ts` manually.
- Do not use `meter_devices` as current design; readings are room+meter-type scoped.
- Do not assume managers have owner-wide access; check current accepted specs, active changes, and permission utilities.
