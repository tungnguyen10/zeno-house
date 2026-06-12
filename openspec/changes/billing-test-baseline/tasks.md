## 1. Framework setup

- [ ] 1.1 Install dev dependencies: `vitest`, `@vue/test-utils`, `happy-dom`, `@vitest/coverage-v8`, `vite-tsconfig-paths`.
- [ ] 1.2 Create `vitest.config.ts` at repo root:
  - [ ] 1.2.1 Plugin `vite-tsconfig-paths` to resolve `~/`, `@/` aliases.
  - [ ] 1.2.2 `test.environment` = `'happy-dom'`.
  - [ ] 1.2.3 `test.globals = true` so `describe`, `it`, `expect`, `vi` available globally.
  - [ ] 1.2.4 `coverage.provider = 'v8'`, `coverage.reporter = ['text', 'html']`.
  - [ ] 1.2.5 `coverage.include` = `['server/services/billing/**']` (initially scoped narrow).
  - [ ] 1.2.6 Coverage threshold (initial soft target — set after seeding tests; can use `0` first and tighten later).
- [ ] 1.3 Add scripts in `package.json`:
  - `"test": "vitest run"`
  - `"test:watch": "vitest"`
  - `"test:coverage": "vitest run --coverage"`
- [ ] 1.4 Add `coverage/` to `.gitignore`.
- [ ] 1.5 Sanity test: create `tests/sanity.test.ts` asserting `1+1===2`. Run `npm test` to verify pipeline.

## 2. Fixture builders

- [ ] 2.1 Create `tests/__fixtures__/billing/period.ts` exporting `buildPeriod(overrides?: Partial<BillingPeriod>): BillingPeriod`.
- [ ] 2.2 Create `tests/__fixtures__/billing/contract.ts` with `buildContract`, `buildContractCharges` (rent, discount, electricity service, water service config).
- [ ] 2.3 Create `tests/__fixtures__/billing/reading.ts` with `buildReading` supporting `is_replacement`, `is_reset`, `requires_override`, override block.
- [ ] 2.4 Create `tests/__fixtures__/billing/invoice.ts` with `buildInvoice`, `buildInvoicePayment`.
- [ ] 2.5 Document fixture pattern in `tests/__fixtures__/README.md` (one short page).

## 3. Service refactor for testability

- [ ] 3.1 Audit `server/services/billing/draft-calc.ts` — identify external dependencies (repos, supabase). Extract pure logic into testable functions if needed; allow injection of repos via param.
- [ ] 3.2 Audit `server/services/billing/period-status.ts` and invoice status logic — same approach.
- [ ] 3.3 Audit blocker logic (`findIssuanceBlockers`, `findUtilityBlocker`) — ensure it accepts data input rather than reaching out to repo when callable from tests.
- [ ] 3.4 Audit adjustment service — same.
- [ ] 3.5 Add minimal export of internal helpers needed by tests (e.g. blocker formatter) without exposing them as public API.

## 4. Draft calc tests

- [ ] 4.1 `tests/server/billing/draft-calc.test.ts` — rent prorate by date.
- [ ] 4.2 Discount applied after rent.
- [ ] 4.3 Electricity per_kwh.
- [ ] 4.4 Electricity tiered (multi-bracket).
- [ ] 4.5 Electricity fixed.
- [ ] 4.6 Electricity per_person.
- [ ] 4.7 Water per_m3.
- [ ] 4.8 Water per_person.
- [ ] 4.9 Water fixed_per_room.
- [ ] 4.10 Handover fallback when no current reading.
- [ ] 4.11 Override block with `is_replacement` and `is_reset`.

## 5. Status transition tests

- [ ] 5.1 `tests/server/billing/period-status.test.ts` — happy path drafted → issued → collecting → closed.
- [ ] 5.2 Block transitions from `closed`.
- [ ] 5.3 `tests/server/billing/invoice-status.test.ts` — payment accumulation moves status to paid.
- [ ] 5.4 Void from issued with no payments.
- [ ] 5.5 Reissue creates linked invoice with `parent_invoice_id`.

## 6. Blocker tests

- [ ] 6.1 `tests/server/billing/blockers.test.ts` — missing electricity reading.
- [ ] 6.2 Unresolved override block.
- [ ] 6.3 Empty reason in override.
- [ ] 6.4 All clear → empty list.

## 7. Adjustment tests

- [ ] 7.1 `tests/server/billing/adjustments.test.ts` — closed period blocked.
- [ ] 7.2 Negative adjustment exceeding paid amount blocked.
- [ ] 7.3 Reason length enforced for significant negative.
- [ ] 7.4 Positive adjustment beyond total allowed.

## 8. Audit summary tests

- [ ] 8.1 `tests/server/billing/audit-summary.test.ts` — all documented actions produce expected strings (snapshot or explicit equality).
- [ ] 8.2 Optional metadata missing → graceful output.
- [ ] 8.3 Unknown action → fallback.

## 9. Component smoke test

- [ ] 9.1 `tests/components/billing/BillingDraftGridStep.spec.ts`:
  - [ ] 9.1.1 Mount with 2 fixture rows.
  - [ ] 9.1.2 Press Tab from first cell → assert focus moved.
  - [ ] 9.1.3 Simulate paste event with multi-line text → assert downstream cells updated.
- [ ] 9.2 Stub auto-imported composables/components as needed (or use `@nuxt/test-utils` if simpler).

## 10. CI integration

- [ ] 10.1 Update `.github/workflows/ci.yml` to add `npm test -- --run` after lint and typecheck.
- [ ] 10.2 (Optional) add coverage upload artifact for inspection on failed runs.
- [ ] 10.3 Verify CI passes on a draft PR.

## 11. Coverage threshold rollout

- [ ] 11.1 After tests are seeded, measure baseline coverage on `server/services/billing/`.
- [ ] 11.2 Set thresholds in `vitest.config.ts` slightly below baseline (e.g. 5 points lower) to enforce no regression.
- [ ] 11.3 Document expected coverage targets in `docs/architecture/rules.md` or test README.

## 12. Documentation

- [ ] 12.1 Add `tests/README.md` with: how to run, fixture pattern, conventions for new tests.
- [ ] 12.2 Update `README.md` quickstart with `npm test` line.
- [ ] 12.3 Update `docs/project-status.md` v0.2.5 quality section noting test baseline established.
