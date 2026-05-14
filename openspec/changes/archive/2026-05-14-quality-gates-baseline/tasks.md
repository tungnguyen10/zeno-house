## 1. Fix Lint & Type Errors

- [x] 1.1 Chạy `npm run lint` — ghi lại toàn bộ errors hiện tại
- [ ] 1.2 Fix tất cả ESLint errors trong `app/` và `server/`
- [ ] 1.3 Bật `typescript.typeCheck: true` trong `nuxt.config.ts`
- [ ] 1.4 Chạy `npm run typecheck` — fix toàn bộ type errors còn lại

## 2. ESLint Config

- [x] 2.1 Review `eslint.config.mjs` — đảm bảo rules phù hợp với project conventions
- [x] 2.2 Thêm `lint` script vào `package.json` nếu chưa có (`nuxt lint` hoặc `eslint .`)
- [x] 2.3 Thêm `typecheck` script vào `package.json` (`nuxt typecheck`)

## 3. Pre-commit Hooks

- [ ] 3.1 Cài `husky` và `lint-staged`: `npm install -D husky lint-staged`
- [ ] 3.2 Khởi tạo Husky: `npx husky init`
- [ ] 3.3 Tạo `.husky/pre-commit` — chạy `npx lint-staged`
- [ ] 3.4 Thêm `lint-staged` config vào `package.json` — lint `*.{ts,vue}` staged files

## 4. CI Pipeline

- [ ] 4.1 Tạo `.github/workflows/ci.yml` với trigger `push`/`pull_request` vào `develop` và `main`
- [ ] 4.2 Workflow job: checkout → setup Node.js LTS → `npm ci` → `npm run lint` → `npm run typecheck`
- [ ] 4.3 Verify CI pass bằng cách push branch test hoặc kiểm tra workflow file syntax
