## Why

v0.2 đã thêm 5 feature verticals (rooms, tenants, room assignments, contracts, dashboard) — codebase đã tăng đáng kể. Cần một lần audit cuối để đóng milestone v0.2 sạch: lint 0 warnings, typecheck 0 errors, auth guard coverage đầy đủ, và ESLint rules được tightened phù hợp với patterns đã ổn định trong v0.2.

## What Changes

- Audit và fix toàn bộ lint warnings (`no-console`, `@typescript-eslint/no-explicit-any`)
- Upgrade một số ESLint rules từ `warn` → `error` cho patterns đã clean trong codebase
- Review auth guard coverage — đảm bảo mọi `server/api/**` handler đều có `requireAuth`
- Review permission check coverage — đảm bảo mọi service method đều có `can()` check
- Verify CI pipeline chạy đúng với cấu trúc mới (không thêm bước mới, chỉ verify)
- Final `npm run lint && npm run typecheck` = 0 errors, 0 warnings

## Capabilities

### New Capabilities

_(không có capability mới — đây là audit/tighten, không có behavior mới)_

### Modified Capabilities

- `quality-config`: Tighten ESLint rules — nâng `no-console` và `@typescript-eslint/no-explicit-any` từ `warn` → `error`; verify 0 warnings baseline

## Impact

- `eslint.config.mjs` — rule changes
- `server/api/**/*.ts` — fix any console.log, any types còn sót
- `app/**/*.ts`, `app/**/*.vue` — fix any warnings còn sót
- Không có breaking changes, không có API shape changes
