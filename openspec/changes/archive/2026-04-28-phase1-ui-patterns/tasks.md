## 1. Shared UI components

- [x] 1.1 Create `app/components/ui/PageHeader.vue` — `title`, `description?`, `#actions` slot, optional back-arrow with `to` prop
- [x] 1.2 Create `app/components/ui/StatCard.vue` — `label`, `value`, `icon`, `variant` (`default` | `warning` | `danger`), `hint?`; left-border accent on non-default variant
- [x] 1.3 Create `app/components/ui/AlertBanner.vue` — `message`, `action?` (`{ label, to }`), `variant`, dismissible via `v-if` local state
- [x] 1.4 Create `app/components/ui/EmptyState.vue` — `icon`, `title`, `description`, `action?` (`{ label, to }`); centered layout, muted icon

## 2. Tenant portal components

- [x] 2.1 Create `app/components/features/tenant-portal/RoomHero.vue` — room number, building name, countdown bar (days remaining / contract duration), two CTA buttons; skeleton while loading; empty state when no active room

## 3. Reference page rewrites

- [x] 3.1 Rewrite `app/pages/admin/index.vue` — use `StatCard` × 4 (occupancy, tenants, maintenance, expiring contracts), `AlertBanner` (hidden when no alerts), activity feed placeholder (`UCard` with "Sắp có" text)
- [x] 3.2 Rewrite `app/pages/tenant/index.vue` — use `TenantPortalRoomHero` + 3 quick-action mini-cards (latest invoice, unread notifications, landlord contact)

## 4. Verify

- [x] 4.1 All new components pass mobile (375px), tablet (768px), desktop (1280px) checks
- [x] 4.2 Dark mode renders correctly for all new components
- [x] 4.3 Loading skeletons match content shape
- [x] 4.4 `PageHeader` used consistently in all existing stub pages (admin/index, tenant/index)
