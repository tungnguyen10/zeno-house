# Contracts And Occupancy

Contracts are the central operational entity connecting buildings, rooms, tenants, services, payments, occupants, handover readings, and billing.

## User Routes

- `/contracts`: contract list.
- `/contracts/create`: create wizard.
- `/contracts/[id]`: contract detail.
- `/contracts/[id]/edit`: contract edit.

`/contracts/create` can be pre-filled with `?room_id=...`.

## Core Fields

Contracts include:

- building
- room
- tenant
- start and end date
- status
- monthly rent
- deposit
- payment day
- occupant count
- discount amount
- surcharge amount
- contract code

Statuses:

- `active`
- `expired`
- `terminated`

## Occupancy Side Effects

Creating an active contract marks the room as occupied.

Terminating or expiring a contract releases the room back to available unless the room is in maintenance.

These side effects belong in the service layer, not in UI code.

## Handover Readings On Create

Creating a new contract is the moment the room is handed over to the tenant. The create flow requires:

- `handover_electricity_reading` (kWh)
- `handover_water_reading` (m³)
- `handover_reading_date` (optional, defaults to `start_date`)

The server inserts the contract and the two `handover_in` meter readings in one Postgres function (`create_contract_with_handover`) so a contract row is never created without its baseline meter values.

The form pre-fills the two inputs with the latest reading per meter type (handover or monthly, whichever is newest). A soft amber warning appears when the user enters a value lower than the previous reading — submit is not blocked, since meter replacement legitimately resets the count.

Renewals (extend or new_contract mode) intentionally do not capture handover readings. The successor uses the predecessor's last reading as the baseline; collecting new readings would invent gaps.

## Contract Detail Surface

The detail page includes:

- core contract information
- room and tenant links
- occupants/roommates
- contract payments
- renewals
- contract services
- handover readings

## Occupants

Occupants are managed through nested contract APIs:

- `GET /api/contracts/[id]/occupants`
- `POST /api/contracts/[id]/occupants`
- `PATCH /api/contracts/[id]/occupants/[occupantId]`
- `DELETE /api/contracts/[id]/occupants/[occupantId]`

Occupant data also influences water billing when the building uses per-person pricing. Billing falls back to `contract.occupant_count` when counted occupant rows are unavailable.

## Contract Payments

Contract payments are separate from billing invoice payments.

They are used for contract lifecycle payments such as:

- deposit
- prepaid rent
- rent
- other

Invoice collection during monthly operations is stored in `invoice_payments`.

## Renewals

Renewal flow supports:

- extending the current contract
- creating a new contract

Renewals are exposed by:

- `GET /api/contracts/[id]/renewals`
- `POST /api/contracts/[id]/renew`

## Contract Services

When a contract is created, building service defaults can be cloned into contract services.

Contract services can then override:

- enabled/disabled state
- amount
- quantity
- notes

Building settings can sync missing service rows into active contracts for the building.

## Handover Readings

Contracts use handover readings for electricity and water:

- `handover_in` at move-in/create time
- `handover_out` when terminated or expired

Monthly billing can use handover-in as a fallback previous reading when prior monthly readings are missing.

## Important Files

- Contract form: `app/components/contracts/ContractForm.vue`
- Contract services tab: `app/components/contracts/ContractServicesTab.vue`
- Occupant form: `app/components/contracts/ContractOccupantForm.vue`
- Payment form: `app/components/contracts/ContractPaymentForm.vue`
- Renewal form: `app/components/contracts/ContractRenewalForm.vue`
- Handover readings: `app/components/contracts/ContractHandoverReadings.vue`
- Contract service: `server/services/contracts/index.ts`
- Contract repository: `server/repositories/contracts/index.ts`
- Validators: `app/utils/validators/contracts.ts`
- Mappers: `app/utils/mappers/contracts.ts`
