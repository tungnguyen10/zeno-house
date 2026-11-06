# Atomic billing close/reopen (ZH-BIL-01)

This is an **in-progress OKF change**, not an accepted capability or proof of production deployment. Superpowers drives the execution; the OKF files here are the only design and plan record for this change.

## Change documents

- [Design and decisions](./design.md) — proposed behavior and technical contracts
- [Single implementation checklist](./implementation-plan.md) — executable Superpowers TDD plan and verification evidence

## Accepted capabilities to reconcile on approval

- [billing-period-close](../../capabilities/billing-period-close.md)
- [billing-api](../../capabilities/billing-api.md)
- [reserve-fund](../../capabilities/reserve-fund.md)
- [operations-report](../../capabilities/operations-report.md)

## Verification boundary

Preserve read-only reconciliation-first requirement and separately validate financial locks, idempotency, cloud migration and stored accrual data.
