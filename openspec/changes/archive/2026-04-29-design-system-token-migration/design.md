## Context

`main.css` hiện tại định nghĩa custom design tokens trong `@theme` block của Tailwind v4. Các tokens này được expose tự động thành Tailwind utilities (`bg-smoke`, `text-title`, `bg-dark-nav`...). Tuy nhiên, phần lớn codebase không dùng các utilities này mà dùng raw Tailwind (`bg-gray-50`, `text-gray-700`, `dark:bg-gray-900`).

Ngoài ra, có 43 `dark:` Tailwind classes rải rác — nhưng không có dark mode toggle nào trong app. Dark mode hiện tại chỉ follow system preference qua Tailwind media strategy, không phải class strategy — dẫn đến kết quả không kiểm soát được.

Nuxt UI v3 dùng color system riêng của nó (CSS variables `--ui-*`). Cần đảm bảo `app.config.ts` align với token system.

## Goals / Non-Goals

**Goals:**
- Thiết lập 3-layer token architecture: Palette → Semantic (light) → Semantic (dark)
- Dark mode hoạt động bằng `.dark` class trên `<html>` (class strategy, user-toggled)
- Toàn bộ component dùng semantic tokens, không dùng raw Tailwind colors
- Sidebar dùng `bg-dark-nav` — structural dark zone, không thay đổi theo dark mode
- Landing page dùng `dark-deep`, `dark`, `brand` tokens
- Dark mode toggle trong Header

**Non-Goals:**
- Thay đổi design token values (màu sắc cụ thể)
- Thiết kế lại UI layout hoặc spacing
- Custom Nuxt UI component themes (chỉ dùng `color="primary"` standard)
- Server-side dark mode persistence (localStorage là đủ)

## Decisions

### D1: 3-Layer Token Architecture

```
Layer 1 — Palette + Semantic Light (bất biến, @theme):
  Định nghĩa raw color values VÀ semantic light defaults trong cùng @theme block.
  Trong Tailwind v4, @theme tự động output tất cả variables ra :root — không cần
  block :root riêng. Không bao giờ dùng palette tokens trực tiếp trong components.
  Ví dụ: --color-dark-nav: #001C49  (palette)
          --color-bg-page: #F2F5FA   (semantic light)

Layer 2 — Semantic Dark (.dark override):
  Plain CSS block .dark { } override các semantic tokens cho dark mode.
  Đặt ngoài @theme vì đây là runtime override, không phải theme definition.
  Ví dụ: .dark { --color-bg-page: #0a0f1e }
```

**Lý do**: Tách biệt "màu cụ thể là gì" (palette) khỏi "màu dùng ở đâu" (semantic). Khi cần thay đổi một màu cụ thể, chỉ sửa 1 chỗ trong palette. Khi dark mode, chỉ override semantic layer.

**Thay vì**: Dùng trực tiếp `#001C49` hay `@theme` vars trong components — coupling palette vào markup.

### D2: Dark Mode = Class Strategy (`.dark` trên `<html>`)

Dùng Tailwind `darkMode: 'class'` thay vì media strategy.

**Lý do**: User-controlled toggle, không phụ thuộc OS setting. Cho phép persist preference qua localStorage. Nuxt UI v3 cũng mặc định class strategy.

**Implementation**: `useColorMode()` composable từ `@vueuse/core` hoặc Nuxt's built-in color mode (nếu `@nuxtjs/color-mode` được add). Toggle trong Header component.

**Thay vì**: `prefers-color-scheme` media query — không thể override bằng user preference.

### D3: Dark Zones Không Thay Đổi Theo Dark Mode

`--color-dark-nav` (`#001C49`), `--color-dark` (`#1A1B1D`), `--color-dark-card` (`#242528`), `--color-dark-deep` (`#0a0f1e`) là structural colors cho sidebar, footer, landing hero. Chúng **không** override trong `.dark` — chúng luôn tối.

**Lý do**: Sidebar navy `#001C49` hoạt động tốt trong cả light lẫn dark mode. Thêm override không cần thiết và tạo thêm complexity.

### D4: Semantic Token Naming

Dùng prefix `bg-`, `text-`, `border-` cho clarity:

```
--color-bg-page     → Tailwind: bg-bg-page     (page root)
--color-bg-surface  → Tailwind: bg-bg-surface  (card/modal)
--color-bg-muted    → Tailwind: bg-bg-muted    (subtle section)
--color-bg-accent   → Tailwind: bg-bg-accent   (blue-tinted)
```

Text tokens giữ nguyên tên cũ để không break existing usages:
```
--color-title       → text-title  (đã có, giữ nguyên)
--color-body        → text-body   (đã có, giữ nguyên)
```

### D5: Xóa Tất Cả `dark:` Tailwind Classes

Sau khi semantic tokens có dark variants, `dark:bg-gray-900` trở thành dead code. Xóa hoàn toàn — không giữ lại.

**Lý do**: Hai hệ thống song song sẽ conflict. CSS `.dark` override wins, Tailwind `dark:` utilities adds confusion.

### D6: Status Color Pairs

Status tokens chỉ có single color hiện tại. Cần thêm `-bg` variant cho banner backgrounds:

```css
:root {
  --color-success:    #28A745;
  --color-success-bg: #F0FFF4;
  --color-error:      #DC3545;
  --color-error-bg:   #FFF5F5;
  --color-warning:    #FFB539;
  --color-warning-bg: #FFFBEB;
}

.dark {
  --color-success:    #4ADE80;
  --color-success-bg: #052e16;
  --color-error:      #F87171;
  --color-error-bg:   #450a0a;
  --color-warning:    #FBBF24;
  --color-warning-bg: #451a03;
}
```

`AlertBanner.vue` dùng `bg-[--color-warning-bg]` thay vì `bg-amber-50 dark:bg-amber-900/20`.

## Risks / Trade-offs

**[Risk] Nuxt UI internal CSS variables conflict với semantic tokens**
→ Mitigation: Nuxt UI dùng `--ui-*` prefix, không conflict. Test kỹ UButton, UInput, UCard sau migration.

**[Risk] `@nuxtjs/color-mode` chưa được install**
→ Mitigation: Kiểm tra package.json trước. Nếu chưa có, dùng `useColorMode()` từ `@vueuse/core` (đã có) + manual `<html class="dark">` toggle. Không cần install thêm package.

**[Risk] 40 page files cần bulk update — có thể bỏ sót**
→ Mitigation: Sau khi implement, chạy grep để verify không còn `dark:`, `bg-gray-`, `text-gray-` nào sót.

**[Risk] `text-[--color-title]` syntax (đang dùng) vs `text-title` (mới)**
→ Mitigation: Cả hai syntax đều work với Tailwind v4 `@theme`. Chuẩn hóa sang `text-title`, `text-body`, `bg-bg-page`... trong migration. Tuy nhiên semantic tokens mới (`bg-page`, `bg-surface`) cần dùng bracket syntax `bg-[--color-bg-page]` cho đến khi Tailwind v4 expose chúng qua `@theme` mapping.

## Migration Plan

1. **Rewrite CSS first** — không break gì cho đến bước 2
2. **Layout shells** — high impact, ít file, test ngay sau
3. **Navigation components** — sidebar visual đổi rõ ràng nhất
4. **UI primitives** — affects toàn app khi done
5. **Pages bulk** — mechanical find-replace, verify bằng grep
6. **Add dark mode toggle** — test đầy đủ cả 2 modes

**Rollback**: Git revert từng phase nếu cần. Không có DB/API changes nên rollback an toàn.

## Open Questions

- `@nuxtjs/color-mode` vs manual `useColorMode` from VueUse — cần kiểm tra package.json
- Landing page layout file tồn tại chưa? (chỉ thấy `default.vue`) — cần xác nhận trước Phase 6
