## Why

Rental contracts expire and need renewal. Without a structured renewal model, landlords either overwrite the old contract (losing pricing history) or create disconnected new contracts. The system needs to support both simple renewals (extend end date) and full renewals with new terms (new contract linked to the old one).

## What Changes

- Add `previous_contract_id` (nullable FK self-reference) and `renewal_count` to `contracts` table
- Add `original_end_date` to preserve the original end date before extensions
- Add contract status `renewed` (for contracts superseded by a newer contract)
- Add `contract_renewals` log table to record each renewal event with old/new terms
- New API: `POST /api/contracts/:id/renew` supporting both simple extension and full renewal with new contract
- Contract detail page shows renewal history and previous contract link

## Capabilities

### New Capabilities
- `contract-renewal`: Renew a contract by extending its end date (simple) or creating a successor contract (full renewal with changed terms)

### Modified Capabilities
- `contracts-client`: Contract detail page gains renewal action and history display
- `contracts-database`: contracts table gains `previous_contract_id`, `renewal_count`, `original_end_date`; new status `renewed`
