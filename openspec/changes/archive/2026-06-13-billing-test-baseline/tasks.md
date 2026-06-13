## 1. Framework setup

- [x] 1.1 Install dev dependencies: `vitest`, `@vue/test-utils`, `happy-dom`, `@vitest/coverage-v8`, `vite-tsconfig-paths`.
- [x] 1.2 Create `vitest.config.ts` at repo root:
  - [x] 1.2.1 Plugin `vite-tsconfig-paths` to resolve `~/`, `@/` aliases.
  - [x] 1.2.2 `test.environment` = `'happy-dom'`.
  - [x] 1.2.3 `test.globals = true` so `describe`, `it`, `expect`, `vi` available globally.
  - [x] 1.2.4 `coverage.provider = 'v8'`, `coverage.reporter = ['text', 'html']`.
  - [x] 1.2.5 `coverage.include` = `['server/services/billing/**']` (initially scoped narrow).
  - [x] 1.2.6 Coverage threshold set after measuring seeded baseline.
- [x] 1.3 Add scripts in `package.json`:
  - `"test": "vitest run"`
  - `"test:watch": "vitest"`
  - `"test:coverage": "vitest run --coverage"`
- [x] 1.4 Add `coverage/` to `.gitignore`.
- [x] 1.5 Sanity test: create `tests/sanity.test.ts` asserting `1+1===2`. Run `npm test` to verify pipeline.

## 2. Fixture builders

- [x] 2.1 Create `tests/__fixtures__/billing/period.ts` exporting `buildPeriod(overrides?: Partial<BillingPeriod>): BillingPeriod`.
- [x] 2.2 Create `tests/__fixtures__/billing/contract.ts` with `buildContract`, `buildContractCharges` (rent, discount, electricity service, water service config).
- [x] 2.3 Create `tests/__fixtures__/billing/reading.ts` with `buildReading` supporting `is_replacement`, `is_reset`, `requires_override`, override block.
- [x] 2.4 Create `tests/__fixtures__/billing/invoice.ts` with `buildInvoice`, `buildInvoicePayment`.
- [x] 2.5 Document fixture pattern in `tests/__fixtures__/README.md` (one short page).

## 3. Service refactor for testability

- [x] 3.1 Audit `server/services/billing/draft-calc.ts` / current `drafts.ts`; extract pure calculation rules into `server/services/billing/rules.ts`.
- [x] 3.2 Audit `server/services/billing/period-status.ts` / current `periods.ts` and invoice status logic; extract status helpers.
- [x] 3.3 Audit blocker logic (`findIssuanceBlockers`, `findUtilityBlocker`); add data-input helpers callable from tests.
- [x] 3.4 Audit adjustment service; add shared validation helper and wire it into `InvoiceService.addAdjustment`.
- [x] 3.5 Add minimal export of internal helpers needed by tests without exposing repository internals.

## 4. Draft calc tests

- [x] 4.1 `tests/server/billing/draft-calc.test.ts` - rent prorate by date.
- [x] 4.2 Discount applied after rent.
- [x] 4.3 Electricity per_kwh.
- [x] 4.4 Electricity tiered (multi-bracket).
- [x] 4.5 Electricity fixed.
- [x] 4.6 Electricity per_person.
- [x] 4.7 Water per_m3.
- [x] 4.8 Water per_person.
- [x] 4.9 Water fixed_per_room.
- [x] 4.10 Handover fallback when no current reading.
- [x] 4.11 Override block with `is_replacement` and `is_reset`.

## 5. Status transition tests

- [x] 5.1 `tests/server/billing/period-status.test.ts` - happy path drafted -> issued -> collecting -> closed.
- [x] 5.2 Block transitions from `closed`.
- [x] 5.3 `tests/server/billing/invoice-status.test.ts` - payment accumulation moves status to paid.
- [x] 5.4 Void from issued with no payments.
- [x] 5.5 Reissue creates linked invoice with `parent_invoice_id` / current `supersedesInvoiceId` link.

## 6. Blocker tests

- [x] 6.1 `tests/server/billing/blockers.test.ts` - missing electricity reading.
- [x] 6.2 Unresolved override block.
- [x] 6.3 Empty reason in override.
- [x] 6.4 All clear -> empty list.

## 7. Adjustment tests

- [x] 7.1 `tests/server/billing/adjustments.test.ts` - closed period blocked.
- [x] 7.2 Negative adjustment exceeding paid amount blocked.
- [x] 7.3 Reason length enforced for significant negative.
- [x] 7.4 Positive adjustment beyond total allowed.

## 8. Audit summary tests

- [x] 8.1 `tests/server/billing/audit-summary.test.ts` - all documented actions produce expected strings (snapshot or explicit equality).
- [x] 8.2 Optional metadata missing -> graceful output.
- [x] 8.3 Unknown action -> fallback.

## 9. Component smoke test

- [x] 9.1 `tests/components/billing/BillingDraftGridStep.spec.ts`:
  - [x] 9.1.1 Mount with 2 fixture rows.
  - [x] 9.1.2 Press Tab from first cell -> assert focus moved.
  - [x] 9.1.3 Simulate paste event with multi-line text -> assert downstream cells updated.
- [x] 9.2 Stub auto-imported composables/components as needed.

## 10. CI integration

- [x] 10.1 Update `.github/workflows/ci.yml` to add the test step after lint and typecheck.
- [x] 10.2 Add coverage upload artifact for inspection on failed runs.
- [x] 10.3 Verify CI-equivalent local commands pass (`npm run lint`, `npm run typecheck`, `npm test`, `npm run test:coverage`).

## 11. Coverage threshold rollout

- [x] 11.1 After tests are seeded, measure baseline coverage on `server/services/billing/`.
- [x] 11.2 Set thresholds in `vitest.config.ts` slightly below baseline to enforce no regression.
- [x] 11.3 Document expected coverage targets in `docs/architecture/rules.md` and `tests/README.md`.

## 12. Documentation

- [x] 12.1 Add `tests/README.md` with: how to run, fixture pattern, conventions for new tests.
- [x] 12.2 Update `README.md` quickstart with `npm test` line.
- [x] 12.3 Update `docs/project-status.md` v0.2.5 quality section noting test baseline established.
