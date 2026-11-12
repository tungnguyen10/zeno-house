# Atomic billing close/reopen (ZH-BIL-01)

**Status: verification-pending.** SQL scenarios passed on production 2026-11-09; historical-data reconciliation and financial release sign-off remain open.

- [Original design](./design.md)
- [Original implementation plan](./implementation-plan.md)
- [Latest evidence and archive gates](./verification.md)

## Accepted capabilities

- [billing-period-close](../../capabilities/billing-period-close.md)
- [billing-api](../../capabilities/billing-api.md)
- [reserve-fund](../../capabilities/reserve-fund.md)
- [operations-report](../../capabilities/operations-report.md)

Do not treat the old unchecked TDD steps as a negative test result or the successful rolled-back SQL verification as proof that all legacy financial data is reconciled.
