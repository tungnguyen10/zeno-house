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
