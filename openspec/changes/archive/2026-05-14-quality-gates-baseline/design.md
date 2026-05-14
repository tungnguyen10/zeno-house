## Context

Codebase hiện tại có ESLint config cơ bản (`eslint.config.mjs` với `@nuxt/eslint`) và TypeScript strict mode bật nhưng `typeCheck: false`. Không có CI pipeline và không có pre-commit hooks. Code có thể được push lên với lint errors hoặc type errors mà không bị chặn.

## Goals / Non-Goals

**Goals:**
- `npm run lint` pass sạch 0 errors trên toàn bộ codebase
- `npm run typecheck` pass sạch với `typeCheck: true`
- CI pipeline tự động chạy 2 checks trên mọi PR vào `develop` và `main`
- Pre-commit hook chặn commit có lint errors tại local

**Non-Goals:**
- Unit tests / e2e tests (phase sau)
- Code coverage thresholds
- Performance benchmarks
- Dependency audit automation

## Decisions

### D1: GitHub Actions thay vì GitLab CI / CircleCI

Repo đang ở GitHub, GitHub Actions là lựa chọn tự nhiên — không cần external service, free cho public/private repos trong giới hạn. Workflow file nằm tại `.github/workflows/ci.yml`.

### D2: Chỉ chạy lint + typecheck trong CI, không build

`nuxt build` tốn nhiều thời gian và memory hơn cần thiết cho quality gate. Lint và typecheck đủ để bắt hầu hết errors trong PR. Build check sẽ được thêm khi cần deploy automation.

### D3: Husky + lint-staged thay vì chỉ dùng CI

CI là safety net cuối cùng, nhưng feedback loop chậm (push → wait). Husky chạy lint-staged trên staged files trước mỗi commit — nhanh hơn, không block reviewer khi PR bị fail CI.

**lint-staged config:** chỉ lint files được staged (không lint toàn bộ codebase mỗi commit).

### D4: `typeCheck: true` trong nuxt.config — trade-off

Bật `typeCheck: true` làm dev server khởi động chậm hơn (~2-5s) vì Nuxt chạy `vue-tsc` in background. Tuy nhiên, đây là cách duy nhất để bắt type errors trong `.vue` files lúc develop.

**Alternatives considered:** Chỉ chạy `vue-tsc --noEmit` trong CI — loại vì mất real-time feedback trong dev.

## Risks / Trade-offs

- **[Risk] typeCheck: true làm chậm HMR** → Acceptable — trade-off giữa DX speed và correctness. Có thể tắt lại nếu quá chậm.
- **[Risk] Husky không chạy nếu dev dùng GUI git client** → Mitigation: CI vẫn là hard gate, Husky chỉ là convenience.
- **[Risk] Existing code có nhiều lint/type errors chưa fix** → Fix hết trước khi bật gate, không bật gate trên broken codebase.

## Open Questions

- Có cần `npm run build` check trong CI không? (Để sau khi có deployment pipeline)
