# Contracts And Occupancy

Contracts are the central operational entity connecting buildings, rooms, tenants, services, payments, occupants, handover readings, and billing.

## User Routes

- `/contracts`: contract list with URL-synced search, filters, sorting, pagination, and admin bulk actions.
- `/contracts/create`: three-step create wizard.
- `/contracts/[id]`: contract detail with hero stats, section anchors, and admin danger zone.
- `/contracts/[id]/edit`: sectioned contract edit form with dirty guard and draft autosave.

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
- `renewed`

## List Search, Sort, And Bulk Actions

`GET /api/contracts` validates query params with Zod before invoking the service. Supported query state:

- `page`, `limit`
- `q` searching contract code, tenant name, and room number
- `building_id`, `room_id`, `tenant_id`
- multi-value `status`
- `sort`: `created_at`, `start_date`, `end_date`, `monthly_rent`
- `order`: `asc`, `desc`

The list page keeps these controls in the URL so filtered views can be shared. Selected contracts open a per-contract return queue; each contract needs its own date, reason, and final readings. Admin users can bulk-delete contracts that pass the safe-delete checks.
Bulk delete requires a non-empty reason and a strong opt-in acknowledgement. After bulk actions finish, the list page clears selection in its `onDone` handler and refreshes the keyed list (`contracts:list`) so the filtered view shows the latest server state immediately.

## Occupancy Side Effects

Creating an active contract marks the room as occupied.

The return RPC terminates the contract, closes every active occupant's move-out date, and releases the room unless it is in maintenance or another active contract occupies it. The signed end date stays unchanged. Direct active-to-terminated/expired PATCH and bulk termination are rejected.

These side effects belong in the service layer, not in UI code.

## Handover Readings On Create

Creating a new contract is the moment the room is handed over to the tenant. The create flow requires:

- `handover_electricity_reading` (kWh)
- `handover_water_reading` (m³)
- `handover_reading_date` (optional, defaults to `start_date`)

The server inserts the contract and the two `handover_in` meter readings in one Postgres function (`create_contract_with_handover`) so a contract row is never created without its baseline meter values.

The form pre-fills the two inputs with the latest reading per meter type (handover or monthly, whichever is newest). A soft amber warning appears when the user enters a value lower than the previous reading — submit is not blocked, since meter replacement legitimately resets the count.

Handover-out readings submitted via `/api/meter-readings/bulk` are validated server-side: if the `handover_out` value is less than the most recent `handover_in` for the same room and meter type, the server rejects the save with a `VALIDATION_ERROR`.

Renewals (extend or new_contract mode) intentionally do not capture handover readings. The successor uses the predecessor's last reading as the baseline; collecting new readings would invent gaps.

## Contract Detail Surface

The detail page includes:

- hero header with contract code, status, building / room / tenant breadcrumb, and quick stats
- sticky section navigation
- core contract information
- room and tenant links
- occupants/roommates
- contract payments
- history section combining renewals and contract-scoped audit events
- contract services
- handover readings
- readable contract term diffs such as monthly rent, dates, deposit, payment day, status, and notes; raw audit snapshots are admin-only
- admin-only danger zone for edit, renew, terminate, and delete

### Contract amendments

The detail page owns a separate **Phụ lục hợp đồng** timeline. Authorized users can create and edit drafts with optimistic concurrency, publish a draft, delete only a draft, or cancel only a scheduled amendment with a reason. Publishing freezes full before/after term snapshots. An amendment effective today is applied immediately; a future amendment becomes `scheduled` and the private worker applies it when due.

Supported structured changes are monthly rent, deposit, payment due day, occupant count, discount, and surcharge. Missing JSON keys mean unchanged; a null payment due day clears the contract override and restores building inheritance. Recurring billing fields require the first day of a month, while a deposit-only change can use another date. Publication is rejected when the effective month already has a non-void invoice.

`contracts` remains the current-term snapshot used by billing and existing consumers. Applied amendments and published history are immutable; corrections require a new amendment. Renewal and termination cancel any scheduled amendment with a system reason in the same database transaction as the contract lifecycle change. Published, applied, or previously scheduled/cancelled amendments block hard deletion of the contract; draft amendments and their audit records are handled atomically with the allowed contract deletion.

Delete conflicts are displayed as a checklist of blockers. Active contracts must pass through return first; `DELETE ?force=true` cannot bypass the handover. Billing, paid payment, and non-handover meter-reading history still block deletion.

## Form Drafts And Dirty Guards

The create wizard and edit form use localStorage drafts:

- `contract-form:create`
- `contract-form:edit:<id>`

Drafts include `draftVersion`, saved timestamp, form data, and create-wizard state (`currentStep`, pending occupants, selected services). Draft presence is evaluated after client mount so SSR/hydration output stays stable. A restore alert appears when a compatible draft exists; mismatched versions can only be deleted.

Both create and edit routes protect unsaved changes with route-leave and browser unload guards. Moving between wizard steps does not trigger the guard.

## Safe Delete And Force Delete

Default `DELETE /api/contracts/[id]` is a hard delete only when the contract has no protected history. The service aggregates blockers into a single `409 CONFLICT` details object:

- `reason: ACTIVE_CONTRACT`
- `issuedBillingPeriods`
- `paidPayments`
- `nonHandoverMeterReadings`
- `publishedAmendments`

`DELETE /api/contracts/[id]?force=true` cannot terminate an active contract. A returned contract retains protected checkout history and cannot be hard-deleted.

The bulk endpoint rejects `action: 'terminate'`; the list offers links to each selected contract's return form. Bulk delete still returns per-item partial success.

## Occupants

Occupants are managed through nested contract APIs:

- `GET /api/contracts/[id]/occupants`
- `POST /api/contracts/[id]/occupants`
- `PATCH /api/contracts/[id]/occupants/[occupantId]` — records move-out date (requires `contracts.update`)
- `DELETE /api/contracts/[id]/occupants/[occupantId]` — removes occupant record (requires `contracts.delete`)

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

Contract services can be removed from the detail page. Deletion requires a non-empty reason and is gated on `contracts.delete`. The detail page `ContractServicesTab` renders a delete button per row when the user has this capability.

Building settings can sync missing service rows into active contracts for the building.

## Handover Readings

Contracts use handover readings for electricity and water:

- `handover_in` at move-in/create time
- `handover_out` when terminated or expired

Monthly billing can use handover-in as a fallback previous reading when prior monthly readings are missing.

## Checkout And Settlement

Physical return is available for every building after the checkout schema is deployed. Deposit/credit settlement is gated per building by `server/utils/checkout-feature.ts` (runtime-config flag + building allowlist), disabled until the one-building pilot passes staging checks. A returned contract remains in the final-month billing queue until its final charges are issued. Checkout history stays protected even if the pilot flag is later disabled — see "Contract Checkout And Settlement Model" in `docs/architecture/database.md`.

Flow on the contract detail page (`ContractCheckoutSection.vue`, section `#checkout`):

1. **Return** — enter the actual return date, reason, and physical final readings. Metered utilities require a reconciled billed or handover-in baseline. One RPC records readings, terminates the contract, closes occupants, releases the room, freezes prices/services, and audits the handover. A closed billing period does not block physical return.
2. **Final calculation** — rent, each service, and fixed/per-person utilities default to inclusive-day proration through the return date; each can be set to full month or waived with a reason. Metered utilities charge only usage since the last billed reading; incidental fees are separate. Existing issued/paid lines are shown and never rewritten or billed twice. The checkout timestamp is an optimistic version for mode edits.
3. **Standard final bill** — outside the pilot, a dedicated RPC issues only missing final lines. No deposit or approved credit is allocated automatically.
4. **Pilot settlement** — approve credit from unapplied `other`/`prepaid_rent` receipts. One confirmation transaction posts missing final lines and allocates approved credit then deposit to the oldest open invoices. A closed financial period blocks this step pending reconciliation.
5. **Refund** — record an already-performed refund transfer against the confirmed statement (this never initiates a bank transfer itself).
6. **Correction** — after confirmation, a signed adjustment to an active invoice for reconciliation, without rewriting the original statement or past refunds.

A printable settlement statement is available at `/dashboard/contracts/[code]/settlement/print`. Deposit/credit allocations and refunds use `invoice_payments.funding_source` (`deposit`/`credit`), so billing/report cash totals (`funding_source = 'cash'`) never include them; undoing a non-cash payment is blocked outside this flow (`server/services/billing/undo-payment.ts`).

## Important Files

- Contract form: `app/components/contracts/ContractForm.vue`
- Contract services tab: `app/components/contracts/ContractServicesTab.vue`
- Occupant form: `app/components/contracts/ContractOccupantForm.vue`
- Payment form: `app/components/contracts/ContractPaymentForm.vue`
- Renewal form: `app/components/contracts/ContractRenewalForm.vue`
- Detail overview panel: `app/components/contracts/ContractOverviewPanel.vue`
- Detail occupants section: `app/components/contracts/ContractOccupantsSection.vue`
- Detail payments section: `app/components/contracts/ContractPaymentsSection.vue`
- Renewal history list: `app/components/contracts/ContractRenewalHistoryList.vue`
- Payment/renewal label constants: `app/utils/constants/contracts.ts`
- Handover readings: `app/components/contracts/ContractHandoverReadings.vue`
- Contract service: `server/services/contracts/index.ts`
- Checkout section: `app/components/contracts/ContractCheckoutSection.vue`
- Checkout composable: `app/composables/contracts/useContractCheckout.ts`
- Settlement statement: `app/pages/dashboard/contracts/[code]/settlement/print.vue`
- Checkout service: `server/services/checkout.ts`
- Checkout repository: `server/repositories/checkout.ts`
- Checkout feature gate: `server/utils/checkout-feature.ts`
- Contract repository: `server/repositories/contracts/index.ts`
- Contract amendment service/repository: `server/services/contract-amendments.ts`, `server/repositories/contract-amendments/index.ts`
- Contract amendment UI: `app/components/contracts/ContractAmendmentsSection.vue`
- Validators: `app/utils/validators/contracts.ts`
- Mappers: `app/utils/mappers/contracts.ts`
