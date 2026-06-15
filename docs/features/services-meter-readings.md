# Services And Meter Readings

Services and meter readings feed contract pricing and monthly billing.

## Service Catalog

API:

- `GET /api/service-catalog`

The catalog defines reusable service types such as electricity, water, internet, trash, parking, cleaning, elevator, and security.

Catalog records are not edited through the current UI. Building and contract service rows reference catalog records and carry operational pricing settings.

## Building Services

Routes:

- `/buildings/[id]/settings`

API:

- `GET /api/building-services`
- `POST /api/building-services`
- `PATCH /api/building-services/[id]`

Building services define defaults per building:

- enabled/disabled
- amount
- pricing type

These defaults are used when creating or syncing contract services.

## Contract Services

API:

- `GET /api/contract-services`
- `GET /api/contract-services/by-building`
- `PATCH /api/contract-services/[id]`
- `POST /api/contract-services/sync`

Contract services are per-contract billable service rows.

They can override:

- enabled/disabled state
- amount
- quantity
- notes

Monthly billing includes enabled contract services as invoice charges.

## Sync Flow

The building settings screen can sync missing building service defaults into active contracts for that building.

Sync should add missing rows without overwriting existing per-contract customizations.

## Meter Readings

Routes:

- `/buildings/[id]/meter-readings`

API:

- `GET /api/meter-readings`
- `POST /api/meter-readings`
- `PATCH /api/meter-readings/[id]`
- `GET /api/meter-readings/bulk`
- `POST /api/meter-readings/bulk`

Meter readings are keyed by:

- room
- meter type
- period year
- period month
- reading type

Meter types:

- `electricity`
- `water`

Reading types:

- `monthly`
- `handover_in`
- `handover_out`

## Billing Interaction

Billing draft calculation uses:

- current monthly reading
- previous monthly reading
- handover fallback when previous monthly reading is missing
- utility usage override when readings imply invalid usage or meter replacement/reset

Negative consumption blocks issuing until corrected through an override.

## Implementation Files

Service catalog:

- `server/services/service-catalog/index.ts`
- `server/repositories/service-catalog/index.ts`
- `app/utils/mappers/service-catalog.ts`

Building services:

- `app/components/buildings/BuildingServiceSettings.vue`
- `app/components/buildings/BuildingServicesMatrix.vue`
- `app/composables/buildings/useBuildingServices.ts`
- `server/services/building-services/index.ts`
- `server/repositories/building-services/index.ts`

Contract services:

- `app/components/contracts/ContractServicesTab.vue`
- `app/composables/contracts/useContractServices.ts`
- `server/services/contract-services/index.ts`
- `server/repositories/contract-services/index.ts`

Meter readings:

- `app/components/buildings/MeterReadingBulkInput.vue`
- `app/composables/buildings/useBuildingMeterReadings.ts`
- `server/services/meter-readings/index.ts`
- `server/repositories/meter-readings/index.ts`
- `app/utils/validators/meter-readings.ts`
- `app/utils/mappers/meter-readings.ts`
