## MODIFIED Requirements

### Requirement: ESLint pass sạch trên toàn bộ codebase
`npm run lint` SHALL pass với 0 errors và 0 warnings sau khi tất cả v0.3 features đã implement. Mọi financial API endpoint SHALL có `requireAuth` + `can()` check. Tất cả financial capabilities SHALL được khai báo trong `server/utils/permissions.ts`.

#### Scenario: 0 warnings sau v0.3 audit
- **WHEN** `npm run lint` chạy sau v0.3 quality audit
- **THEN** exit code 0, không có error, không có warning

#### Scenario: Financial permissions declared
- **WHEN** admin and manager access financial endpoints
- **THEN** permission checks use declared capabilities (utility-readings.read, invoices.read/create, payments.read/create, etc.)
