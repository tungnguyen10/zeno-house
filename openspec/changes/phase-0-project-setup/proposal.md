## Why

The zeno-house rental management system needs a solid foundation before any feature work can begin. Phase 0 establishes the project infrastructure — Nuxt 3 scaffolding, Supabase database with all tables and RLS policies, i18n support, and CI/CD pipeline — so that all subsequent phases can build on a consistent, production-ready base.

## What Changes

- Initialize Nuxt 3 project with TypeScript strict mode and all required dependencies (`@nuxt/ui`, `@nuxtjs/supabase`, `@nuxtjs/i18n`, `@pinia/nuxt`, `@vueuse/nuxt`, `zod`, `date-fns`)
- Configure `nuxt.config.ts` with modules, Supabase settings, i18n (vi default / en), runtime config, and app head
- Configure TailwindCSS with custom room-status color tokens
- Set up ESLint + Prettier with project-specific rules
- Create full Supabase migration script: all domain tables, RLS policies for 3 roles, storage buckets
- Scaffold i18n locale files (`vi/` and `en/`) with common translation keys and a `useLocale()` composable
- Create GitHub Actions CI workflows (lint, type-check, build, Lighthouse) and Vercel deployment config
- Create `.env.example` and project directory structure

## Capabilities

### New Capabilities

- `project-scaffold`: Nuxt 3 project initialization with all dependencies, configs, and directory structure
- `supabase-schema`: Full database schema with tables, RLS policies, and storage buckets for the 3-role rental system
- `i18n-setup`: Multilingual support (vi/en) with locale files and `useLocale()` composable
- `ci-cd-pipeline`: GitHub Actions workflows for lint/type-check/build/Lighthouse and Vercel auto-deploy

### Modified Capabilities

## Impact

- Creates the entire project from scratch — all files are new
- Supabase project must exist and credentials provided via `.env`
- Vercel project must be linked for deployment workflows
- GitHub repository must have secrets configured (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VERCEL_TOKEN`)
- All future phases depend on this foundation
