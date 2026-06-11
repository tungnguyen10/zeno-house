---
applyTo: "app/**/*.vue, app/**/*.ts"
---

# Images và Icons

Icons dùng nuxt-svgo (auto-import). Images static để trong `/public/`. Font Inter tự host.

## Icons (nuxt-svgo)

Đặt file `.svg` vào `app/assets/icons/`. Module tự động import với prefix `Icon`.

> **Ưu tiên**: Luôn tra bảng inventory bên dưới trước. Chỉ tạo SVG mới khi icon cần dùng **không có** trong danh sách.

**Quy tắc đặt tên file SVG:** `kebab-case.svg` → `<IconPascalCase />`

### Icon inventory (app/assets/icons/)

| Component | File | Gợi ý dùng cho |
|---|---|---|
| `<IconAlertCircle />` | `alert-circle.svg` | Alert, thông báo lỗi |
| `<IconArrowLeft />` | `arrow-left.svg` | Quay lại |
| `<IconArrowRight />` | `arrow-right.svg` | Tiếp theo |
| `<IconArrowUpRight />` | `arrow-up-right.svg` | Liên kết ngoài |
| `<IconArrowUp />` | `arrow-up.svg` | Cuộn lên, xu hướng tăng |
| `<IconBrandDeco />` | `brand-deco.svg` | Brand decoration |
| `<IconBrand />` | `brand.svg` | Logo variant |
| `<IconBriefcase />` | `briefcase.svg` | Tòa nhà / khu trọ |
| `<IconChart />` | `chart.svg` | Dashboard, thống kê |
| `<IconCheckCircle />` | `check-circle.svg` | Thành công, đã xong |
| `<IconCheckSmall />` | `check-small.svg` | Checkmark nhỏ |
| `<IconChevronDown />` | `chevron-down.svg` | Dropdown, mở rộng |
| `<IconChevronLeft />` | `chevron-left.svg` | Trước |
| `<IconChevronRight />` | `chevron-right.svg` | Sau, breadcrumb |
| `<IconClock />` | `clock.svg` | Thời gian, hết hạn |
| `<IconCloud />` | `cloud.svg` | Cloud |
| `<IconCode />` | `code.svg` | Developer |
| `<IconCpu />` | `cpu.svg` | Hệ thống, infra |
| `<IconDatabase />` | `database.svg` | Database |
| `<IconDocumentText />` | `document-text.svg` | Hợp đồng, tài liệu có nội dung |
| `<IconDocument />` | `document.svg` | File, tài liệu |
| `<IconExclamationCircle />` | `exclamation-circle.svg` | Cảnh báo |
| `<IconEyeOff />` | `eye-off.svg` | Ẩn mật khẩu |
| `<IconEye />` | `eye.svg` | Hiện mật khẩu, xem |
| `<IconFacebook />` | `facebook.svg` | Facebook |
| `<IconGlobe />` | `globe.svg` | Website, quốc tế |
| `<IconGuide />` | `guide.svg` | Hướng dẫn, help |
| `<IconHeadphone />` | `headphone.svg` | Hỗ trợ, audio |
| `<IconInfoCircle />` | `info-circle.svg` | Tooltip thông tin |
| `<IconLayers />` | `layers.svg` | Phòng, tầng lớp |
| `<IconLink />` | `link.svg` | Liên kết, URL |
| `<IconLinkedin />` | `linkedin.svg` | LinkedIn |
| `<IconLock />` | `lock.svg` | Bảo mật, khóa |
| `<IconLogo />` | `logo.svg` | Logo ứng dụng |
| `<IconMail />` | `mail.svg` | Email |
| `<IconMapDir />` | `map-dir.svg` | Chỉ đường |
| `<IconMapPin />` | `map-pin.svg` | Địa chỉ, vị trí |
| `<IconMenu />` | `menu.svg` | Hamburger menu |
| `<IconMessageCircle />` | `message-circle.svg` | Chat, tin nhắn |
| `<IconNav />` | `nav.svg` | Navigation |
| `<IconPencilSquare />` | `pencil-square.svg` | Chỉnh sửa |
| `<IconPhone />` | `phone.svg` | Điện thoại |
| `<IconPhoto />` | `photo.svg` | Ảnh, gallery |
| `<IconPlay />` | `play.svg` | Phát, video |
| `<IconPlus />` | `plus.svg` | Thêm mới, tạo |
| `<IconRefresh />` | `refresh.svg` | Làm mới, reload |
| `<IconSearch />` | `search.svg` | Tìm kiếm |
| `<IconSend />` | `send.svg` | Gửi, submit |
| `<IconServer />` | `server.svg` | Server, hosting |
| `<IconSettings />` | `settings.svg` | Cài đặt |
| `<IconShield />` | `shield.svg` | Bảo mật, quyền hạn |
| `<IconSpinner />` | `spinner.svg` | Loading |
| `<IconStar />` | `star.svg` | Đánh giá, yêu thích |
| `<IconTag />` | `tag.svg` | Nhãn, tag |
| `<IconTrash />` | `trash.svg` | Xóa |
| `<IconTwitterX />` | `twitter-x.svg` | Twitter / X |
| `<IconUsers />` | `users.svg` | Khách thuê, nhóm người |
| `<IconXCircle />` | `x-circle.svg` | Xóa, lỗi |
| `<IconX />` | `x.svg` | Đóng, dismiss |
| `<IconYoutube />` | `youtube.svg` | YouTube |
| `<IconZalo />` | `zalo.svg` | Zalo |

**Domain mapping gợi ý:**
- Dashboard → `<IconChart />`
- Tòa nhà (Buildings) → `<IconBriefcase />`
- Phòng (Rooms) → `<IconLayers />`
- Khách thuê (Tenants) → `<IconUsers />`
- Hợp đồng (Contracts) → `<IconDocumentText />`
- Cài đặt → `<IconSettings />`

### Thêm icon mới (chỉ khi không có trong danh sách)

1. Tra bảng trên — nếu có icon gần đúng, **dùng luôn**
2. Nếu thực sự không có: đặt file `kebab-case.svg` vào `app/assets/icons/`
3. SVG phải dùng `currentColor` để Tailwind text color hoạt động:

```svg
<!-- ✅ SVG chuẩn -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="..." />
</svg>

<!-- ❌ Hardcode màu — Tailwind class không override được -->
<svg><path fill="#374151" d="..." /></svg>
```

## ✓ Cách dùng đúng

**Icon trong template:**
```vue
<!-- Tòa nhà -->
<IconBriefcase class="w-5 h-5 text-body" />

<!-- Phòng -->
<IconLayers class="w-4 h-4 text-body" />

<!-- Icon trong navigation item -->
<component :is="navItem.icon" class="w-5 h-5 shrink-0" />
```

**Icon với accessibility:**
```vue
<!-- Icon chỉ trang trí — ẩn với screen reader -->
<IconBriefcase class="w-5 h-5" aria-hidden="true" />

<!-- Icon có nghĩa — cần label -->
<button aria-label="Xóa tòa nhà">
  <IconTrash class="w-4 h-4" aria-hidden="true" />
</button>
```

**Dynamic icon qua component:**
```vue
<!-- app/components/app/AppNavItem.vue -->
<script setup lang="ts">
import type { Component } from 'vue'

const props = defineProps<{
  label: string
  to: string
  icon: Component  // truyền vào: IconBuilding, IconHome, ...
}>()
</script>

<template>
  <NuxtLink :to="to" class="flex items-center gap-3 px-3 py-2">
    <component :is="icon" class="w-5 h-5 shrink-0" aria-hidden="true" />
    <span>{{ label }}</span>
  </NuxtLink>
</template>
```

**Static image trong `/public/`:**
```vue
<img src="/images/logo.png" alt="Zeno House" class="h-8 w-auto" />
<img src="/images/empty-buildings.svg" alt="" aria-hidden="true" class="w-32 h-32 mx-auto" />
```

**Font — đã configured sẵn trong main.scss:**
```vue
<!-- Không cần làm gì thêm. Inter tự load qua @font-face trong main.scss -->
<!-- Tailwind font-sans tự dùng Inter -->
<p class="font-sans text-sm text-body">Nội dung</p>
```

## ✗ Cách không được dùng

```vue
<!-- ✗ Đừng dùng <img> cho icon — dùng nuxt-svgo component -->
<img src="/icons/building.svg" class="w-5 h-5" />

<!-- ✗ Đừng import SVG thủ công — module đã auto-import -->
<script setup>
import BuildingIcon from '~/assets/icons/building.svg'  // không cần
</script>

<!-- ✗ Đừng đặt ảnh lớn trong app/assets/ — để trong /public/ -->
<!-- app/assets/images/banner.jpg ← sai, dùng /public/images/banner.jpg -->

<!-- ✗ Đừng load Google Fonts từ CDN — font đã self-host -->
<!-- <link href="https://fonts.googleapis.com/css2?family=Inter..." /> -->

<!-- ✗ Đừng bỏ qua alt text cho ảnh có nghĩa -->
<img src="/images/empty.svg" />  <!-- thiếu alt -->

<!-- ✗ Đừng hardcode kích thước bằng width/height attribute khi có Tailwind -->
<IconBuilding width="20" height="20" />  <!-- dùng class="w-5 h-5" -->
```

## Config nuxt-svgo (đã có trong nuxt.config.ts)

```ts
// nuxt.config.ts — đã configured, không sửa nếu không cần
svgo: {
  autoImportPath: './assets/icons/',
  defaultImport: 'component',
  componentPrefix: 'Icon',
}
```
