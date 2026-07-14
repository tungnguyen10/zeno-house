# Services And Meter Readings

Services and meter readings feed contract pricing and monthly billing.

## Service Catalog

API:

- `GET /api/service-catalog`
- `POST /api/service-catalog`

The catalog defines reusable service types such as internet, trash, parking, cleaning, elevator, surcharge, and other.

Global catalog records are seeded by migrations. The building settings UI can create building-scoped custom catalog records when a building needs a service outside the default list. Custom records are visible only when listing the catalog for that building.

Building and contract service rows reference catalog records and carry operational pricing settings.

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
- optional building-specific custom catalog item

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
- `GET /api/meter-readings/latest?room_id=...` — latest reading per meter type for a room; returns `{ electricity, water }` (each may be `null`). Used by the contract create form to pre-fill the handover inputs.
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

Contract create writes one `handover_in` row per meter type (electricity + water) atomically with the contract via the `create_contract_with_handover` Postgres function — see [`contracts.md`](./contracts.md#handover-readings-on-create). Renewals do not write handover rows; the successor inherits the predecessor's last reading as its baseline.

## Billing Interaction

Billing draft calculation uses:

- current monthly reading
- previous monthly reading
- handover fallback when previous monthly reading is missing
- utility usage override when readings imply invalid usage or meter replacement/reset

Negative consumption blocks issuing until corrected through an override.

## AI Import And Correction

The internal assistant can preview a delimited meter block pasted in the current user message. The model never copies numeric rows into tool arguments: the server reloads the owned stored message and parses it deterministically.

Supported input has a header containing `room`/`phòng` and at least one electricity/water column, with tab, comma, or semicolon delimiters. Exact room UUID, code, slug, or room number resolution occurs only inside the selected scoped building. Preview returns line-specific blockers and warnings; an action card is created only when the normalized payload is commit-ready.

Confirmation commits the exact previewed payload through `save_meter_readings_with_audit`. The same RPC backs direct create, bulk, and PATCH service paths, so all reading rows and `reading.saved` audits commit or roll back together. PATCH requires `expected_updated_at`; stale writes return 409 instead of overwriting newer data.

Monthly reading writes are blocked when the matching billing period is closed or the room already has a non-void invoice. The checks run in services and again inside the transaction. Contract handover readings remain outside monthly billing locks.

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
