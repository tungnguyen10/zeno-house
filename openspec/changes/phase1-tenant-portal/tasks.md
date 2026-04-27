## 1. API Routes & i18n

- [ ] 1.1 Create `server/api/tenant/me/room.get.ts` — return tenant's current room from active contract
- [ ] 1.2 Create `server/api/tenant/me/contracts.get.ts` — return tenant's active contract
- [ ] 1.3 Create `server/api/tenant/me/profile.patch.ts` — update profiles + tenants tables atomically
- [ ] 1.4 Create `i18n/locales/vi/tenant-portal.json` + `i18n/locales/en/tenant-portal.json` (new files — register the `tenant-portal` namespace in the `files` array in `nuxt.config.ts` i18n config)

## 2. Composables

- [ ] 2.1 Create `app/composables/useTenantDashboard.ts` — parallel fetch room + contract + invoice stub count

## 3. Components

- [ ] 3.1 Create `app/components/features/tenant-portal/Dashboard.vue` — room card, contract summary, invoice count, quick action buttons
- [ ] 3.2 Create `app/components/features/tenant-portal/RoomInfo.vue` — room name, floor, building, monthly rent display
- [ ] 3.3 Create `app/components/features/tenant-portal/ContractView.vue` — sanitized `v-html` of `content_html`, disabled PDF button
- [ ] 3.4 Create `app/components/features/tenant-portal/MaintenanceForm.vue` — title, description, priority select (3 levels: 1=low, 2=medium, 3=high — INTEGER, no "urgent"), photo upload (max 3)
- [ ] 3.5 Create `app/components/features/tenant-portal/MaintenanceList.vue` — list of own requests with status badge

## 4. Pages

- [ ] 4.1 Implement `app/pages/tenant/index.vue` — uses `TenantPortalDashboard` component
- [ ] 4.2 Implement `app/pages/tenant/contracts.vue` — uses `TenantPortalContractView` component (path is `/tenant/contracts` plural, matching existing codebase convention)
- [ ] 4.3 Implement `app/pages/tenant/maintenance/index.vue` — uses `TenantPortalMaintenanceList`
- [ ] 4.4 Create `app/pages/tenant/maintenance/new.vue` — uses `TenantPortalMaintenanceForm`
- [ ] 4.5 Implement `app/pages/tenant/account.vue` — edit form + change password section (path is `/tenant/account`, NOT `/tenant/profile`)
- [ ] 4.6 Implement `app/pages/tenant/invoices.vue` — Phase 2 placeholder empty state
- [ ] 4.7 Implement `app/pages/tenant/notifications.vue` — stub empty state (wired in 1.9)
