## Why

Dự án zeno-house cần một bộ `instructions/` chuẩn để Claude Code và team members có thể follow nhất quán khi phát triển. Hiện tại CLAUDE.md chỉ có high-level overview, thiếu các coding rules, patterns, và conventions cụ thể cần thiết để AI generate code đúng chuẩn từ đầu.

## What Changes

- Tạo `instructions/` directory tại root với 9 sub-instruction files
- Update `CLAUDE.md` thành thin index sử dụng `@file` imports để Claude Code tự động load instructions vào context
- Fix lại "Nuxt 3" → "Nuxt 4" trong CLAUDE.md (project thực tế đang dùng `nuxt@^4.4.2`)
- Xóa nội dung dài trong CLAUDE.md, thay bằng references đến instruction files

## Capabilities

### New Capabilities

- `project-instructions`: Bộ instruction files hướng dẫn cấu trúc thư mục, coding patterns, conventions cho toàn bộ dự án

### Modified Capabilities

- (không có — không thay đổi requirements của existing specs)

## Impact

- `CLAUDE.md` — refactored thành thin index với `@imports`
- `instructions/` directory — tạo mới với 9 files:
  - `project-structure.md` — Nuxt 4 `app/` layout, file placement rules
  - `typescript.md` — strict TypeScript, Zod schemas, shared types
  - `supabase-platform.md` — RLS, service key vs user client, SSR patterns
  - `api-conventions.md` — server/api/ REST conventions, auth, error handling
  - `components.md` — dumb/presentational components, auto-import, naming
  - `composables.md` — useX pattern, Realtime teardown, server calls
  - `stores.md` — Pinia setup stores, loading/error state, auth store
  - `styling.md` — Nuxt UI components, TailwindCSS, room-status tokens
  - `edge-cases.md` — business logic edge cases (invoices, contracts, roles)
