## 1. Database

- [x] 1.1 Add Postgres function `create_contract_with_handover(...)` that inserts the contract row and two `meter_readings` rows in one transaction. Migration file: `supabase/migrations/<timestamp>_create_contract_with_handover.sql`.
- [x] 1.2 Regenerate Supabase types into `app/types/database.types.ts`.

## 2. Validators & types

- [x] 2.1 Extend the create schema in `app/utils/validators/contracts.ts` with `handover_electricity_reading`, `handover_water_reading`, `handover_reading_date` (optional, defaults to `start_date`).
- [x] 2.2 Add corresponding fields to the create input type in `app/types/contracts.ts`.
- [x] 2.3 Ensure the update schema and the renewal schema do not accept these fields (or strip them).

## 3. Server

- [x] 3.1 In `server/repositories/contracts/`, add a `createWithHandover` method that calls the new RPC and returns the created contract.
- [x] 3.2 Update `server/services/contracts/` create flow to derive `period_year`/`period_month` from `handover_reading_date`, build the two reading payloads, and call `createWithHandover` instead of the existing insert.
- [x] 3.3 Update `server/api/contracts/index.post.ts` to validate the new fields via the extended Zod schema and map RPC errors to the API error envelope (`VALIDATION_ERROR`, `CONFLICT`).
- [x] 3.4 Add `GET /api/meter-readings/latest` in `server/api/meter-readings/latest.get.ts` returning `{ data: { electricity, water } }`.
- [x] 3.5 Implement `server/services/meter-readings/getLatestByRoom.ts` querying `meter_readings` ordered by `(period_year DESC, period_month DESC, reading_date DESC)` per `meter_type`. Accepts an optional `before_date` filter so callers (e.g. contract detail prefill) can request the latest reading strictly before a given date.

## 4. Client

- [x] 4.1 In `app/components/contracts/ContractForm.vue`, add the "Số bàn giao đầu vào" section with electricity + water number inputs, the date input, and the reference labels.
- [x] 4.2 In `app/composables/contracts/useContractForm.ts`, when `room_id` changes, fetch `/api/meter-readings/latest` and pre-fill the two number inputs; expose the reference data to the component.
- [x] 4.3 Add the soft "lower than previous" warning logic in `ContractForm`.
- [x] 4.4 Wire client-side Zod validation to match the extended server schema, surface field-level errors.
- [x] 4.5 Confirm `app/pages/contracts/create.vue` still renders Step 1/2/3 correctly with the new fields included in Step 1.

## 5. Tests

- [x] 5.1 Server test: `POST /api/contracts` create success persists contract + two `handover_in` meter readings (electricity + water) with correct period derived from `handover_reading_date`.
- [x] 5.2 Server test: missing `handover_electricity_reading` returns 422 and no contract row is created.
- [x] 5.3 Server test: simulated reading insert failure rolls back the contract row (no orphan).
- [x] 5.4 Server test: renewal endpoint ignores `handover_electricity_reading` if passed and does not create meter readings.
- [x] 5.5 Server test: `GET /api/meter-readings/latest` returns latest per meter_type for an occupied room and `{ electricity: null, water: null }` for a brand new room.
- [x] 5.6 Client test: `ContractForm` pre-fills handover inputs when `room_id` changes and a latest reading exists.
- [x] 5.7 Client test: soft warning appears when value is lower than reference; submit not blocked.

## 6. Docs

- [x] 6.1 Update `docs/features/contracts.md` describing handover readings as part of the create flow.
- [x] 6.2 Add a short note in `docs/features/services-meter-readings.md` referencing the new `/api/meter-readings/latest` endpoint and that contract create now writes `handover_in` rows.
