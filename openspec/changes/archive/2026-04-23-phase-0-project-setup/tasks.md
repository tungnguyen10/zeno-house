## 1. Nuxt 3 Project Initialization

- [x] 1.1 Run `npm create nuxt-app .` in the existing `zeno-house` directory to initialize in-place with TypeScript template
- [x] 1.2 Install all required dependencies: `@nuxt/ui`, `@nuxtjs/supabase`, `@nuxtjs/i18n`, `@pinia/nuxt`, `@vueuse/nuxt`, `zod`, `date-fns`
- [x] 1.3 Configure `nuxt.config.ts` with all modules, Supabase settings, i18n config, runtime config, and `app.head` with `lang="vi"`
- [x] 1.4 Configure TailwindCSS with custom room-status color tokens (`available`, `occupied`, `maintenance`, `reserved`)
- [x] 1.5 Set up ESLint with `@nuxt/eslint-config` and Prettier with project rules
- [x] 1.6 Create `.env.example` with all required environment variables and descriptions
- [x] 1.7 Create full directory structure with `.gitkeep` placeholders: `components/`, `composables/`, `layouts/`, `middleware/`, `pages/admin/`, `pages/manager/`, `pages/tenant/`, `server/api/`, `server/utils/`, `stores/`, `types/`, `supabase/migrations/`
- [x] 1.8 Verify `npm run dev` starts without errors and `npm run typecheck` passes
- [x] 1.9 Wrap `app.vue` with `<UApp>` for Nuxt UI v4 theming and CSS variable injection
- [x] 1.10 Fix all layout files to use `<slot />` (not `<NuxtPage />`) as page outlet
- [x] 1.11 Configure HTTPS for dev server (`devServer.https: true` in `nuxt.config.ts`)
- [x] 1.12 Add `runtimeConfig.public` with explicit `supabaseUrl` and `supabaseKey` keys
- [x] 1.13 Require Node.js 20+ (document in README; upgrade local env via `nvm use 20`)

## 2. Supabase Schema & RLS

- [x] 2.1 Create `supabase/migrations/001_initial_schema.sql` with all domain tables: `profiles`, `buildings`, `rooms`, `tenants`, `room_tenants`, `contracts`, `contract_templates`
- [x] 2.2 Add tables to migration: `invoices`, `invoice_service_fees`, `invoice_discounts`, `utility_readings`, `meter_changes`, `service_fee_types`, `room_service_fees`
- [x] 2.3 Add tables to migration: `expenses`, `expense_categories`, `maintenance_requests`, `notifications`, `notification_settings`, `payments`, `promotions`, `applied_promotions`, `room_transfers`
- [x] 2.4 Add `profiles` trigger to auto-create profile on Supabase Auth user creation with default role
- [x] 2.5 Add `role` enum (`admin | manager | tenant`) to migration and wire to `profiles.role`
- [x] 2.6 Write RLS policies for Admin role: full SELECT/INSERT/UPDATE/DELETE on all tables
- [x] 2.7 Write RLS policies for Manager role: scoped to buildings they manage (buildings, rooms, tenants, contracts, invoices, utility_readings, expenses, maintenance_requests)
- [x] 2.8 Write RLS policies for Tenant role: read-only on own contracts, invoices, notifications; insert on maintenance_requests
- [x] 2.9 Create `supabase/migrations/002_storage_buckets.sql` with 4 buckets: `avatars` (public), `documents` (private), `meters` (private), `contracts` (private) with storage RLS policies
- [x] 2.10 Create `supabase/migrations/set_user_role.sql` utility script for manually setting user roles via SQL Editor
- [ ] 2.11 Apply migrations to Supabase project and verify all tables, policies, and buckets are created correctly

## 3. i18n Setup

- [x] 3.1 Configure `@nuxtjs/i18n` in `nuxt.config.ts`: locales `vi` (default) and `en`, strategy `prefix_except_default`, lazy loading enabled
  - `defaultLocale: 'vi'`
  - `strategy: 'prefix_except_default'`
  - `langDir: 'locales/'`
  - `vi` locale: `code: 'vi'`, `language: 'vi-VN'`, files: `vi/common.json`, `vi/auth.json`, `vi/buildings.json`, `vi/rooms.json`, `vi/tenants.json`, `vi/contracts.json`, `vi/invoices.json`, `vi/utilities.json`
  - `en` locale: `code: 'en'`, `language: 'en-US'`, files: same list under `en/`
  - Verify: `nuxt.config.ts` has `i18n` block with above values ✓
- [x] 3.2 Create `locales/vi/common.json` with keys for: navigation, CRUD actions (save, cancel, delete, edit, create, confirm), status labels (active, inactive, pending, expired), validation messages, date/currency format tokens
- [x] 3.3 Create `locales/en/common.json` with English equivalents for all keys in `common.json`
- [x] 3.4 Create `locales/vi/auth.json` and `locales/en/auth.json` with authentication-related strings
- [x] 3.5 Create empty `locales/vi/` and `locales/en/` files for remaining domains: `buildings.json`, `rooms.json`, `tenants.json`, `contracts.json`, `invoices.json`, `utilities.json`
- [x] 3.6 Create `composables/useLocale.ts` with `switchLocale(locale)`, `formatCurrency(amount, currency?)`, and `formatDate(date, format?)` methods
- [x] 3.7 Verify Vietnamese default locale routes have no `/vi` prefix and English routes use `/en` prefix

## 4. CI/CD Pipeline

- [x] 4.1 Create `.github/workflows/ci.yml` with jobs: `lint` (runs `npm run lint`), `typecheck` (runs `npm run typecheck`), `build` (runs `npm run build`) — triggered on pull_request to main
- [x] 4.2 Add Lighthouse CI job to `.github/workflows/ci.yml` using `treosh/lighthouse-ci-action` against Vercel preview URL
- [x] 4.3 Create `.lighthouserc.json` with thresholds: performance ≥ 80, accessibility ≥ 80, best-practices ≥ 80, seo ≥ 80
- [ ] 4.4 Configure Vercel project: link repository, set build command (`npm run build`), output directory (`.output`), and environment variables
- [x] 4.5 Create `.github/workflows/deploy.yml` with Vercel production deploy on push to main
- [x] 4.6 Document required GitHub secrets in repository README: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `LHCI_GITHUB_APP_TOKEN`
- [ ] 4.7 Open a test PR and verify all CI jobs pass (lint, typecheck, build, Lighthouse)

## 5. Auth Infrastructure

- [x] 5.1 Create `server/api/auth/me.get.ts` — returns authenticated user's `id`, `email`, `role`, `full_name` from `profiles`; 401 if unauthenticated
- [x] 5.2 Create `app/middleware/auth.ts` — redirect unauthenticated users to `/login` on all protected routes
- [x] 5.3 Create `app/middleware/role.ts` — read role from `useAuthStore` and block access to `/admin`, `/manager`, `/tenant` prefix routes if role does not match
- [x] 5.4 Create `app/stores/auth.ts` — Pinia store caching user role; `fetchRole()` calls `/api/auth/me` once and caches; `clearRole()` resets on logout
- [x] 5.5 Create `app/pages/login.vue` — email/password form using `supabase.auth.signInWithPassword`; on success fetches role via store and redirects to role-based dashboard
- [x] 5.6 Create `app/pages/index.vue` — redirects unauthenticated users to `/login`; authenticated users are handled by login page redirect
- [x] 5.7 Create scaffold dashboard pages for all 3 roles: `pages/admin/index.vue`, `pages/manager/index.vue`, `pages/tenant/index.vue`
- [x] 5.8 Create scaffold list/detail pages: properties, rooms, tenants, contracts, invoices for admin and manager; contracts and invoices for tenant
- [x] 5.9 Create `server/utils/supabase.ts` with server-side Supabase helpers
- [x] 5.10 Create `app/types/index.ts` with shared TypeScript types
