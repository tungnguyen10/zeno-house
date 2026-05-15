## MODIFIED Requirements

### Requirement: ESLint pass sạch trên toàn bộ codebase
`npm run lint` SHALL pass với 0 errors **và 0 warnings** trên tất cả `*.ts` và `*.vue` files. `no-console` rule SHALL be set to `error` (không phải `warn`). Mọi `@typescript-eslint/no-explicit-any` còn lại phải có `eslint-disable-next-line` comment giải thích lý do.

#### Scenario: no-console là error, không phải warn
- **WHEN** developer thêm `console.log(...)` vào bất kỳ file `.ts` hoặc `.vue` nào
- **THEN** `npm run lint` báo error (không phải warning), exit code non-zero

#### Scenario: 0 warnings sau khi audit
- **WHEN** `npm run lint` được chạy sau v0.2 quality audit
- **THEN** exit code 0, không có error output, không có warning output
