# Zeno House — Project Context

Hệ thống quản lý bất động sản cho chủ nhà trọ/tòa nhà. Viết bằng tiếng Việt cho tên biến nghiệp vụ là ổn, nhưng code (variable, function, type) dùng tiếng Anh.

## Domain Entities

| Entity | Nghĩa | Ghi chú |
|--------|-------|---------|
| `Building` | Tòa nhà / khu trọ | Entity gốc |
| `Room` | Phòng | Thuộc Building |
| `Tenant` | Khách thuê | Người ký hợp đồng |
| `Contract` | Hợp đồng thuê | Nối Tenant ↔ Room |
| `Invoice` | Hóa đơn | Phase sau — không thuộc v0.1 |

## Stack

| Layer | Tech |
|-------|------|
| Framework | Nuxt 4 (`future.compatibilityVersion: 4`), Vue 3, TypeScript strict |
| Styling | TailwindCSS + `clsx` (conditional classes) |
| State | Pinia (global only) + composables (server/domain state) |
| Auth + DB | Supabase (`@nuxtjs/supabase`) |
| Validation | Zod v4 |
| Icons | SVG via `nuxt-svgo` (auto-import prefix: `Icon`) |
| Font | Inter variable — self-hosted tại `/public/fonts/` |
| Email | Resend API |
| Bot protection | Cloudflare Turnstile (test keys trong dev) |

## Phased Foundation: v0.1

```
F0.1.1  Project Skeleton             ✅  infra, config, deps
F0.1.2  App Shell Foundation         ✅  archived: 2026-05-14-app-shell-foundation
F0.1.3  Auth + Session + Permission  ✅  archived: 2026-05-14-auth-session-foundation
F0.1.4  API & Server Architecture    ✅  archived: 2026-05-14-api-server-architecture
F0.1.5  Domain Vertical Slice        ✅  archived: 2026-05-14-buildings-vertical-slice
F0.1.6  Quality Gates Baseline       ✅  archived: 2026-05-14-quality-gates-baseline
```

**Nguyên tắc incremental:** chỉ set up thứ gì phục vụ bước kế tiếp. Không tạo abstraction khi mới có 1 nơi dùng.

## Phased Foundation: v0.2

```
F0.2.1  Rooms End-to-End             ✅  archived: 2026-05-14-rooms-end-to-end
F0.2.2  Shared Patterns              ✅  archived: 2026-05-14-shared-patterns
F0.2.3  Tenants End-to-End           ✅  archived: 2026-05-14-tenants-end-to-end
F0.2.4  Room Assignment              ✅  archived: 2026-05-14-room-assignment
F0.2.5  Contracts Basic              ✅  archived: 2026-05-15-contracts-basic
F0.2.6  Dashboard Summary            ✅  archived: 2026-05-15-dashboard-summary
F0.2.7  v0.2 Quality Baseline        ✅  archived: 2026-05-15-v02-quality-baseline
```

## Phased Foundation: v0.2.5 — Core Data Alignment

```
F0.2.5.1  Building Operational Config               ✅  archived: 2026-05-17-product-flow-foundation
F0.2.5.2  Quick Room Setup                          ✅  archived: 2026-05-17-product-flow-foundation
F0.2.5.3  Contract Commercial Terms                 ✅  archived: 2026-05-17-product-flow-foundation
F0.2.5.4  Occupants / Roommates Model               ✅  archived: 2026-05-17-product-flow-foundation
F0.2.5.5  Meter Device Lifecycle                    ✅  archived: 2026-05-17-product-flow-foundation
F0.2.5.6  Navigation Alignment                      ✅  archived: 2026-05-17-product-flow-foundation
F0.2.5.7  Architecture ADRs                         ✅  archived: 2026-05-17-product-flow-foundation
F0.2.5.8  Contract Payments / Deposit / Prepaid Rent ✅  archived: 2026-05-17-contract-payments
F0.2.5.9  Contract Renewal Model                    ✅  archived: 2026-05-17-contract-renewal
F0.2.5.10 Cleanup & Billing Readiness               ✅  archived: 2026-06-10-cleanup-billing-readiness
```

## Phased Foundation: v0.3 — Iteration & Polish

```
F0.3.1   Operational Design System              ✅  archived: 2026-06-11-operational-design-system
F0.3.2   Adopt Operational Design System        ✅  archived: 2026-06-11-adopt-operational-design-system
F0.3.3   Billing Readability & Polish           ✅  archived: 2026-06-12-billing-readability-and-polish
F0.3.4   Billing Test Baseline                  ✅  archived: 2026-06-13-billing-test-baseline
F0.3.5   Billing Power Features                 ✅  archived: 2026-06-14-billing-power-features
F0.3.6   Building Filter (Tenants/Contracts)    ✅  archived: 2026-06-14-building-filter-tenants-contracts
F0.3.7   Monthly Operations Workspace           ✅  archived: 2026-06-14-monthly-operations-workspace
F0.3.8   Dashboard Building/Tenant UX           ✅  archived: 2026-06-15-dashboard-building-tenant-ux
F0.3.9   Bulk Meter Reading Entry               ✅  archived: 2026-06-17-add-bulk-meter-reading-entry
F0.3.10  Entity Slug Codes                      ✅  archived: 2026-06-17-entity-slug-codes
F0.3.11  Dashboard Contract & Hardening         ✅  archived: 2026-06-26-dashboard-contract-and-hardening
```

## Data Flow

```
page
 └─▶ composable ($fetch / useFetch)
       └─▶ server/api/   (validate input, auth guard)
             └─▶ server/services/   (business logic, permission check)
                   └─▶ server/repositories/   (Supabase query)
```

Client **không** gọi Supabase trực tiếp cho business data — chỉ đi qua `server/api/`.

## API Response Envelope

```ts
type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> }
type ApiError   = { error: { code: string; message: string; details?: unknown } }
```

Error codes: `UNAUTHENTICATED` | `FORBIDDEN` | `NOT_FOUND` | `VALIDATION_ERROR` | `CONFLICT`

## Roles (v0.1 scope)

- `admin` — full access
- `manager` — quản lý building được phân công
- `tenant` — portal riêng, phase sau

Chỉ **admin shell** trong v0.1. Tenant portal xử lý sau.

## Environment Variables

| Biến | Dùng ở | Ghi chú |
|------|--------|---------|
| `SUPABASE_URL` | `@nuxtjs/supabase` (auto) | Được module tự đọc |
| `SUPABASE_KEY` | `@nuxtjs/supabase` (auto) | Anon/publishable key |
| `SUPABASE_SECRET_KEY` | server only | Service role — chỉ dùng khi bypass RLS |
| `SUPABASE_PROJECT_REF` | CLI / codegen | `supabase gen types` |
| `RESEND_API_KEY` | `runtimeConfig.resendApiKey` | Email gửi từ server |
| `ADMIN_EMAIL` | `runtimeConfig.adminEmail` | Email nhận thông báo |
| `NUXT_PUBLIC_TURNSTILE_SITE_KEY` | client Turnstile | Test key trong dev |
| `NUXT_TURNSTILE_SECRET_KEY` | server Turnstile verify | Test key trong dev |
| `NUXT_PUBLIC_GA_ID` | Google Analytics | `runtimeConfig.public.gaId` |
| `NUXT_PUBLIC_SITE_URL` | canonical, OG tags | `runtimeConfig.public.siteUrl` |

## Instruction Files

Scoped instruction files nằm tại `.github/instructions/`:

| File | Scope |
|------|-------|
| `project-structure` | Folder ownership, where to put what |
| `components` | 3 layers: ui / domain / app |
| `composables` | list / detail / form split |
| `stores` | Only truly global state |
| `server-api` | API → service → repository pattern |
| `forms` | Zod schema, client + server validation |
| `styling` | Tailwind + clsx conventions |
| `typescript` | Strict types, API types, Zod inference |
| `supabase` | Client auth only, server for data |
| `database-schema` | Auto-generated types, mappers |
| `images` | nuxt-svgo icons, self-hosted fonts |
