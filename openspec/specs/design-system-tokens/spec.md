## Purpose

Defines the unified color token system for the entire application. Uses a 3-layer architecture: palette (raw values in `@theme`), semantic light (default via `@theme`), and semantic dark (`.dark` class override). All components reference semantic tokens only — never raw Tailwind colors or hex values.

## Requirements

### Requirement: Token system sử dụng 3-layer architecture
`app/assets/css/main.css` SHALL định nghĩa màu sắc theo 3 layer tách biệt: (1) Palette layer trong `@theme` — raw color values, bất biến; (2) Semantic light layer trong `@theme` — ánh xạ palette sang ngữ nghĩa (Tailwind v4 tự expose ra `:root`); (3) Semantic dark layer trong `.dark` — override semantic layer cho dark mode. Components MUST chỉ tham chiếu semantic tokens, không dùng palette tokens trực tiếp.

#### Scenario: Palette tokens không được dùng trực tiếp trong components
- **WHEN** developer viết class cho một component
- **THEN** class phải dùng semantic token (`bg-[--color-bg-page]`, `text-[--color-title]`) hoặc dark zone token (`bg-dark-nav`), không phải raw color (`#0B1422`, `bg-gray-50`)

#### Scenario: Dark mode đổi màu bằng CSS, không bằng Tailwind dark: classes
- **WHEN** `.dark` class được add vào `<html>`
- **THEN** toàn bộ semantic tokens override sang dark values mà không cần bất kỳ `dark:` Tailwind class nào trong markup

### Requirement: Bảng palette tokens đầy đủ
`main.css` SHALL định nghĩa các palette tokens sau trong `@theme`:

**Brand (không đổi theo mode):**
- `--color-theme: #0B59DB` — primary blue, CTA và active state
- `--color-theme-purple: #6653E8` — purple accent, secondary badge
- `--color-brand: #79F4E4` — teal accent, marketing và logo gradient

**Dark zones (structural, không đổi theo mode):**
- `--color-dark-nav: #001C49` — sidebar navigation
- `--color-dark: #1A1B1D` — footer background
- `--color-dark-card: #242528` — card trong dark section
- `--color-dark-deep: #0a0f1e` — landing page hero background

#### Scenario: Brand tokens không thay đổi khi toggle dark mode
- **WHEN** user toggle sang dark mode
- **THEN** `--color-theme`, `--color-theme-purple`, `--color-brand` giữ nguyên giá trị

#### Scenario: Dark zone tokens không thay đổi khi toggle dark mode
- **WHEN** user toggle sang dark mode
- **THEN** sidebar vẫn hiển thị màu `#001C49`

### Requirement: Bảng semantic tokens với light và dark variants
`main.css` SHALL định nghĩa các semantic tokens sau:

**Semantic light (`@theme` defaults):**
- `--color-title: #0B1422` — heading, label text
- `--color-body: #6E7070` — body text, description
- `--color-bg-page: #F2F5FA` — page root background
- `--color-bg-surface: #FFFFFF` — card, modal, dropdown surface
- `--color-bg-muted: #F4F6F8` — subtle section, table row
- `--color-bg-accent: #EEF1FF` — blue-tinted section
- `--color-border: #D5D7DA` — input border, divider, table line
- `--color-border-light: #E1E4E5` — subtle separator
- `--color-success: #28A745`, `--color-success-bg: #F0FFF4`
- `--color-error: #DC3545`, `--color-error-bg: #FFF5F5`
- `--color-warning: #FFB539`, `--color-warning-bg: #FFFBEB`

**Semantic dark (`.dark` override):**
- `--color-title: #F2F5FA`
- `--color-body: #8B9099`
- `--color-bg-page: #0a0f1e`
- `--color-bg-surface: #1A1B1D`
- `--color-bg-muted: #242528`
- `--color-bg-accent: #1a1f3a`
- `--color-border: #2D3748`
- `--color-border-light: #1F2937`
- `--color-success: #4ADE80`, `--color-success-bg: #052e16`
- `--color-error: #F87171`, `--color-error-bg: #450a0a`
- `--color-warning: #FBBF24`, `--color-warning-bg: #451a03`

#### Scenario: Text màu đổi khi dark mode
- **WHEN** `.dark` được add vào `<html>`
- **THEN** element với `text-[--color-title]` hiển thị `#F2F5FA` thay vì `#0B1422`

#### Scenario: Background đổi khi dark mode
- **WHEN** `.dark` được add vào `<html>`
- **THEN** element với `bg-[--color-bg-page]` hiển thị `#0a0f1e` thay vì `#F2F5FA`

#### Scenario: Status background đổi khi dark mode
- **WHEN** `.dark` được add vào `<html>` và có AlertBanner với variant="warning"
- **THEN** banner hiển thị `--color-warning-bg` dark value (`#451a03`) với text `--color-warning` dark value (`#FBBF24`)

### Requirement: Dark mode toggle trong Header
Header SHALL có button để toggle dark mode. State được persist trong localStorage. Toggle MUST dùng `.dark` class trên `<html>` element thông qua `useColorMode()` từ `@nuxtjs/color-mode`.

#### Scenario: User toggle dark mode
- **WHEN** user click dark mode toggle button trong header
- **THEN** `<html>` element nhận/xóa class `dark` và theme thay đổi ngay lập tức

#### Scenario: Dark mode preference được nhớ
- **WHEN** user đã chọn dark mode và reload trang
- **THEN** dark mode vẫn active (preference được restore từ localStorage)

### Requirement: Codebase không còn raw Tailwind color classes
Toàn bộ Vue components và layouts SHALL không chứa các class sau: `bg-gray-*`, `text-gray-*`, `border-gray-*`, `dark:bg-*`, `dark:text-*`, `dark:border-*`. `bg-white` chỉ được phép trong dark zones (e.g. alpha overlays `bg-white/15`).

#### Scenario: Grep verify không còn dark: classes
- **WHEN** chạy `grep -rn "dark:" app/ --include="*.vue"`
- **THEN** output rỗng (0 kết quả)

#### Scenario: Grep verify không còn raw gray classes
- **WHEN** chạy `grep -rn "bg-gray\|text-gray\|border-gray" app/ --include="*.vue"`
- **THEN** output rỗng (0 kết quả)
