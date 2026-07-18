---
applyTo: "app/app.vue, app/layouts/**/*.vue, app/pages/**/*.vue, app/components/**/*.vue"
---

# Images and Icons

Icons use nuxt-svgo (auto-import). Static images go under `/public/`. Font Inter is self-hosted.

## Icons (nuxt-svgo)

Place `.svg` files in `app/assets/icons/`. The module auto-imports them with the `Icon` prefix.

> **Priority**: Always check the inventory table below first. Only create a new SVG when the icon you need is **not** in the list.

**SVG file naming rule:** `kebab-case.svg` → `<IconPascalCase />`

### Icon inventory (app/assets/icons/)

| Component | File | Suggested use |
|---|---|---|
| `<IconAlertCircle />` | `alert-circle.svg` | Alert, error notification |
| `<IconArrowLeft />` | `arrow-left.svg` | Go back |
| `<IconArrowRight />` | `arrow-right.svg` | Next |
| `<IconArrowUpRight />` | `arrow-up-right.svg` | External link |
| `<IconArrowUp />` | `arrow-up.svg` | Scroll up, upward trend |
| `<IconBrandDeco />` | `brand-deco.svg` | Brand decoration |
| `<IconBrand />` | `brand.svg` | Logo variant |
| `<IconBriefcase />` | `briefcase.svg` | Building / rental property |
| `<IconChart />` | `chart.svg` | Dashboard, statistics |
| `<IconCheckCircle />` | `check-circle.svg` | Success, completed |
| `<IconCheckSmall />` | `check-small.svg` | Small checkmark |
| `<IconChevronDown />` | `chevron-down.svg` | Dropdown, expand |
| `<IconChevronLeft />` | `chevron-left.svg` | Previous |
| `<IconChevronRight />` | `chevron-right.svg` | Next, breadcrumb |
| `<IconClock />` | `clock.svg` | Time, expiry |
| `<IconCloud />` | `cloud.svg` | Cloud |
| `<IconCode />` | `code.svg` | Developer |
| `<IconCpu />` | `cpu.svg` | System, infra |
| `<IconDatabase />` | `database.svg` | Database |
| `<IconDocumentText />` | `document-text.svg` | Contract, document with content |
| `<IconDocument />` | `document.svg` | File, document |
| `<IconDownload />` | `download.svg` | Download, export file |
| `<IconExclamationCircle />` | `exclamation-circle.svg` | Warning |
| `<IconEyeOff />` | `eye-off.svg` | Hide password |
| `<IconEye />` | `eye.svg` | Show password, view |
| `<IconFacebook />` | `facebook.svg` | Facebook |
| `<IconGlobe />` | `globe.svg` | Website, international |
| `<IconGuide />` | `guide.svg` | Guide, help |
| `<IconHeadphone />` | `headphone.svg` | Support, audio |
| `<IconInfoCircle />` | `info-circle.svg` | Info tooltip |
| `<IconLayers />` | `layers.svg` | Room, floor layer |
| `<IconLink />` | `link.svg` | Link, URL |
| `<IconLinkedin />` | `linkedin.svg` | LinkedIn |
| `<IconLock />` | `lock.svg` | Security, lock |
| `<IconLogo />` | `logo.svg` | App logo |
| `<IconMail />` | `mail.svg` | Email |
| `<IconMapDir />` | `map-dir.svg` | Directions |
| `<IconMapPin />` | `map-pin.svg` | Address, location |
| `<IconMenu />` | `menu.svg` | Hamburger menu |
| `<IconMessageCircle />` | `message-circle.svg` | Chat, message |
| `<IconMoreVertical />` | `more-vertical.svg` | Overflow / kebab action menu |
| `<IconNav />` | `nav.svg` | Navigation |
| `<IconPencilSquare />` | `pencil-square.svg` | Edit |
| `<IconPhone />` | `phone.svg` | Phone |
| `<IconPhoto />` | `photo.svg` | Image, gallery |
| `<IconPlay />` | `play.svg` | Play, video |
| `<IconPlus />` | `plus.svg` | Add, create |
| `<IconRefresh />` | `refresh.svg` | Refresh, reload |
| `<IconSearch />` | `search.svg` | Search |
| `<IconSend />` | `send.svg` | Send, submit |
| `<IconServer />` | `server.svg` | Server, hosting |
| `<IconSettings />` | `settings.svg` | Settings |
| `<IconShield />` | `shield.svg` | Security, permissions |
| `<IconSpinner />` | `spinner.svg` | Loading |
| `<IconStar />` | `star.svg` | Rating, favourite |
| `<IconTag />` | `tag.svg` | Label, tag |
| `<IconTrash />` | `trash.svg` | Delete |
| `<IconTwitterX />` | `twitter-x.svg` | Twitter / X |
| `<IconUsers />` | `users.svg` | Tenants, group of people |
| `<IconXCircle />` | `x-circle.svg` | Remove, error |
| `<IconX />` | `x.svg` | Close, dismiss |
| `<IconYoutube />` | `youtube.svg` | YouTube |
| `<IconZalo />` | `zalo.svg` | Zalo |

**Suggested domain mapping:**
- Dashboard → `<IconChart />`
- Buildings → `<IconBriefcase />`
- Rooms → `<IconLayers />`
- Tenants → `<IconUsers />`
- Contracts → `<IconDocumentText />`
- Settings → `<IconSettings />`

### Adding a new icon (only when not in the list)

1. Check the table above — if a close enough icon exists, **use it**
2. If truly missing: place a `kebab-case.svg` file in `app/assets/icons/`
3. SVG must use `currentColor` so Tailwind text color works:

```svg
<!-- ✅ SVG chuẩn -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="..." />
</svg>

<!-- ❌ Hardcode màu — Tailwind class không override được -->
<svg><path fill="#374151" d="..." /></svg>
```

## ✓ Correct Usage

**Icon trong template:**
```vue
<!-- Tòa nhà -->
<IconBriefcase class="w-5 h-5 text-muted" />

<!-- Phòng -->
<IconLayers class="w-4 h-4 text-muted" />

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
<p class="font-sans text-sm text-muted">Nội dung</p>
```

## ✗ Do Not

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

## nuxt-svgo Config (already in nuxt.config.ts)

```ts
// nuxt.config.ts — đã configured, không sửa nếu không cần
svgo: {
  autoImportPath: './assets/icons/',
  defaultImport: 'component',
  componentPrefix: 'Icon',
}
```
