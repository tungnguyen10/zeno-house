## ADDED Requirements

### Requirement: ESLint pass sạch trên toàn bộ codebase
`npm run lint` SHALL pass với 0 errors và 0 warnings trên tất cả `*.ts` và `*.vue` files trong `app/` và `server/`. Mọi violation hiện tại phải được fix hoặc có `eslint-disable` với comment giải thích.

#### Scenario: lint script pass với exit code 0
- **WHEN** `npm run lint` được chạy trên codebase sạch
- **THEN** exit code 0, không có error output

#### Scenario: TypeScript strict mode không có type errors
- **WHEN** `npm run typecheck` được chạy (`vue-tsc --noEmit` via Nuxt)
- **THEN** exit code 0, không có type errors

---

### Requirement: typeCheck bật trong Nuxt config
`nuxt.config.ts` SHALL có `typescript.typeCheck: true` để enable build-time type checking trong dev server và CI.

#### Scenario: Type errors hiện trong dev server
- **WHEN** developer tạo type error trong `.vue` file và lưu
- **THEN** Nuxt dev server hiển thị type error trong terminal output
