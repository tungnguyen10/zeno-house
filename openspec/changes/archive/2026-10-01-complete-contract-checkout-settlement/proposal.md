## Why

Termination currently releases a room without preserving an actual checkout date, charging final utility consumption, or settling held deposits. Same-month occupants share meter identities and can overwrite one another in billing.

## What Changes

- Add contract checkout, final utility charges, an auditable deposit/credit ledger, atomic settlement and refund recording.
- Keep contract expiration unchanged; release occupancy independently from financial completion.
- Preserve contract-specific handover readings and display multiple contracts per room in billing.
- Separate non-cash settlement from cash receipts in reports; add printable settlement statements.
- Gate rollout by building; reconcile ambiguous legacy data without guessing.

## Capabilities

### New Capabilities
- `contract-checkout-settlement`: End-to-end checkout, final invoices, settlement, refunds and migration safeguards.

### Modified Capabilities
- `billing-api`: Checkout-aware final billing and multiple contracts per room.
- `contract-payments`: Held-deposit ledger and protected allocated sources.
- `operations-report`: Separate settlement allocations and refunds from cash receipts.

## Impact

Contract, meter, billing, payment and report services; Supabase schema and transactional RPCs; contract and billing UI; permission map; tests and rollout docs. No automatic rent/service recalculation, bank transfer or production enablement.
