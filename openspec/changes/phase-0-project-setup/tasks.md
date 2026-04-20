## 1. Nuxt 3 Project Initialization

- [ ] 1.1 Run `npm create nuxt-app .` in the existing `zeno-house` directory to initialize in-place with TypeScript template
- [ ] 1.2 Install all required dependencies: `@nuxt/ui`, `@nuxtjs/supabase`, `@nuxtjs/i18n`, `@pinia/nuxt`, `@vueuse/nuxt`, `zod`, `date-fns`
- [ ] 1.3 Configure `nuxt.config.ts` with all modules, Supabase settings, i18n config, runtime config, and `app.head` with `lang="vi"`
- [ ] 1.4 Configure TailwindCSS with custom room-status color tokens (`available`, `occupied`, `maintenance`, `reserved`)
- [ ] 1.5 Set up ESLint with `@nuxt/eslint-config` and Prettier with project rules
- [ ] 1.6 Create `.env.example` with all required environment variables and descriptions
- [ ] 1.7 Create full directory structure with `.gitkeep` placeholders: `components/`, `composables/`, `layouts/`, `middleware/`, `pages/admin/`, `pages/manager/`, `pages/tenant/`, `server/api/`, `server/utils/`, `stores/`, `types/`, `supabase/migrations/`
- [ ] 1.8 Verify `npm run dev` starts without errors and `npm run typecheck` passes

## 2. Supabase Schema & RLS

- [ ] 2.1 Create `supabase/migrations/001_initial_schema.sql` with all domain tables: `profiles`, `buildings`, `rooms`, `tenants`, `room_tenants`, `contracts`, `contract_templates`
- [ ] 2.2 Add tables to migration: `invoices`, `invoice_service_fees`, `invoice_discounts`, `utility_readings`, `meter_changes`, `service_fee_types`, `room_service_fees`
- [ ] 2.3 Add tables to migration: `expenses`, `expense_categories`, `maintenance_requests`, `notifications`, `notification_settings`, `payments`, `promotions`, `applied_promotions`, `room_transfers`
- [ ] 2.4 Add `profiles` trigger to auto-create profile on Supabase Auth user creation with default role
- [ ] 2.5 Add `role` enum (`admin | manager | tenant`) to migration and wire to `profiles.role`
- [ ] 2.6 Write RLS policies for Admin role: full SELECT/INSERT/UPDATE/DELETE on all tables
- [ ] 2.7 Write RLS policies for Manager role: scoped to buildings they manage (buildings, rooms, tenants, contracts, invoices, utility_readings, expenses, maintenance_requests)
- [ ] 2.8 Write RLS policies for Tenant role: read-only on own contracts, invoices, notifications; insert on maintenance_requests
- [ ] 2.9 Create storage buckets: `avatars` (public), `documents` (private), `meters` (private), `contracts` (private) with appropriate access policies
- [ ] 2.10 Apply migration to Supabase project and verify all tables and policies are created correctly

## 3. i18n Setup

- [ ] 3.1 Configure `@nuxtjs/i18n` in `nuxt.config.ts`: locales `vi` (default) and `en`, strategy `prefix_except_default`, lazy loading enabled
- [ ] 3.2 Create `locales/vi/common.json` with keys for: navigation, CRUD actions (save, cancel, delete, edit, create, confirm), status labels (active, inactive, pending, expired), validation messages, date/currency format tokens
- [ ] 3.3 Create `locales/en/common.json` with English equivalents for all keys in `common.json`
- [ ] 3.4 Create `locales/vi/auth.json` and `locales/en/auth.json` with authentication-related strings
- [ ] 3.5 Create empty `locales/vi/` and `locales/en/` files for remaining domains: `buildings.json`, `rooms.json`, `tenants.json`, `contracts.json`, `invoices.json`, `utilities.json`
- [ ] 3.6 Create `composables/useLocale.ts` with `switchLocale(locale)`, `formatCurrency(amount, currency?)`, and `formatDate(date, format?)` methods
- [ ] 3.7 Verify Vietnamese default locale routes have no `/vi` prefix and English routes use `/en` prefix

## 4. CI/CD Pipeline

- [ ] 4.1 Create `.github/workflows/ci.yml` with jobs: `lint` (runs `npm run lint`), `typecheck` (runs `npm run typecheck`), `build` (runs `npm run build`) — triggered on pull_request to main
- [ ] 4.2 Add Lighthouse CI job to `.github/workflows/ci.yml` using `treosh/lighthouse-ci-action` against Vercel preview URL
- [ ] 4.3 Create `.lighthouserc.json` with thresholds: performance ≥ 90, accessibility ≥ 90, best-practices ≥ 90, seo ≥ 90
- [ ] 4.4 Configure Vercel project: link repository, set build command (`npm run build`), output directory (`.output`), and environment variables
- [ ] 4.5 Create `.github/workflows/deploy.yml` with Vercel production deploy on push to main
- [ ] 4.6 Document required GitHub secrets in repository README: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `LHCI_GITHUB_APP_TOKEN`
- [ ] 4.7 Open a test PR and verify all CI jobs pass (lint, typecheck, build, Lighthouse)
