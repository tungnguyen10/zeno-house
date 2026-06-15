# Property Operations

This feature area covers dashboard, buildings, rooms, and tenants. These are the base records that contracts and billing depend on.

## Dashboard

Route:

- `/`

API:

- `GET /api/dashboard/summary`

The dashboard summarizes:

- building count
- rooms by status
- active contracts
- tenants

## Buildings

Routes:

- `/buildings`
- `/buildings/create`
- `/buildings/[id]`
- `/buildings/[id]/edit`
- `/buildings/[id]/settings`
- `/buildings/[id]/meter-readings`
- `/buildings/[id]/rooms/[room]`

API:

- `GET /api/buildings`
- `POST /api/buildings`
- `GET /api/buildings/[id]`
- `PATCH /api/buildings/[id]`
- `DELETE /api/buildings/[id]`
- `GET /api/buildings/[id]/rooms/[room]`

Buildings own:

- address and display metadata
- operational config
- utility pricing config
- rooms
- building-level service defaults
- monthly billing periods

Readable building routes use `slug` when available and fall back to id.

## Rooms

Routes:

- `/rooms`
- `/rooms/create`
- `/rooms/[id]`
- `/rooms/[id]/edit`
- `/buildings/[id]/rooms/[room]`

API:

- `GET /api/rooms`
- `POST /api/rooms`
- `GET /api/rooms/[id]`
- `PATCH /api/rooms/[id]`
- `DELETE /api/rooms/[id]`

Room statuses:

- `available`
- `occupied`
- `maintenance`

Contracts drive occupancy state. Creating an active contract occupies the room. Terminating or expiring a contract releases it unless the room is in maintenance.

## Tenants

Routes:

- `/tenants`
- `/tenants/create`
- `/tenants/[id]`
- `/tenants/[id]/edit`

API:

- `GET /api/tenants`
- `POST /api/tenants`
- `GET /api/tenants/[id]`
- `PATCH /api/tenants/[id]`
- `DELETE /api/tenants/[id]`

Tenant records include:

- full name and contact fields
- gender
- occupation
- identity issue date/place
- emergency contact name/phone

Tenant detail shows current active contract and contract history.

## Implementation Files

Buildings:

- `app/pages/buildings/**`
- `app/components/buildings/**`
- `app/composables/buildings/**`
- `server/services/buildings/index.ts`
- `server/repositories/buildings/index.ts`
- `app/utils/validators/buildings.ts`
- `app/utils/mappers/buildings.ts`

Rooms:

- `app/pages/rooms/**`
- `app/components/rooms/**`
- `app/composables/rooms/**`
- `server/services/rooms/index.ts`
- `server/repositories/rooms/index.ts`
- `app/utils/validators/rooms.ts`
- `app/utils/mappers/rooms.ts`

Tenants:

- `app/pages/tenants/**`
- `app/components/tenants/**`
- `app/composables/tenants/**`
- `server/services/tenants/index.ts`
- `server/repositories/tenants/index.ts`
- `app/utils/validators/tenants.ts`
- `app/utils/mappers/tenants.ts`
