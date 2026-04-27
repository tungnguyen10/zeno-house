# Project Structure

## Stack

Nuxt 4 · Vue 3 · TypeScript strict · Supabase · Nuxt UI · Pinia · Zod · @nuxtjs/i18n · Vercel (SSR)

## Directory Layout

```text
zeno-house/
├── app/                        # All client-side source (Nuxt 4 convention)
│   ├── app.vue
│   ├── components/             # Presentational components only
│   ├── composables/            # useX hooks (business logic + API calls)
│   ├── layouts/
│   │   ├── admin.vue
│   │   ├── manager.vue
│   │   ├── tenant.vue
│   │   └── default.vue
│   ├── middleware/
│   │   ├── auth.ts             # Redirect unauthenticated users
│   │   └── role.ts             # Enforce role-based route access
│   ├── pages/
│   │   ├── admin/
│   │   ├── manager/
│   │   └── tenant/
│   ├── stores/                 # Pinia stores (useXStore pattern)
│   └── types/                  # Shared TS types & Zod schemas
│
├── server/
│   ├── api/                    # Nuxt server routes (REST endpoints)
│   └── utils/                  # Supabase server clients, helpers
│
├── supabase/
│   └── migrations/             # SQL migration files
│
├── locales/                    # i18n translation files (vi/, en/)
├── public/
├── nuxt.config.ts
├── CLAUDE.md
└── instructions/               # Coding conventions (this directory)
```

## File Placement Rules

| What | Where |
| --- | --- |
| Vue component | `app/components/FeatureName.vue` |
| Page | `app/pages/<role>/<feature>.vue` |
| Composable | `app/composables/useFeatureName.ts` |
| Pinia store | `app/stores/featureName.ts` |
| Shared type / Zod schema | `app/types/index.ts` or `app/types/<domain>.ts` |
| Server route | `server/api/<resource>/[method].ts` |
| Supabase client util | `server/utils/supabase.ts` |
| SQL migration | `supabase/migrations/<timestamp>_<description>.sql` |
| Translation keys | `locales/vi/<domain>.json`, `locales/en/<domain>.json` |

## Naming Conventions

- **Components**: PascalCase, descriptive — `RoomStatusBadge.vue`, `InvoiceTable.vue`
- **Composables**: camelCase with `use` prefix — `useRooms.ts`, `useInvoiceActions.ts`
- **Stores**: camelCase with `use` prefix + `Store` suffix — `useAuthStore`, `useRoomsStore`
- **Server routes**: kebab-case file name, grouped by resource — `server/api/rooms/index.get.ts`
- **Types**: PascalCase interfaces, camelCase Zod schemas — `interface Room`, `const roomSchema`
- **Domain entities**: match the database table name exactly — `buildings` (not `properties`), `rooms` (not `units`). URLs, composables, components, and i18n keys must all use the same noun as the DB table.

## Per-module Anatomy

Every domain module must include all five parts before it is considered done:

```text
<domain>/
├── app/types/<domain>.ts                  ← interfaces + Zod schemas
├── app/composables/use<Domain>.ts         ← CRUD + state (refs only)
├── app/components/features/<domain>/      ← Card, Form, Table, Select...
├── app/pages/<role>/<domain>/             ← list, new, [id]/index, [id]/edit
└── server/api/<domain>/                   ← index.get, index.post, [id].get/put/delete
```

i18n files (`locales/vi/<domain>.json`, `locales/en/<domain>.json`) are pre-created — fill keys as each module is built, never hardcode strings.

## Anti-patterns

- **DON'T** put business logic directly in pages — use composables
- **DON'T** create files outside `app/` for client code (no root-level `components/`, `pages/` etc.)
- **DON'T** put Supabase queries in components or stores — always via `server/api/`
- **DON'T** skip the role prefix in pages — every authenticated page lives under `admin/`, `manager/`, or `tenant/`
- **DON'T** use synonyms for domain entities — if the DB table is `buildings`, the route must be `/admin/buildings` not `/admin/properties`; composable must be `useBuildings`, not `useProperties`
