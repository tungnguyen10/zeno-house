# Architecture Rules — Zeno House v0.1

## 1. State Rules

- State chia thành 3 nhóm: **server state**, **global client state**, **local component state**.
- **Server state** (danh sách buildings, rooms...) đặt ở composable với `useFetch`/`$fetch`. Không nhét vào Pinia.
- **Pinia** chỉ dùng cho state thật sự global: session, sidebar open/close, notification queue.
- **Form state** nằm trong component hoặc composable của form. Không lưu vào store.
- Mỗi domain có composable tách theo mục đích: `list`, `detail`, `form`.
- Không duplicate derived state — ưu tiên `computed`.
- Store không điều khiển trực tiếp modal hoặc toast business flow.

## 2. API Rules

- **Client không gọi Supabase trực tiếp** cho business data — luôn đi qua `server/api/`.
- Mọi endpoint phải validate input bằng Zod.
- Response phải dùng envelope chuẩn:
  ```ts
  type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> }
  type ApiError   = { error: { code: string; message: string; details?: unknown } }
  ```
- `repository` chỉ query và persist — không có business rule.
- `service` xử lý business rule và permission check.
- List endpoint hỗ trợ pagination nếu là resource chính.
- Không trả raw DB row ra response — phải map qua mapper.
- Error codes chuẩn hóa: `UNAUTHENTICATED` | `FORBIDDEN` | `NOT_FOUND` | `VALIDATION_ERROR` | `CONFLICT`.

## 3. Component Rules

- Component chia thành 3 lớp: `ui/` (primitive), `<domain>/` (display block), `app/` (shell).
- Component mặc định là presentational — không fetch data.
- Data fetch ưu tiên ở page hoặc composable.
- Props phải typed rõ ràng, tránh truyền object lớn chưa map.
- Emit phải diễn tả intent: `submit`, `remove`, `changeStatus` — không dùng `click` chung chung.
- Component quan trọng phải xử lý `loading`, `empty`, `error` state.
- Accessibility là rule mặc định: label cho input, aria-label cho icon button, focus-visible style.

## 4. Permission Rules

- Permission có 3 lớp: **route-level**, **action-level**, **data-level**.
- `route-level` → middleware (`auth.ts`, `role.ts`).
- `action-level` → `usePermissions()` hoặc `RoleGate` component.
- `data-level` → re-check ở server và Supabase RLS policy.
- Không hardcode role string rải rác trong component — dùng constants.
- Check theo capability thay vì role trực tiếp: `can('buildings.create')`.
- UI check chỉ để ẩn/disable — bảo mật thật nằm ở server và RLS.

## 5. Styling Rules

- Dùng Tailwind utility classes.
- Dùng `clsx` cho conditional/dynamic class composition.
- Không dùng inline `style=""`.
- CSS custom chỉ viết trong `app/assets/scss/main.scss` cho những thứ Tailwind không express được.

## 6. Incremental Principle

- Chỉ tạo file/folder khi có feature thật cần dùng.
- Không tạo abstraction khi mới chỉ có 1 nơi dùng.
- Khi một pattern được dùng lần thứ hai, mới nâng thành shared pattern.
- Mỗi bước phải để lại kết quả chạy được.
