## Why

Contracts are the legal binding between tenants and rooms — they define rent amount, duration, and terms. Without contracts, invoices cannot be generated and room occupancy cannot be formally tracked.

## What Changes

- Add `/admin/contracts`, `/manager/contracts` pages: list, create, detail, template management
- Add `ContractCard.vue`, `ContractForm.vue`, `ContractDetail.vue`, `ContractStatusBadge.vue`, `ContractTemplateEditor.vue`, `ContractPreview.vue` components
- Add `useContracts()` composable with CRUD, template generation, renew, and terminate
- Add server API routes: GET/POST `/api/contracts`, GET/PUT/DELETE `/api/contracts/[id]`, POST `/api/contracts/[id]/renew`, POST `/api/contracts/[id]/terminate`
- Add contract template CRUD: GET/POST `/api/contract-templates`, PUT/DELETE `/api/contract-templates/[id]`
- Add Zod schemas and `locales/vi/contracts.json` + `locales/en/contracts.json`

## Capabilities

### New Capabilities

- `contracts-crud`: Full CRUD for contracts with status lifecycle (draft → pending_signature → active → expired/terminated/renewed)
- `contract-templates`: Reusable HTML templates with mustache-style placeholders; contracts snapshot the rendered HTML at creation time

### Modified Capabilities

*(none)*

## Impact

- `app/pages/admin/contracts/` and `app/pages/manager/contracts/` — new pages
- `app/components/features/contract/` — new components
- `app/composables/useContracts.ts` — new composable
- `app/types/contracts.ts` — new types + Zod schemas
- `server/api/contracts/` and `server/api/contract-templates/` — new API routes
- `locales/vi/contracts.json`, `locales/en/contracts.json`
- Supabase `contracts` and `contract_templates` tables (migration required)
- Depends on `phase1-tenants-module` and `phase1-rooms-module`
