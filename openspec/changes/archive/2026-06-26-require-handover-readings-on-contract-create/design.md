## Context

Contracts are created from `POST /api/contracts`. The current flow only persists contract fields; meter readings are entered later via the contract detail page's "Số bàn giao" section (`ContractHandoverReadings.vue`). After the `meter_devices` table was dropped (`supabase/migrations/20260530400000_simplify_meter_readings.sql`), `meter_readings` is identified by `(room_id, meter_type, period_year, period_month, reading_type)` with a unique constraint on that tuple — so handover readings can be written without any device lookup.

The billing engine already falls back to `handover_in` as the "previous reading" for a room's first billing month. Missing handover readings therefore translate directly into incorrect or skipped electricity/water lines in the first month.

The Create Contract page is multi-step today: Step 1 collects the contract data (and triggers create on submit), Step 2 manages pending occupants client-side, Step 3 shows auto-cloned services after creation. Handover readings must be captured before the API call, so they belong in Step 1.

Renewals are a distinct endpoint (`POST /api/contracts/:id/renew`) that bumps `renewal_count` and extends `end_date`. They do not transition the room to a new tenant and do not open a new meter line.

## Goals / Non-Goals

**Goals:**
- Make `handover_in` readings (electricity + water) part of the contract create contract — mandatory inputs, persisted in the same transaction as the contract row.
- Capture the readings at the moment that already feels natural to the admin (one form, one submit), reducing the chance of forgotten data.
- Pre-fill from the room's last known reading so the admin can sanity-check against the physical meter quickly.
- Keep the existing contract detail "Số bàn giao" section so legacy contracts and corrections still work.

**Non-Goals:**
- Backfilling readings for existing contracts in the database.
- Changing renewal flow. Renewals continue the existing meter line and do not collect new handover readings.
- Adding `handover_out` to a separate terminate flow (already handled elsewhere).
- Tracking a "meter replaced" event or a meter device entity. Lower-than-previous values only produce a soft client-side warning.
- Photo capture of the meter (separate future change).
- Changing how `period_year`/`period_month` are interpreted by billing. The `handover_in` row uses `period_year`/`period_month` derived from `reading_date`, consistent with current behaviour.

## Decisions

### D1 — Atomic create: contract row + 2 reading rows in one server transaction

`server/services/contracts/create.ts` orchestrates a single Supabase transaction that inserts:
1. The `contracts` row.
2. Two `meter_readings` rows with `reading_type = 'handover_in'`, one per `meter_type`.

If either reading insert fails (validation, RLS, unique conflict), the entire operation is rolled back and the API returns the same error envelope (`VALIDATION_ERROR` or `CONFLICT`). This is preferable to creating the contract first and then attempting the readings — a partial success leaves the system in exactly the buggy state we are trying to eliminate.

**Alternative considered:** Create contract first, then call meter-readings bulk endpoint. **Rejected** because it cannot guarantee atomicity and reintroduces the "forgot to fill readings" failure mode if the second call fails silently.

### D2 — Validation lives in `app/utils/validators/contracts.ts`

Adds three new fields to the create schema:
- `handover_electricity_reading: z.number().nonnegative()`
- `handover_water_reading: z.number().nonnegative()`
- `handover_reading_date: z.string().date()` (defaults to `start_date` if omitted)

Both client (`useContractForm`) and server (`POST /api/contracts`) import the same schema. The update schema (`PATCH /api/contracts/:id`) is **not** modified — handover readings cannot be changed via contract update; the existing meter-readings endpoints remain the path for corrections.

### D3 — Renewal is exempt by virtue of the endpoint, not a flag

Because renewals go through `POST /api/contracts/:id/renew`, no change to the renewal validator or service is needed. The create schema adds required fields and renewals never hit that schema. Documenting this exemption in the spec makes the intent explicit.

### D4 — Pre-fill uses a new "latest reading per room and meter type" query

`server/services/meter-readings/getLatestByRoom.ts` returns, for a given `room_id`, the latest `meter_readings` row per `meter_type` regardless of `reading_type` (so `handover_out` of a previous tenant naturally wins over older `monthly` rows). Exposed through `GET /api/meter-readings/latest?room_id=<id>` returning `{ data: { electricity: MeterReading | null, water: MeterReading | null } }`.

The client fetches this when `room_id` changes in the form and writes the values into the two number inputs (admin can override). A reference label shows the source row's `reading_type` and `reading_date` so the admin knows where the pre-fill came from.

**Alternative considered:** Compute latest reading inline in the GET `/api/contracts` query that loads available rooms. **Rejected** — couples two unrelated concerns and forces a heavier response for the list of rooms.

### D5 — Lower-than-previous is a soft client warning, not a server reject

If the admin enters a value less than the pre-filled reference, `ContractForm` shows an inline amber note: "Số mới thấp hơn số cũ. Đồng hồ vừa được thay?" The submit is not blocked. The server does not enforce this rule because legitimate meter replacement is a normal occurrence and we do not yet have a "meter replaced" flag (out of scope).

### D6 — Permission check unchanged

`contracts.create` capability already governs `POST /api/contracts`. Writing two `meter_readings` rows from the same service call extends the same authorization scope; we do not require an additional `meter-readings.write` check at the API boundary, because the rows are not user-addressable inputs — they are derived from the contract create payload. This keeps the permission model coherent (one capability, one entry point).

## Risks / Trade-offs

- **[Risk] Existing tooling that POSTs `/api/contracts` (tests, scripts, future integrations) breaks because of the new required fields.** → Mitigation: this is the explicit BREAKING in the proposal. Server-side test fixtures and any seed scripts are updated as part of tasks.md. Document the new contract in `docs/features/contracts.md`. No API versioning is introduced — v0.x project, single internal consumer.
- **[Risk] Meter replaced silently: admin overrides a higher pre-filled value with a much lower one, billing engine then reads a small `handover_in` and the first month's consumption looks negative or absurdly large.** → Mitigation: soft warning in the form. Acceptable for v0.x. A future "meter replaced" event is the long-term fix.
- **[Risk] Transaction boundary leaks: Supabase JS client does not give native transactions over multiple table inserts.** → Mitigation: use a single Postgres function (`create_contract_with_handover`) called via RPC, which performs all three inserts inside a SQL transaction. Repository layer is the only place that needs to know about the RPC.
- **[Risk] Pre-fill query adds an extra round-trip on every `room_id` change.** → Mitigation: small, indexed query (`room_id` + ordering). The endpoint is cached by `useFetch` keyed on `room_id` — same room twice in one session reuses the cache.
- **[Trade-off] We do not validate `reading_date` against `start_date` server-side.** Some admins may want to record a meter read taken a day before move-in. Restricting equality would be over-eager. The client defaults to `start_date` so the common case is correct without policy enforcement.

## Migration Plan

- **DB**: No schema migration required. The existing `meter_readings` table and unique constraint are sufficient. Add a Postgres function `create_contract_with_handover(...)` invoked from the contracts repository.
- **Backfill**: None. Legacy contracts keep their current state. The contract detail page's "Số bàn giao" section continues to be the place to add or correct handover readings on legacy rows.
- **Rollout order**:
  1. Add the Postgres function migration.
  2. Update server schema + service + repository.
  3. Update client validator + form + composable.
  4. Update tests.
  5. Update `docs/features/contracts.md` and `docs/features/services-meter-readings.md`.
- **Rollback**: drop the Postgres function and revert server/client changes. Existing `meter_readings` rows produced by the new flow remain valid because they use the same schema as the legacy path.
