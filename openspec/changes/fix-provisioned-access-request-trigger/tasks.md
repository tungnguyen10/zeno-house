## 1. Regression coverage

- [x] 1.1 Add failing migration contract tests for deferred final-state evaluation and safe stale-request reconciliation
- [x] 1.2 Extend rollback-safe database verification with Supabase's insert-then-role-update sequence and lifecycle preservation assertions

## 2. Database correction

- [x] 2.1 Add a Supabase migration that replaces the immediate trigger with a deferred constraint trigger reading current Auth state
- [x] 2.2 Reconcile only untouched role-bearing pending requests with a system audit written before deletion

## 3. Audit contract and documentation

- [x] 3.1 Add the reconciliation audit constant and focused Vietnamese display label
- [x] 3.2 Update accepted pending-account and audit specs plus Auth/database documentation

## 4. Verification

- [x] 4.1 Run OpenSpec validation and focused access-request/user-provisioning tests
- [x] 4.2 Run typecheck, full tests, lint, and review the final diff
