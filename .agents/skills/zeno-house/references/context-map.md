# Zeno House Context Map

Load this reference only when project orientation or file routing is needed.

## First Reads

- Always start with `AGENTS.md` and `docs/agent-context.md`.
- Use `read knowledge/changes/index.md` before assuming active OKF changes.
- Use `validate OKF YAML frontmatter and links` after editing accepted specs.

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
| Billing | `docs/features/billing.md`, `knowledge/capabilities/billing-*`, `server/services/billing/**` |
| Contracts | `docs/features/contracts.md`, `knowledge/capabilities/contracts-*`, `server/services/contracts/**` |
| Property operations | `docs/features/property-operations.md`, `buildings-*`, `rooms-*`, `tenants-*` specs |
| Services/meters | `docs/features/services-meter-readings.md`, `meter-readings-api`, service specs |
| OKF workflow | `knowledge/workflow.md`, Superpowers implementation/verification skills |

## Source Order

1. Code is final truth when docs are stale.
2. `knowledge/capabilities/**` is accepted requirement truth.
3. Active `knowledge/changes/<name>/**` is planned/in-progress behavior.
4. `docs/**` is current engineering guidance.
5. `knowledge/history/**` is historical context only.

## Current OKF State

Consult `knowledge/changes/index.md` for active work and `knowledge/capabilities/index.md` for accepted requirements. No legacy specification CLI required.

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

- Archived deltas in `knowledge/history/**` are historical and may be superseded.
- Verify accepted specs against implementation before assuming deployment.
- Do not hand-edit `app/types/database.types.ts`.
- Do not use `meter_devices` as current design; readings are room+meter-type scoped.
- Do not assume managers have owner-wide access; verify scope utilities, active changes and accepted requirements.
