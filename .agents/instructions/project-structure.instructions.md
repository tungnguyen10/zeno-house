---
applyTo: "app/**, server/**, nuxt.config.ts"
---

# Project Structure

Nuxt 4 — app source in `app/`, server code in `server/`, config at repository root.

## Folder Ownership

| Folder | Owns |
|--------|------|
| `app/pages/` | Route definition, route meta, middleware, screen-level orchestration |
| `app/layouts/` | App shell and navigation frames |
| `app/components/ui/` | UI primitives — no domain logic |
| `app/components/<domain>/` | Domain display blocks — receive data via props |
| `app/components/app/` | Shell pieces: AppSidebar, AppHeader, AppUserMenu, AppStatCard |
| `app/composables/<domain>/` | Client-side orchestration: list, detail, form, submit |
| `app/stores/` | Global client state: session, sidebar, notifications |
| `app/types/` | DTOs, input types, response types |
| `app/utils/validators/` | Shared Zod schemas for both client and server |
| `app/utils/constants/` | Enums, role strings, capability keys |
| `app/utils/mappers/` | DB row → app DTO transformations |
| `app/utils/format/` | Format helpers: date, currency, number |
| `app/assets/icons/` | SVG icons — auto-imported via nuxt-svgo |
| `app/assets/scss/` | Global CSS: Tailwind directives, font-face, scrollbar |
| `server/api/` | HTTP contract, Zod validation entry point, auth guard |
| `server/services/` | Business logic, permission re-check |
| `server/repositories/` | Supabase query only — no business logic |
| `server/utils/` | Server-side helpers: auth, error mapping |
| `server/middleware/` | Server middleware (logging, auth context) |
| `docs/architecture/` | Architecture decisions, rules |
| `docs/architecture/api.md` | API shape documentation |
| `docs/ui-patterns/` | UI pattern documentation |

## ✓ Correct Usage

**Place components in the correct layer:**
```
app/components/
├── ui/
│   ├── UiButton.vue       ← generic, không có domain
│   ├── UiInput.vue
│   ├── UiModal.vue
│   ├── UiStatusBadge.vue
│   └── UiEmptyState.vue
├── app/
│   ├── AppSidebar.vue     ← shell, không có business logic
│   └── AppHeader.vue
└── buildings/
    ├── BuildingCard.vue   ← domain display
    └── BuildingForm.vue
```

**Composable organized by domain and purpose:**
```
app/composables/
└── buildings/
    ├── useBuildingList.ts    ← fetch list, pagination, filter
    ├── useBuildingDetail.ts  ← fetch single
    └── useBuildingForm.ts    ← form state, validation, submit
```

**Shared validator for both client and server:**
```
app/utils/validators/
└── buildings.ts    ← import bởi cả useBuildingForm.ts và server/api/buildings/
```

**Server pattern:**
```
server/
├── api/buildings/
│   ├── index.get.ts       ← GET /api/buildings
│   ├── index.post.ts      ← POST /api/buildings
│   └── [id].get.ts        ← GET /api/buildings/:id
├── services/
│   └── buildings.ts       ← business logic
└── repositories/
    └── buildings.ts       ← Supabase queries
```

## ✗ Do Not

```
# ✗ Đừng đặt domain component trong ui/
app/components/ui/BuildingCard.vue   ← không đúng layer

# ✗ Đừng đặt business logic trong repository
server/repositories/buildings.ts    ← chỉ query, không check permission

# ✗ Đừng tạo folder component ngoài app/ (Nuxt 4 tự động import từ app/)
components/ui/UiButton.vue          ← phải là app/components/ui/

# ✗ Đừng lồng composable logic vào Pinia cho server state
app/stores/buildings.ts với fetchList() ← dùng composable + useFetch thay vào đó

# ✗ Đừng đặt Zod schema trong server/ nếu cần dùng ở cả client
server/validation/buildings.ts      ← đặt ở app/utils/validators/ để dùng chung
```

## Incremental Principle

- Only create folders/files when a real feature requires them
- Do not create abstractions when there is only one use case
- Each step must leave a runnable or verifiable result
