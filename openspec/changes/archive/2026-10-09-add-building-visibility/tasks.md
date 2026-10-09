## 1. Domain Contract And Database

- [x] 1.1 Apply `supabase/migrations/20261009150000_building_visibility.sql` to the cloud project.
- [x] 1.2 Regenerate `app/types/database.types.ts` from the cloud schema.
- [x] 1.3 Extend the `Building` DTO, mapper, and validators with `isHidden` and the visibility/`include_hidden` schemas.

## 2. Server Scope And Services

- [x] 2.1 Add `getVisibleBuildingIds` to `server/utils/scope.ts` with per-request caching, preserving `getAssignedBuildingIds` and `assertBuildingScope` semantics, and cover admin/owner/manager against hidden and non-hidden sets.
- [x] 2.2 Switch the building, room, contract, tenant, meter-reading, invoice, billing-period, support-request, and AI list services to the visibility-aware scope while leaving every detail, write, and account-administration call site on permission scope.
- [x] 2.3 Exclude hidden buildings from the dashboard summary; its cache key derives from the resolved scope, so it varies with the hidden set.

## 3. Permission And API

- [x] 3.1 Add the admin-only `buildings.visibility.manage` capability, the `BUILDING_VISIBILITY_CHANGED` audit action, and its Vietnamese display label.
- [x] 3.2 Add `BuildingService.setVisibility` with capability enforcement and durable audit, plus `PATCH /api/buildings/:id/visibility`.
- [x] 3.3 Add the admin-only `include_hidden` list flag, parsed with a query-safe boolean, and reject it for non-admin callers.

## 4. Admin Experience

- [x] 4.1 Add the admin-only settings tab and navigation entry.
- [x] 4.2 Add the building visibility settings page with optimistic toggling, failure rollback, and cache invalidation.
- [x] 4.3 Surface a hidden badge on the building card.

## 5. Documentation And Verification

- [x] 5.1 Document the visibility flag, the capability, and the list-versus-administration scope boundary in the database, auth-permissions, and API inventory docs.
- [x] 5.2 Full tests, typecheck, lint, and OpenSpec validation pass.
