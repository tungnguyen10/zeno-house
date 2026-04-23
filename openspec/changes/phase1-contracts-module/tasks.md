## 1. Database & Types

- [ ] 1.1 Create Supabase migration: `contract_templates` table (`id`, `name`, `content_html`, `created_by`, `created_at`)
- [ ] 1.2 Create Supabase migration: `contracts` table (`id`, `tenant_id`, `room_id`, `template_id`, `content_html`, `status`, `start_date`, `end_date`, `rent_amount`, `deposit_amount`, `previous_contract_id`, `terminated_reason`, `created_at`)
- [ ] 1.3 Add RLS policies for both tables (admin all, manager scoped to own buildings)
- [ ] 1.4 Create `app/types/contracts.ts` — `Contract`, `ContractTemplate` interfaces, `ContractStatus` enum, Zod schemas
- [ ] 1.5 Create `locales/vi/contracts.json` + `locales/en/contracts.json`

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
- [ ] 5.3 Create `app/components/features/contract/Form.vue` — tenant select, room select, template select, dates, amounts
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
