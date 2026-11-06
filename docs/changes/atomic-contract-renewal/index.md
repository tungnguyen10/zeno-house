# Atomic contract renewal (ZH-CTR-01)

This is an **in-progress OKF change**, not an accepted capability or proof of production deployment. Superpowers drives the execution; the OKF files here are the only design and plan record for this change.

## Change documents

- [Design and decisions](./design.md) — proposed behavior and technical contracts
- [Single implementation checklist](./implementation-plan.md) — executable Superpowers TDD plan and verification evidence

## Accepted capabilities to reconcile on approval

- [contract-renewal](../../capabilities/contract-renewal.md)
- [contract-occupants-api](../../capabilities/contract-occupants-api.md)
- [contract-payments](../../capabilities/contract-payments.md)
- [contract-checkout-settlement](../../capabilities/contract-checkout-settlement.md)

## Verification boundary

Migration and application paths exist; validate atomicity, idempotency, occupant/service/deposit transfers and rollout before acceptance.
