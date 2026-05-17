## 1. Foundation Alignment

- [x] 1.1 Update architecture docs and ADRs to lock the v0.2.5 core-data foundation before billing workspace work
- [x] 1.2 Update OpenSpec notes so deferred billing items remain separate changes

## 2. Database Foundation

- [x] 2.1 Add building operational config columns and defaults to the buildings schema
- [x] 2.2 Add contract commercial term fields and occupant count to the contracts schema
- [x] 2.3 Add contract_occupants and meter_devices tables for occupant history and meter lifecycle
- [x] 2.4 Regenerate app/types/database.types.ts after the schema changes

## 3. Building Workflow

- [x] 3.1 Extend building validators, types, and server API to accept operational config fields
- [x] 3.2 Add building create/edit/detail UI for owner/contact metadata and billing defaults
- [x] 3.3 Implement quick room setup preview and batch room creation in the building flow
- [x] 3.4 Add duplicate room code validation before batch submit

## 4. Contract and Occupant Alignment

- [x] 4.1 Extend contract validators, types, service logic, and repository queries for commercial terms
- [x] 4.2 Add occupant history handling with primary tenant, roommate role, and move-in / move-out dates
- [x] 4.3 Update contract create/edit/detail UI to surface occupant count and commercial terms

## 5. Meter Lifecycle and Navigation

- [x] 5.1 Add meter device lifecycle handling for active, replaced, broken, and inactive states
- [x] 5.2 Add the Operations navigation group with a Monthly Billing placeholder route
- [x] 5.3 Verify Room pages stay master-data only and do not expose billing actions

## 6. Verify

- [x] 6.1 Run npm run lint && npm run typecheck