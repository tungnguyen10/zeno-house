## Why

Sau 5 phases implement tính năng, codebase cần một safety net tự động ngăn regression trước khi code vào `main`. Hiện tại không có gate nào chặn lint errors hay type errors khi push, dễ để lỗi lọt vào production.

## What Changes

- Cấu hình ESLint đầy đủ và toàn bộ code phải pass `npm run lint` sạch
- Bật `typeCheck: true` trong Nuxt để build-time TypeScript verification, fix hết TS errors còn tồn đọng
- Thêm GitHub Actions CI workflow chạy lint + typecheck tự động trên mọi PR và push vào `develop`/`main`
- Thêm Husky pre-commit hook để block commit khi có lint errors cục bộ

## Capabilities

### New Capabilities

- `ci-pipeline`: GitHub Actions workflow — lint + typecheck trên PR/push
- `pre-commit-hooks`: Husky + lint-staged chặn commit lỗi tại local

### Modified Capabilities

- `quality-config`: ESLint rules hoàn chỉnh, `typeCheck: true` trong nuxt.config.ts

## Impact

- `eslint.config.mjs` — cập nhật rules
- `nuxt.config.ts` — bật `typeCheck: true`
- `.github/workflows/ci.yml` — file mới
- `package.json` — thêm husky, lint-staged, prepare script
- Mọi file TS/Vue có lỗi type hoặc lint cần fix trước khi CI xanh
