<script setup lang="ts">
interface PortalTab {
  key: string
  label: string
  to: string
  icon: string
  exact?: boolean
}

const tabs: PortalTab[] = [
  { key: 'home', label: 'Trang chủ', to: '/portal', icon: 'IconHome', exact: true },
  { key: 'invoices', label: 'Hoá đơn', to: '/portal/invoices', icon: 'IconReceipt' },
  { key: 'room', label: 'Phòng', to: '/portal/room', icon: 'IconDoor' },
  { key: 'requests', label: 'Yêu cầu', to: '/portal/requests', icon: 'IconMessageCircle' },
  { key: 'account', label: 'Tài khoản', to: '/portal/profile', icon: 'IconUser' },
]

const route = useRoute()

function isActive(tab: PortalTab): boolean {
  if (tab.exact) return route.path === tab.to
  return route.path === tab.to || route.path.startsWith(`${tab.to}/`)
}
</script>

<template>
  <nav
    class="portal-safe-bottom portal-safe-x z-30 shrink-0 border-t border-border-light bg-white"
    aria-label="Điều hướng chính"
  >
    <ul class="flex items-stretch">
      <li v-for="tab in tabs" :key="tab.key" class="flex-1">
        <NuxtLink
          :to="tab.to"
          class="relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors"
          :class="isActive(tab) ? 'text-theme' : 'text-body'"
          :aria-current="isActive(tab) ? 'page' : undefined"
        >
          <span
            v-if="isActive(tab)"
            class="absolute top-0 h-0.5 w-8 rounded-full bg-theme"
            aria-hidden="true"
          />
          <component :is="tab.icon" class="h-6 w-6" aria-hidden="true" />
          <span>{{ tab.label }}</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
