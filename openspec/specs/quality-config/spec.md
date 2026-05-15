# quality-config Specification

## Purpose
TBD - created by archiving change quality-gates-baseline. Update Purpose after archive.
## Requirements
### Requirement: ESLint pass sạch trên toàn bộ codebase
`npm run lint` SHALL pass với 0 errors **và 0 warnings** trên tất cả `*.ts` và `*.vue` files. `no-console` rule SHALL be set to `error` (không phải `warn`). Mọi `@typescript-eslint/no-explicit-any` còn lại phải có `eslint-disable-next-line` comment giải thích lý do.

#### Scenario: lint script pass với exit code 0
- **WHEN** `npm run lint` được chạy trên codebase sạch
- **THEN** exit code 0, không có error output

#### Scenario: TypeScript strict mode không có type errors
- **WHEN** `npm run typecheck` được chạy (`vue-tsc --noEmit` via Nuxt)
- **THEN** exit code 0, không có type errors

#### Scenario: no-console là error, không phải warn
- **WHEN** developer thêm `console.log(...)` vào bất kỳ file `.ts` hoặc `.vue` nào
- **THEN** `npm run lint` báo error (không phải warning), exit code non-zero

#### Scenario: 0 warnings sau khi audit
- **WHEN** `npm run lint` được chạy sau v0.2 quality audit
- **THEN** exit code 0, không có error output, không có warning output

---

### Requirement: typeCheck bật trong Nuxt config
`nuxt.config.ts` SHALL có `typescript.typeCheck: true` để enable build-time type checking trong dev server và CI.

#### Scenario: Type errors hiện trong dev server
- **WHEN** developer tạo type error trong `.vue` file và lưu
- **THEN** Nuxt dev server hiển thị type error trong terminal output

