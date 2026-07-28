<script setup lang="ts">
import { PORTAL_NAV_ITEMS, type PortalNavItem, isPortalNavActive } from '~/utils/constants/portal-nav'

const tabs = PORTAL_NAV_ITEMS

const tabIconComponents: Record<string, string> = {
  home: 'IconPortalTabHomeDark',
  invoices: 'IconPortalTabInvoicesDark',
  room: 'IconPortalTabRoomDark',
  requests: 'IconPortalTabRequestsDark',
  account: 'IconPortalTabAccountDark',
}

const route = useRoute()

function isActive(tab: PortalNavItem): boolean {
  return isPortalNavActive(tab, route.path)
}
</script>

<template>
  <nav
    class="portal-safe-bottom portal-safe-x z-30 shrink-0 rounded-t-[20px] border border-dark-border bg-dark-surface lg:hidden"
    aria-label="Điều hướng chính"
  >
    <ul class="flex items-stretch justify-center px-[10px] py-[15px]">
      <li v-for="tab in tabs" :key="tab.key" class="flex min-w-0 flex-1 justify-center">
        <NuxtLink
          :to="tab.to"
          class="flex min-h-[56px] w-full max-w-[70px] flex-col items-center justify-center gap-[5px] rounded-[10px] px-[5px] py-[5px] text-[12px] font-medium leading-normal text-[#c7c9ce] transition-colors duration-150 [@media(hover:hover)]:hover:bg-dark-hover active:bg-dark-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan/40 motion-reduce:transition-none"
          :class="isActive(tab) ? 'bg-dark-hover' : undefined"
          :aria-current="isActive(tab) ? 'page' : undefined"
        >
          <component
            :is="tabIconComponents[tab.key]"
            class="h-6 w-6 shrink-0"
            :class="isActive(tab) ? 'text-cyan' : 'text-muted'"
            aria-hidden="true"
          />
          <span class="whitespace-nowrap">{{ tab.label }}</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
