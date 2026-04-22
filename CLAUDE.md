# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**zeno-house** — Hệ thống quản lý nhà trọ (Rental Property Management System)

- UI language: **Multilingual** (Vietnamese + English via i18n; default Vietnamese)
- Code language: **English** (variables, functions, types, comments)
- 3 roles: **Admin**, **Manager**, **Tenant**

## Stack

- **Nuxt 4** + Vue 3 Composition API + TypeScript (strict mode) — source files live in `app/`
- **Supabase** — Database (PostgreSQL), Auth, Storage, Realtime
- **Nuxt UI** + TailwindCSS
- **Pinia** — state management
- **Zod** — schema validation (API boundaries & form inputs)
- **@nuxtjs/i18n** — internationalization (vi / en)
- **Vercel** — deployment (SSR enabled, not static export)

## Common Commands

```bash
# Dev
npm run dev

# Build
npm run build

# Type check
npm run typecheck

# Lint / format
npm run lint
npm run lint:fix
```

## Role Access Matrix

| Feature | Admin | Manager | Tenant |
|---|---|---|---|
| Manage properties & rooms | ✓ | ✓ (own) | — |
| Manage contracts | ✓ | ✓ (own) | read |
| Manage invoices | ✓ | ✓ (own) | read |
| Manage tenants | ✓ | ✓ (own) | — |
| View own room/contract | — | — | ✓ |
| System settings | ✓ | — | — |

## Skills

- **nuxt** — Nuxt 4 SSR, file-based routing, server routes, useFetch, middleware, auto-imports
- **pinia** — Pinia store patterns, state/getters/actions, storeToRefs, plugins

## Sub-instructions

@instructions/project-structure.md
@instructions/typescript.md
@instructions/supabase-platform.md
@instructions/api-conventions.md
@instructions/components.md
@instructions/composables.md
@instructions/stores.md
@instructions/styling.md

## Maintenance

When a convention changes, update the matching file in `instructions/` in the same PR. Keep this file as a thin index — do not add lengthy implementation guidance here.
