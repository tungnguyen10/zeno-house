## 1. Database & Types

- [ ] 1.1 Add migration 003 additions for `contract_templates`: table already exists (migration 001) with `id`, `building_id`, `name`, `content` (NOT `content_html`), `is_default`, `created_at`, `updated_at` — no new columns needed
- [ ] 1.2 Add migration 003 additions for `contracts`: table already exists (migration 001) with `id`, `room_id`, `tenant_id`, `template_id`, `start_date`, `end_date`, `monthly_rent` (NOT `rent_amount`), `deposit_paid` (NOT `deposit_amount`), `payment_day`, `status`, `notes`, `created_at`, `updated_at`. Add via migration 003: `content_html TEXT`, `previous_contract_id UUID REFERENCES contracts(id)`, `terminated_reason TEXT`. Also extend `contract_status` enum in migration 003: add `'pending_signature'`, `'renewed'`
- [ ] 1.3 Verify existing RLS policies in migration 001 for both tables (admin all, manager scoped to own buildings)
- [ ] 1.4 Create `app/types/contracts.ts` — `Contract`, `ContractTemplate` interfaces, `ContractStatus` enum, Zod schemas
- [ ] 1.5 Fill `i18n/locales/vi/contracts.json` + `i18n/locales/en/contracts.json` with required keys (files already exist)

## 2. API Routes — Contracts

- [ ] 2.1 Create `server/api/contracts/index.get.ts` — list with status/room/tenant filters
- [ ] 2.2 Create `server/api/contracts/index.post.ts` — create contract (render template snapshot, set room to occupied if active)
- [ ] 2.3 Create `server/api/contracts/[id].get.ts` — contract detail
- [ ] 2.4 Create `server/api/contracts/[id].put.ts` — update contract (enforce status transitions)
- [ ] 2.5 Create `server/api/contracts/[id].delete.ts` — delete draft contracts only
- [ ] 2.6 Create `server/api/contracts/[id]/renew.post.ts` — create renewal contract
- [ ] 2.7 Create `server/api/contracts/[id]/terminate.post.ts` — terminate + free room

## 3. API Routes — Templates

- [ ] 3.1 Create `server/api/contract-templates/index.get.ts`
- [ ] 3.2 Create `server/api/contract-templates/index.post.ts`
- [ ] 3.3 Create `server/api/contract-templates/[id].put.ts`
- [ ] 3.4 Create `server/api/contract-templates/[id].delete.ts`

## 4. Composable

- [ ] 4.1 Create `app/composables/useContracts.ts` — full CRUD, `generateFromTemplate(templateId, data)`, `renewContract(id)`, `terminateContract(id, reason)`, `getExpiringContracts(days)`

## 5. Components

- [ ] 5.1 Create `app/components/features/contract/StatusBadge.vue`
- [ ] 5.2 Create `app/components/features/contract/Card.vue` — status, tenant name, room, dates, expiry warning
- [ ] 5.3 Create `app/components/features/contract/Form.vue` — tenant select, room select, template select, start_date, end_date, monthly_rent, deposit_paid, payment_day
- [ ] 5.4 Create `app/components/features/contract/Detail.vue` — renders `content_html` in sandboxed iframe, disabled PDF button
- [ ] 5.5 Create `app/components/features/contract/TemplateEditor.vue` — textarea + live preview pane with sample data
- [ ] 5.6 Create `app/components/features/contract/Preview.vue` — readonly rendered HTML view

## 6. Pages (Admin)

- [ ] 6.1 Create `app/pages/admin/contracts/index.vue` — list with expiry warnings, filter by status/room/tenant
- [ ] 6.2 Create `app/pages/admin/contracts/new.vue` — create form
- [ ] 6.3 Create `app/pages/admin/contracts/[id].vue` — detail + renew + terminate actions
- [ ] 6.4 Create `app/pages/admin/contracts/templates/index.vue` — template list
- [ ] 6.5 Create `app/pages/admin/contracts/templates/[id].vue` — template editor

## 7. Pages (Manager)

- [ ] 7.1 Create `app/pages/manager/contracts/index.vue`
- [ ] 7.2 Create `app/pages/manager/contracts/new.vue`
- [ ] 7.3 Create `app/pages/manager/contracts/[id].vue`
- [ ] 7.4 Create `app/pages/manager/contracts/templates/index.vue`
- [ ] 7.5 Create `app/pages/manager/contracts/templates/[id].vue`
