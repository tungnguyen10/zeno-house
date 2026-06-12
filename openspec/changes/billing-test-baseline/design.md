## Context

Repo Nuxt 4 + TS strict + Pinia + Supabase đã tồn tại nhưng chưa có test framework. Lý do trước đây: focus vào delivery foundation (auth, buildings, rooms, tenants, contracts, billing) trong v0.1 và v0.2. Bây giờ billing đã đủ phức tạp (rule rent, discount, điện 4 mode, nước 3 mode, handover fallback, override merge, blocker, adjustment, status transitions) nên không thể tiếp tục phụ thuộc vào smoke test bằng tay.

Constraint:
- Nuxt 4 ESM-only, alias `~` / `@` trong `tsconfig.json` cần resolve trong test.
- Server code import `h3`, supabase client. Khi unit test pure logic, mock Supabase repository chứ không spin Postgres.
- Vue components sử dụng auto-import (composables, components). Test cần cấu hình hoặc test ở mức composable / pure logic là chính.

## Goals / Non-Goals

**Goals:**
- Có script `npm test` chạy unit test cho rule billing core.
- Bao phủ ≥70% branch của `server/services/billing/draft-calc.ts` và phần status transition / blockers / adjustment.
- Có 1 component smoke test demo cho draft grid (nav + paste).
- CI fail khi test fail.
- Fixture pattern rõ ràng để dễ thêm test mới.

**Non-Goals:**
- Không cover end-to-end (no Playwright trong change này).
- Không test Supabase repository (cần real DB) — mock layer đó.
- Không cover 100% coverage; ưu tiên rule nghiệp vụ.
- Không viết test cho UI flows phức tạp (modal, tab) — để follow-up sau.

## Decisions

### D1 — Vitest thay vì Jest

- **Vitest**: native ESM, fast, Vite-aware, hỗ trợ alias từ tsconfig dễ, chạy được Vue SFC qua `@vue/test-utils`.
- Jest: ESM workaround, transformer config phức tạp với Nuxt 4.

Chọn Vitest. Đồng bộ với hệ Nuxt/Vite. Có sẵn watch + coverage.

### D2 — Test ở layer service, mock repository

Pattern:
```ts
import { computeDraftRow } from '~/server/services/billing/draft-calc'

const repos = {
  serviceCatalog: { getByCode: vi.fn().mockResolvedValue({...}) },
  // ...
}

await computeDraftRow(input, { repos })
```

Để test được, một số service cần inject `repos` qua context thay vì import trực tiếp. Refactor nhỏ: chuyển từ "import singleton repo" sang "nhận repos qua param hoặc context".

Áp dụng cho: `draft-calc`, `period-status`, `invoices`, `payments`, `audit`. Refactor khi cần, không bắt buộc tất cả service cùng lúc.

### D3 — Fixture builders

Đặt tại `tests/__fixtures__/billing/`:
- `period.ts` → `buildPeriod(overrides)` trả `BillingPeriod`
- `contract.ts` → `buildContract`, `buildContractCharges`
- `reading.ts` → `buildReading` (với flags `is_replacement`, `is_reset`, `requires_override`)
- `invoice.ts` → `buildInvoice`, `buildInvoicePayment`

Builders dùng spread để override field cụ thể trong test; default values hợp lệ. Không dùng faker (deterministic).

### D4 — Coverage threshold

`vitest.config.ts` enable `coverage.v8` provider, threshold:
- `server/services/billing/`: branches 70%, functions 80%, statements 75%
- Repo overall: không enforce trong v1.

CI step `npm test -- --coverage` chạy ở mỗi PR.

### D5 — Component test scope

Chỉ 1 file demo: `BillingDraftGridStep.spec.ts` với 2 case:
- Tab nav giữa cell.
- Paste fill xuống dòng kế.

Mục tiêu: chứng minh component test setup OK, không cover full UI flow. Mở rộng ở change sau.

### D6 — CI integration

Cập nhật `.github/workflows/ci.yml`:
```yaml
- run: npm ci
- run: npm run lint
- run: npm run typecheck
- run: npm test -- --run
```

Test chạy headless, không cần Supabase env. Mock layer đảm bảo no network.

## Risks / Trade-offs

- **[Refactor service để inject repos có rủi ro regression]** → Mitigation: làm từng service một, có smoke test trước, code review kỹ. Không bắt buộc DI toàn diện — chỉ chỗ nào test cần.
- **[Vitest cấu hình resolve alias không trùng tsconfig]** → Mitigation: dùng `vite-tsconfig-paths` plugin hoặc copy alias vào `vitest.config.ts`.
- **[Coverage threshold 70% có thể block merge ban đầu nếu test seed không đủ]** → Mitigation: lần đầu set threshold thấp (50%), tăng dần khi thêm test. Hoặc disable threshold ở phase 1.
- **[Component test cần stub auto-import]** → Mitigation: dùng `@nuxt/test-utils` runtime hoặc stub manually. Scope nhỏ nên acceptable.

## Migration Plan

1. Setup framework + 1 test demo passing.
2. Fixture builders.
3. Test draft-calc (rule lớn nhất).
4. Test status transitions.
5. Test blockers + adjustments.
6. Test audit-summary (sau khi change 1 viết source).
7. Component smoke test.
8. CI integration.
9. Set coverage threshold.

## Open Questions

- Có nên dùng `@nuxt/test-utils` cho component test hay stub manual? → Đề xuất stub manual ban đầu, dùng `@nuxt/test-utils` khi cần test composable phụ thuộc Nuxt context.
- Test runner trong VS Code (Vitest extension) — bật mặc định hay optional? → Optional; document trong README.
