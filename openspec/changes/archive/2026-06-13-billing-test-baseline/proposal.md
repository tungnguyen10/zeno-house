## Why

`monthly-operations-workspace` đã giao 6 service billing với hàng chục rule nghiệp vụ (draft calc, status transition, override merge, blocker logic, adjustment validate) nhưng repo chưa có **0 unit test**. `npm test` không có script. Mỗi lần refactor lại đi smoke-test bằng tay → rủi ro regression cao, đặc biệt khi `billing-readability-and-polish` và `billing-power-features` sắp đụng chạm cả service và UI.

Cần baseline test framework + bộ test cho các rule core trước khi 2 change còn lại merge.

## What Changes

- **Setup test framework**:
  - Cài `vitest` + `@vue/test-utils` + `happy-dom` (devDependencies).
  - Thêm script `npm test`, `npm run test:watch`, `npm run test:coverage`.
  - Thêm `vitest.config.ts` với alias trùng `tsconfig.json`, env `happy-dom` cho component tests.
  - CI: thêm `npm test` vào `.github/workflows/ci.yml` (sau `lint` + `typecheck`).
- **Unit tests cho draft calc rules** (`server/services/billing/draft-calc.ts` hoặc tương đương):
  - Rent: prorated theo ngày khi `start_date`/`end_date` cắt period.
  - Discount: amount âm cộng vào subtotal sau rent.
  - Electricity: 4 mode `per_kwh`, `fixed`, `tiered`, `per_person` — verify breakdown values.
  - Water: 3 mode `per_m3`, `per_person`, `fixed_per_room`.
  - Handover fallback: khi không có meter reading mới, dùng `handover_reading` từ contract.
  - Override metadata: khi reading có flag `is_replacement` hoặc `is_reset`, billable usage tính theo override block.
- **Unit tests cho status transition** (`BillingPeriodService` + `BillingInvoiceService`):
  - Period: `drafted → issued → collecting → closed` happy path.
  - Period: từ `closed` không quay được trạng thái khác (block ở service).
  - Invoice: `pending → issued → partially_paid → paid` cập nhật theo payments.
  - Invoice: `void` chỉ cho phép từ `issued`/`partially_paid` không có payment thành công, hoặc khi unissue.
  - Invoice: `reissue` tạo invoice mới với `parent_invoice_id` link về void cũ.
- **Unit tests cho blocker rules** (`findUtilityBlocker` / `findIssuanceBlockers`):
  - Thiếu reading meter điện cho 1 contract → block + lý do `Thiếu chỉ số điện`.
  - Reading có `requires_override = true` chưa giải quyết → block.
  - Reading override có reason rỗng → block.
  - Tất cả OK → không block, trả empty array.
- **Unit tests cho adjustment validate**:
  - Adjustment trên invoice ở period `closed` → throw CONFLICT.
  - Adjustment dương vượt invoice total → vẫn cho phép (tăng amount), không throw.
  - Adjustment âm vượt invoice paid → throw CONFLICT (không cho âm hơn số đã thu).
  - Reason ≥10 ký tự khi amount < 0 và |amount| ≥ 100k.
- **Unit tests cho audit summary formatter** (`server/services/billing/audit-summary.ts` từ change 1):
  - Mỗi action documented trong design D3 → snapshot string match.
  - Fallback cho action lạ.
  - Optional metadata fields (vd `due_date` thiếu) → format không crash.
- **Component test (smoke) cho draft grid**:
  - Render 2 rows; tab nav giữa cell hoạt động.
  - Paste vào input fill xuống dòng kế.
  - Đủ basic, không cover full UI.

## Capabilities

### New Capabilities
- `billing-test-coverage`: contract về test framework (Vitest) + danh mục test bắt buộc cho draft calc, status transition, blockers, adjustment, audit formatter, plus smoke component test cho draft grid.

## Impact

- **Tooling**:
  - `package.json` scripts + devDependencies (`vitest`, `@vue/test-utils`, `happy-dom`, `@vitest/coverage-v8`).
  - `vitest.config.ts` (mới).
  - `.github/workflows/ci.yml` thêm step test.
  - `.gitignore` thêm `coverage/` nếu chưa có.
- **Tests**:
  - `tests/server/billing/draft-calc.test.ts`
  - `tests/server/billing/period-status.test.ts`
  - `tests/server/billing/invoice-status.test.ts`
  - `tests/server/billing/blockers.test.ts`
  - `tests/server/billing/adjustments.test.ts`
  - `tests/server/billing/audit-summary.test.ts`
  - `tests/components/billing/BillingDraftGridStep.spec.ts`
  - `tests/__fixtures__/billing/*.ts` — fixture builders (period, contract, reading, invoice, payment).
- **Source code**: có thể cần tách 1 vài hàm internal thành export để testable (vd `findUtilityBlocker` chuyển từ private → exported helper). Refactor nhỏ, không thay hành vi.
- **Coverage target v1**: 70% cho `server/services/billing/`. Không ép coverage toàn repo.
- **Dependencies**: change này không phụ thuộc 1 và 2; tuy nhiên test cho `audit-summary` cần file source từ change 1. Đề xuất implement cùng change 1 — task 4.x của change 1 sẽ thêm test scaffolding ban đầu, change này hoàn thiện toàn bộ.
- **Breaking**: không.
