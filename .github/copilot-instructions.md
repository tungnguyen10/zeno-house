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

## Phased Foundation: v0.3

```
F0.3.1  Utility Readings E2E         🔲  utility-readings-e2e
F0.3.2  Service Fees Basic           🔲  service-fees-basic
F0.3.3  Invoice Model                🔲  invoice-model
F0.3.4  Generate Invoice Single      🔲  generate-invoice-single
F0.3.5  Generate Invoice Batch       🔲  generate-invoice-batch
F0.3.6  Payment Tracking             🔲  payment-tracking
F0.3.7  Billing Summary              🔲  billing-summary
F0.3.8  v0.3 Quality Baseline        🔲  v03-quality-baseline
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
