## Context

zeno-house is a greenfield rental property management system. There is currently no codebase — this phase creates it from scratch. The system will support 3 roles (Admin, Manager, Tenant) with two separate login flows, and requires multilingual support (Vietnamese default, English). All domain features in later phases depend on the infrastructure established here.

Key constraints:
- Nuxt 3 + Supabase is mandated by the project requirements
- TypeScript strict mode throughout
- Mobile-first, Lighthouse score ≥ 90
- Vietnamese as the default UI language

## Goals / Non-Goals

**Goals:**
- Runnable Nuxt 3 dev environment with all dependencies installed and configured
- Complete Supabase schema with tables, indexes, RLS policies for all 3 roles, and storage buckets
- Working i18n with Vietnamese and English, lazy-loaded locale files, and a `useLocale()` composable
- CI pipeline that enforces lint, type-check, build success, and Lighthouse thresholds on every PR
- Auto-deploy to Vercel on merge to main

**Non-Goals:**
- Feature UI pages (rooms detail, invoices, contracts forms, etc.) — those are Phase 1+
- Seed data or demo content
- Mobile app or PWA configuration
- Email/SMS notification providers

## Decisions

### 1. `@nuxtjs/supabase` module vs. raw `@supabase/ssr`

**Decision**: Use `@nuxtjs/supabase` official module.

**Rationale**: Provides auto-configured server/client Supabase instances, SSR cookie handling, and auth middleware integration out of the box. The raw `@supabase/ssr` approach requires manual composable wiring and cookie plumbing that the module handles correctly.

**Alternative considered**: Manual `@supabase/ssr` setup — rejected because it duplicates work the module already does and adds maintenance burden.

### 2. i18n strategy: `prefix_except_default`

**Decision**: Use `prefix_except_default` routing strategy.

**Rationale**: Vietnamese (default) URLs stay clean (`/dashboard`, `/rooms`). English URLs get prefixed (`/en/dashboard`). This is the standard SEO-friendly approach for multilingual Nuxt apps where one language dominates.

**Alternative considered**: `prefix` (all locales prefixed) — rejected because it breaks existing bookmarks and is unnecessary complexity for a mostly Vietnamese user base.

### 3. Lazy-loaded locale files split by domain

**Decision**: Split locale files by feature domain (`auth.json`, `rooms.json`, `invoices.json`, etc.) with lazy loading.

**Rationale**: A single `translations.json` would balloon to thousands of keys. Domain splitting keeps files maintainable and lazy loading ensures only the needed translations are fetched per route.

### 4. RLS as the primary security layer

**Decision**: Row Level Security policies on all tables, with server routes using service-role client only for admin operations.

**Rationale**: RLS enforces data isolation at the database level regardless of application bugs. Server routes use the user's JWT for tenant/manager scoped queries so RLS policies apply automatically. Service-role client is restricted to privileged admin operations only.

### 5. GitHub Actions + Vercel for CI/CD

**Decision**: GitHub Actions for CI checks, Vercel for hosting and preview deployments.

**Rationale**: Vercel has first-class Nuxt 3 support and zero-config deployment. GitHub Actions gives full control over CI gates. Lighthouse CI runs against Vercel preview URLs for accurate production-like scores.

### 6. Pinia for state management, Zod for validation

**Decision**: Pinia stores for shared server-fetched state; Zod schemas in `types/` shared between client forms and server route handlers.

**Rationale**: Pinia is the Nuxt-recommended store. Zod provides runtime validation at API boundaries with TypeScript inference — a single schema serves both form validation and server input validation, reducing duplication.

## Risks / Trade-offs

- **Supabase RLS complexity** → Mitigation: Write integration tests for each role in Phase 1; use Supabase's `auth.uid()` and `auth.role()` helpers consistently
- **i18n missing keys in production** → Mitigation: ESLint plugin (`eslint-plugin-i18n-json`) to detect missing keys in CI
- **Lighthouse CI flakiness on Vercel cold starts** → Mitigation: Set thresholds at 80 for Phase 0, raise to 90 once caching and ISR are configured in later phases
- **`@nuxtjs/supabase` version pinning** → The module's auth redirect behavior can change across minor versions; pin to exact version in `package.json`

## Migration Plan

1. Run `npm create nuxt-app` scaffold
2. Install and configure all dependencies
3. Run Supabase migration SQL against the project database
4. Set environment variables in Vercel dashboard
5. Push to GitHub — CI pipeline runs automatically
6. Verify Vercel preview deploy and Lighthouse scores

**Rollback**: Since this is greenfield, rollback = delete the Supabase project and Vercel project. No production data at risk.

## Open Questions

- Should storage bucket policies use signed URLs (time-limited) or Supabase storage RLS policies for private buckets? → Recommend signed URLs for `documents`, `meters`, `contracts` for auditability.
- Lighthouse CI: run against Vercel preview or localhost? → Vercel preview preferred for accuracy; requires `VERCEL_TOKEN` in CI secrets.
