---
applyTo: "**"
---

# Project Structure

Nuxt 4 — source app nằm trong `app/`, server nằm trong `server/`, config ở root.

## Folder Ownership

| Folder | Owns |
|--------|------|
| `app/pages/` | Route definition, route meta, middleware, screen-level orchestration |
| `app/layouts/` | App shell và navigation frame |
| `app/components/ui/` | UI primitives — không chứa domain logic |
| `app/components/<domain>/` | Domain display blocks — nhận data qua props |
| `app/components/app/` | Shell pieces: AppSidebar, AppHeader, AppBreadcrumb |
| `app/composables/<domain>/` | Client-side orchestration: list, detail, form, submit |
| `app/stores/` | Global client state: session, sidebar, notifications |
| `app/types/` | DTOs, input types, response types |
| `app/utils/validators/` | Zod schemas dùng chung cho client và server |
| `app/utils/constants/` | Enums, role strings, capability keys |
| `app/utils/mappers/` | DB row → app DTO transformations |
| `app/utils/format/` | Format helpers: date, currency, number |
| `app/assets/icons/` | SVG icons — tự động import qua nuxt-svgo |
| `app/assets/scss/` | Global CSS: Tailwind directives, font-face, scrollbar |
| `server/api/` | HTTP contract, Zod validation entry point, auth guard |
| `server/services/` | Business logic, permission re-check |
| `server/repositories/` | Supabase query only — không có business logic |
| `server/utils/` | Server-side helpers: auth, error mapping |
| `server/middleware/` | Server middleware (logging, auth context) |
| `docs/architecture/` | Architecture decisions, rules |
| `docs/api-contracts/` | API shape documentation |
| `docs/ui-patterns/` | UI pattern documentation |

## ✓ Cách dùng đúng

**Đặt component theo đúng layer:**
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

**Composable theo domain và mục đích:**
```
app/composables/
└── buildings/
    ├── useBuildingList.ts    ← fetch list, pagination, filter
    ├── useBuildingDetail.ts  ← fetch single
    └── useBuildingForm.ts    ← form state, validation, submit
```

**Validator dùng chung cho client + server:**
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

## ✗ Cách không được dùng

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

## Nguyên tắc incremental (v0.1)

- Chỉ tạo folder/file khi có feature thật cần dùng
- Không tạo abstraction khi mới chỉ có 1 nơi dùng
- Mỗi bước phải để lại kết quả chạy được hoặc kiểm chứng được
