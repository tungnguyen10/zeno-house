## Context

Sau F0.1.1, project có đủ deps (Nuxt 4, Tailwind, Pinia, Supabase, Zod) nhưng `app/app.vue` vẫn render `NuxtWelcome`. Không có layout, không có shell, không có UI component nào. Mọi feature tiếp theo (auth, buildings, rooms...) cần một khung giao diện để render vào. Không có khung thì mỗi feature phải tự giải quyết layout từ đầu — dẫn đến inconsistency và lãng phí thời gian.

Phạm vi F0.1.2 là admin-only. Tenant portal xử lý sau khi có vertical slice.

## Goals / Non-Goals

**Goals:**
- Admin shell hoạt động được: sidebar + header + content area
- Auth layout tối giản cho login page
- 6 UI primitive dùng ngay trong shell và feature tiếp theo
- `app/app.vue` chuyển từ NuxtWelcome sang NuxtLayout + NuxtPage
- `docs/architecture/rules.md` ghi lại architecture rule nền

**Non-Goals (original scope):**
- Tenant layout — phase sau
- Auth integration thật (chỉ placeholder ở login page)
- Data thật ở dashboard (chỉ placeholder)
- Full UI kit (chỉ tạo những component cần ngay)
- Animation, transition nâng cao
- ~~Dark mode~~ → **đã implement trong cùng session** (xem Additions trong proposal.md)

## Decisions

### D1: Dùng `clsx` cho conditional class composition

**Quyết định:** Cài `clsx` và dùng thay cho string concatenation hoặc array syntax của Vue.

**Lý do:** Class composition trong component có nhiều variant (button variant, size, disabled state...) rất dễ bị lỗi với string template. `clsx` cho phép tổ chức theo nhóm logic rõ ràng, tree-shakeable, và đã là convention được ghi trong `.github/instructions/styling.instructions.md`.

**Thay thế đã cân nhắc:** `tailwind-merge` — hữu ích hơn khi cần merge và override Tailwind classes từ bên ngoài, nhưng phức tạp hơn mức cần thiết ở F0.1.2. Có thể thêm sau khi có pattern thật.

---

### D2: Layout cấu trúc — Sidebar fixed left, content scrollable

**Quyết định:**
```
┌──────────────────────────────────────────┐
│  AppSidebar (fixed, w-64)  │  AppHeader  │
│                             ├─────────────┤
│  Logo                       │   Content   │
│  ─────────────              │   (scroll)  │
│  Nav items                  │             │
│                             │             │
│  ─────────────              │             │
│  User placeholder           │             │
└──────────────────────────────────────────┘
```

Sidebar cố định chiều cao full screen, không scroll. Content area scroll độc lập. Trên mobile sidebar collapse thành overlay.

**Lý do:** Pattern phổ biến nhất cho admin app, dễ hiểu với developer tiếp theo, không cần custom CSS nhiều.

---

### D3: Không dùng component library bên ngoài

**Quyết định:** Tự viết UI primitives với Tailwind + clsx, không dùng Nuxt UI, Shadcn/Vue, hay Headless UI.

**Lý do:** 
- Tránh lock-in vào external library API ở giai đoạn foundation
- Component cần đúng theo design system của project (chưa có thiết kế final)
- Với 6 component đơn giản, benefit của library không vượt qua cost của dependency

**Thay thế đã cân nhắc:** Nuxt UI — tích hợp tốt với Nuxt nhưng opinionated về styling, khó override khi có design system riêng. Có thể cân nhắc lại sau F0.1.6.

---

### D4: AppSidebar nhận navItems qua props, không hardcode

**Quyết định:** `AppSidebar` nhận `navItems: NavItem[]` qua props. Navigation items được define ở `utils/constants/navigation.ts`.

**Lý do:** Sidebar cần reusable và testable. Nếu navigation thay đổi (thêm menu item), chỉ cần sửa một chỗ. Không để domain knowledge (tên menu, route) nằm trong shell component.

## Risks / Trade-offs

- **[Risk] Component API có thể cần thay đổi khi có feature thật** → Chấp nhận — chỉ tạo những component đã biết chắc cần, không tạo trước. Nếu phải sửa API sau, scope nhỏ nên refactor dễ.

- **[Risk] Responsive mobile chưa được test kỹ** → Mitigation: đặt mục tiêu "functional trên mobile", không đặt mục tiêu "pixel-perfect". Đủ dùng để demo và dev.

- **[Risk] UiModal dùng `teleport` có thể có vấn đề với SSR** → Mitigation: wrap teleport trong `<ClientOnly>` hoặc dùng `#teleports` trong Nuxt app.vue.

## Open Questions

- UiInput có cần support `type="password"` với show/hide toggle ngay ở F0.1.2? → Chưa cần, F0.1.3 Auth sẽ quyết định khi làm login form thật.
- AppHeader có cần dropdown menu cho user avatar? → Chưa, placeholder đơn giản đủ dùng đến F0.1.3.
