## ADDED Requirements

### Requirement: CI pipeline tự động chạy lint và typecheck
`.github/workflows/ci.yml` SHALL trigger trên mọi `push` và `pull_request` vào branch `develop` và `main`. Pipeline SHALL chạy `npm run lint` và `npm run typecheck` với Node.js LTS. Pipeline MUST fail khi có bất kỳ lint error hoặc type error nào.

#### Scenario: CI pass khi code sạch
- **WHEN** push hoặc PR vào `develop`/`main` với code không có lint/type errors
- **THEN** CI pipeline pass, merge được phép

#### Scenario: CI fail khi có lint error
- **WHEN** push hoặc PR có file với ESLint errors
- **THEN** CI pipeline fail tại bước lint, hiển thị error output rõ ràng

#### Scenario: CI fail khi có type error
- **WHEN** push hoặc PR có TypeScript type errors
- **THEN** CI pipeline fail tại bước typecheck, hiển thị error output

---

### Requirement: Pre-commit hook chặn commit có lint errors
Dự án SHALL có Husky pre-commit hook chạy lint-staged trên staged `.ts` và `.vue` files. Commit MUST bị abort nếu lint-staged báo errors.

#### Scenario: Commit bị block khi staged files có lint errors
- **WHEN** developer chạy `git commit` với staged files có ESLint errors
- **THEN** Husky abort commit và hiển thị error, không tạo commit

#### Scenario: Commit thành công khi code sạch
- **WHEN** staged files không có lint errors
- **THEN** commit được tạo bình thường
