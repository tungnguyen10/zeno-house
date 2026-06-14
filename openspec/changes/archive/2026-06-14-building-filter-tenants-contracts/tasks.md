## 1. API Filtering

- [x] 1.1 Add `building_id` plumbing to tenant list API filters.
- [x] 1.2 Implement tenant repository filtering by selected building through primary contracts and contract occupants.

## 2. Client State

- [x] 2.1 Add `buildingFilter` to `useContractList` and include it in query/watch/page reset behavior.
- [x] 2.2 Add `buildingFilter` to `useTenantList` and include it in query/watch/page reset behavior.

## 3. List UI

- [x] 3.1 Add building select filter to `/contracts` while preserving status filter and default all-buildings behavior.
- [x] 3.2 Add building select filter to `/tenants` while preserving search and default all-buildings behavior.

## 4. Verification

- [x] 4.1 Validate the OpenSpec change with `openspec validate building-filter-tenants-contracts --strict`.
- [x] 4.2 Run available typecheck/lint checks for the touched Nuxt code.
