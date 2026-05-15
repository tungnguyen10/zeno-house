## Context

v0.2 đã tích lũy code qua 5 verticals. ESLint hiện có một số rules ở mức `warn` (thay vì `error`) vì khi setup lần đầu chưa chắc chắn patterns sẽ clean. Sau khi codebase đã ổn định, có thể tighten.

**Current state:**
- `npm run lint && npm run typecheck` → exit 0 (không có errors)
- `no-console`: `warn` — có thể còn sót console.log trong server code
- `@typescript-eslint/no-explicit-any`: `warn` — được dùng hợp lệ ở một vài chỗ (error boundary, dynamic objects)
- Pre-commit hook: chạy lint-staged trên `*.{ts,vue}`
- CI: chạy lint + typecheck, không có test steps

## Goals / Non-Goals

**Goals:**
- 0 lint warnings sau khi tighten rules
- Tất cả `server/api/**` handlers đều có `requireAuth`
- Tất cả `server/services/**` methods đều có `can()` permission check
- ESLint rules reflect maturity của codebase

**Non-Goals:**
- Thêm unit/integration tests (phase sau)
- Thêm bước CI mới (build check, deploy preview)
- Refactor code patterns — chỉ fix warnings, không restructure

## Decisions

**D1 — Nâng `no-console` → `error`**
`console.log` không bao giờ nên xuất hiện trong production code. Server errors/warnings dùng `createError`. Client dùng silent fail hoặc toast. Nâng lên `error` để pre-commit hook bắt được.

**D2 — Giữ `@typescript-eslint/no-explicit-any` ở `warn`**
Có một số chỗ hợp lệ cần `any` (Supabase dynamic query builder, error handler `catch (e: any)`). Tighten bằng cách fix các `any` không cần thiết, nhưng giữ rule ở `warn` để không block legitimate use. Thêm comment `// eslint-disable-next-line` với giải thích cho chỗ nào cần giữ.

**D3 — Auth guard audit bằng grep, không cần abstraction mới**
Tất cả API handlers phải có `requireAuth(event)` ở đầu handler. Kiểm tra bằng grep toàn bộ `server/api/**` và fix bất kỳ handler nào thiếu. Không cần middleware tự động — pattern hiện tại đủ rõ ràng.

**D4 — Permission check audit tương tự**
Service methods với mutations (create/update/delete) phải có `can()` check. Read operations cũng nên check (principle of least privilege). Audit bằng grep patterns.

## Risks / Trade-offs

- **Nâng no-console → error có thể break CI** nếu còn console.log sót → Fix trước khi commit rule change
- **Over-tightening làm slow down dev** → Chỉ tighten những gì đã proven clean trong v0.2

## Open Questions

_(none)_
