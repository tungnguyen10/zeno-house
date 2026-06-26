## Why

When a new contract is created (room handover to a new tenant), the system today lets the admin save the contract without entering the room's initial electricity and water meter readings. Those readings (`handover_in`) are only captured later as an optional section on the contract detail page. In practice the admin reads the meters at the exact moment of handover, so capturing them later is friction and a common source of forgotten data. When `handover_in` is missing, the first month's billing has no previous reading to subtract from and falls back to skipping or estimating electricity/water lines — leading to lost revenue or back-and-forth corrections.

Renewals are different: they continue an existing meter line and do not need a new `handover_in` reading.

## What Changes

- **BREAKING**: `POST /api/contracts` SHALL require `handover_electricity_reading` and `handover_water_reading` input (number + reading_date) when creating a contract that opens a new handover (i.e. not a renewal). The service SHALL create the contract and the two `meter_readings` rows with `reading_type = 'handover_in'` atomically in one transaction. If any of the three writes fails, the whole operation is rolled back.
- The Create Contract page (`/contracts/create`, Step 1 — Thông tin hợp đồng) SHALL include two new required inputs in `ContractForm`: "Số điện đầu vào" and "Số nước đầu vào", plus a single "Ngày đọc" date input that defaults to `start_date`. Client-side Zod validation matches server rules.
- The form SHALL pre-fill the two number inputs with the room's last known reading per meter type, when available. Pre-fill priority: latest `handover_out` for the room → latest `monthly` for the room → empty. A small reference label SHALL display the source ("Số cuối: 1310 — handover_out 2026-07-31"). The admin can override the value freely.
- A soft validation warning (not blocking) SHALL appear if the entered value is less than the pre-filled reference, asking the admin to confirm a meter replacement. No new "meter replaced" flag is introduced in this change.
- Renewals (`POST /api/contracts/:id/renew`) are explicitly out of scope. They continue the existing meter line and do not collect new handover readings.
- Existing contracts in the database are not backfilled. The contract detail page's "Số bàn giao" section remains as the place to add or correct handover readings on legacy contracts.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `contracts-api`: `POST /api/contracts` now requires handover reading inputs and creates the contract plus two `meter_readings` rows atomically.
- `contracts-client`: `ContractForm` on the create page gains two required number inputs and one date input for the handover readings, with pre-fill from the room's last reading and soft validation.
- `meter-readings-api`: A query SHALL expose, per room and per meter type, the latest reading (regardless of `reading_type`) so the client can pre-fill the form.

## Impact

- **Server**:
  - `server/api/contracts/index.post.ts` and `server/services/contracts/` change shape and transaction boundary.
  - `app/utils/validators/contracts.ts` gains two reading fields + a date field.
  - `server/services/meter-readings/` exposes a "latest reading per room and meter type" helper or query usable from contract create.
  - New permission combination: contract create now also writes to `meter_readings`. Existing capability check `contracts.create` + `meter-readings.write` SHALL both apply.
- **Client**:
  - `app/components/contracts/ContractForm.vue` gains the new fields and pre-fill logic.
  - `app/composables/contracts/useContractForm.ts` loads the latest readings for the selected room when `room_id` changes.
  - `app/pages/contracts/create.vue` and the Step 1 layout integrate the new section without breaking existing Step 2/3 flow.
- **Tests**:
  - Server tests cover atomic create (success + rollback on reading failure), validation, and renewal exemption.
  - Client tests cover pre-fill, soft warn on lower value, and submit shape.
- **Data**:
  - No DB migration required. Schema already supports room-based `meter_readings` (post `20260530400000_simplify_meter_readings.sql`).
  - Legacy contracts unaffected — contract detail's "Số bàn giao" section still serves backfill and correction.
- **Docs**:
  - `docs/features/contracts.md` and `docs/features/services-meter-readings.md` need a short note about the new handover-at-create flow.
