## Context

F0.1.2 App Shell đã có admin layout, UI primitives, và login placeholder hoạt động. `@nuxtjs/supabase` đã được cài với `redirect: false` — module không tự xử lý redirect, mọi route protection phải làm thủ công qua middleware. Hiện tại mọi route đang public, không có session state, login form chưa nối API thật.

F0.1.3 cần setup auth trước F0.1.5 (Domain Vertical Slice) vì server API sẽ cần `requireAuth()` để bảo vệ endpoint.

## Goals / Non-Goals

**Goals:**
- Supabase email/password login hoạt động end-to-end
- Pinia store chứa session state dùng chung toàn app
- Client middleware bảo vệ admin routes + guard login page
- Server middleware đính user vào event context cho API handlers
- AppHeader hiển thị user info thật + nút logout

**Non-Goals:**
- OAuth / social login (Google, GitHub...)
- Email verification flow
- Password reset / forgot password
- Role-based UI (show/hide element theo role) — phase sau
- Self-registration — admin được provision thủ công qua Supabase dashboard
- Multi-factor authentication

## Decisions

### D1: Session source of truth — `useSupabaseUser()` làm reactive base

**Quyết định:** `stores/auth.ts` là thin wrapper đọc từ `useSupabaseUser()` (do module cung cấp) thay vì tự quản lý token. Store chỉ bổ sung `role` (fetch từ `app_metadata`) và derived state (`isAuthenticated`, `isAdmin`).

**Lý do:** `useSupabaseUser()` tự xử lý token refresh, session persistence qua cookie, và reactive update khi auth state thay đổi. Tự quản lý token là duplicate work và dễ có race condition.

**Thay thế đã cân nhắc:** Tự gọi `supabase.auth.getSession()` trong store action — phức tạp hơn, không cần thiết khi module đã xử lý.

---

### D2: Role storage — `user.app_metadata.role` via Supabase Admin API

**Quyết định:** Role (`admin` / `manager`) lưu trong `user.app_metadata.role`. Set thủ công qua Supabase dashboard hoặc Admin API (service role key). Không tạo bảng `profiles` riêng cho v0.1.

**Lý do:**
- `app_metadata` chỉ được ghi bởi service role — user không thể tự sửa, không thể fake
- Không cần DB migration hay thêm table
- Có thể đọc từ JWT claims trực tiếp trên server mà không cần thêm DB query

**Thay thế đã cân nhắc:** Bảng `profiles(user_id, role)` — linh hoạt hơn khi cần thêm field, nhưng cần migration + thêm DB query mỗi request. Để dành cho khi có thêm profile data.

**Trade-off:** Nếu admin set role sau khi user đã login, user cần logout/login lại để nhận role mới vì role đọc từ JWT cached. Chấp nhận được cho v0.1 (ít user, provision thủ công).

---

### D3: Client middleware — global `auth` với public route list

**Quyết định:** Dùng `middleware/auth.global.ts` (chạy mọi route) kiểm tra session, với list các public routes (`/login`) được bypass. Thêm `middleware/guest.ts` (named) để redirect authenticated user khỏi `/login`.

**Lý do:** Global middleware đảm bảo mọi route admin tự động được protect — không cần thêm `middleware: 'auth'` khi tạo page mới. Ít boilerplate, ít rủi ro quên protect route mới.

**Public route list:**
```ts
const PUBLIC_ROUTES = ['/login']
```

**Thay thế đã cân nhắc:** Named middleware opt-in — an toàn hơn (explicit), nhưng dễ quên apply khi tạo page mới. Rủi ro cao hơn cho security.

---

### D4: Server auth middleware — attach user vào event context

**Quyết định:** `server/middleware/01.auth.ts` gọi `serverSupabaseUser(event)` và đính vào `event.context.user`. `server/utils/auth.ts` export `requireAuth(event)` helper ném `401` nếu không có user. API handlers dùng helper này thay vì tự check.

**Lý do:** Centralized — không duplicate auth logic trong từng handler. Prefix `01.` đảm bảo chạy trước các middleware khác theo thứ tự alphabetical của Nuxt.

**Convention:**
```ts
// server/api/buildings/index.get.ts
export default defineEventHandler(async (event) => {
  const user = requireAuth(event) // throws 401 nếu chưa login
  // ...
})
```

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Role chỉ update sau re-login | Document rõ: set role trước khi cấp credentials |
| Session expiry xảy ra giữa chừng | `auth.global.ts` catch auth error và redirect `/login` với query param `?expired=1` |
| `redirect: false` + middleware bug → redirect loop | Test kỹ: login redirect đến `/`, `auth.global.ts` không redirect nếu đang ở route public |
| `app_metadata` không có trong `useSupabaseUser()` trực tiếp | Đọc từ `user.app_metadata` sau khi verify bằng `serverSupabaseUser` trên server; client dùng session JWT claims |

## Open Questions

- **Q1:** Khi role là `manager`, cần list buildings được phân công không? → Defer sang F0.1.5 khi có domain logic. F0.1.3 chỉ phân biệt authenticated vs unauthenticated.
- **Q2:** Có cần `useAuth()` composable riêng hay dùng store trực tiếp? → Tạo `useAuth()` composable thin wrapper để page/component không import store trực tiếp — dễ test hơn.
