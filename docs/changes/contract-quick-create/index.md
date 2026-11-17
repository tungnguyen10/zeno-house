# Contract quick create (V2 PR4a)

**Status: source merged; browser retry acceptance open.** One-page create, occupants, vehicles, services, inventory, server draft and atomic `create_contract_full` are integrated in `develop`. Production migrations/rollback SQL were reported verified 2026-11-15, including source-level idempotency. Browser lost-response retry and busy-occupant 409 scenarios remain open.

- [Design](./design.md)
- [Implementation plan](./implementation-plan.md)
- [Verification](./verification.md)
- Parent brief: [ZENO House V2 — Flow Optimization Brief](../zeno-house-v2-optimization/brief.md)

## Capabilities to update on acceptance

- [contracts-api](../../capabilities/contracts-api.md)
- [contracts-ui](../../capabilities/contracts-ui.md)
- [contracts-client](../../capabilities/contracts-client.md)
- [contracts-database](../../capabilities/contracts-database.md)
- [contract-occupants-api](../../capabilities/contract-occupants-api.md)
