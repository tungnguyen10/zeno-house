# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**zeno-house** — Hệ thống quản lý nhà trọ (Rental Property Management System)

- UI language: **Multilingual** (Vietnamese + English via i18n; default Vietnamese)
- Code language: **English** (variables, functions, types, comments)
- 3 roles: **Admin**, **Manager**, **Tenant**

## Stack

- **Nuxt 3** + Vue 3 Composition API + TypeScript (strict mode)
- **Supabase** — Database (PostgreSQL), Auth, Storage, Realtime
- **Nuxt UI** + TailwindCSS
- **Pinia** — state management
- **Zod** — schema validation (API boundaries & form inputs)
- **@nuxtjs/i18n** — internationalization (vi / en)

## Common Commands

```bash
# Dev
pnpm dev

# Build
pnpm build
pnpm preview

# Type check
pnpm typecheck

# Lint / format
pnpm lint
pnpm lint:fix
```

## Architecture

### Directory Structure (target)

```
├── assets/
├── components/         # Dumb/presentational components only
├── composables/        # Business logic hooks (useX pattern)
├── layouts/            # admin.vue, manager.vue, tenant.vue, default.vue
├── middleware/         # auth.ts, role.ts
├── pages/
│   ├── admin/
│   ├── manager/
│   └── tenant/
├── server/
│   ├── api/            # Nuxt server routes (REST endpoints)
│   └── utils/          # Supabase server client, helpers
├── stores/             # Pinia stores (useXStore pattern)
├── types/              # Shared TypeScript types & Zod schemas
└── supabase/
    └── migrations/     # SQL migration files
```

### Key Architectural Decisions

**Auth & Roles**
- Supabase Auth handles authentication. User role is stored in `profiles.role` (enum: `admin | manager | tenant`).
- Server-side role checks via Nuxt server middleware — never trust client-side role alone.
- Route protection: `middleware/auth.ts` (logged in) + `middleware/role.ts` (role guard).

**Data Access**
- Client components use composables (`composables/useRooms.ts`, etc.) that call Nuxt server API routes — never call Supabase directly from components.
- Server routes (`server/api/`) use the Supabase service-role client for privileged ops; user-scoped ops use the user's JWT via `@supabase/ssr`.
- Row Level Security (RLS) is always enabled. Migrations must include RLS policies.

**State Management**
- Pinia stores own server-fetched data and loading/error states.
- Composables handle one-off mutations and local logic; stores handle shared/persistent state.

**Validation**
- Zod schemas live in `types/` and are shared between client forms and server route handlers.
- Always validate at the server boundary (`server/api/`), not only on the client.

**Realtime**
- Supabase Realtime subscriptions are set up inside composables and torn down with `onUnmounted`.

### Role Access Matrix

| Feature | Admin | Manager | Tenant |
|---|---|---|---|
| Manage properties & rooms | ✓ | ✓ (own) | — |
| Manage contracts | ✓ | ✓ (own) | read |
| Manage invoices | ✓ | ✓ (own) | read |
| Manage tenants | ✓ | ✓ (own) | — |
| View own room/contract | — | — | ✓ |
| System settings | ✓ | — | — |
