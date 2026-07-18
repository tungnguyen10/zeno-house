<script setup lang="ts">
import { PORTAL_NAV_ITEMS, type PortalNavItem, isPortalNavActive } from '~/utils/constants/portal-nav'

const tabs = PORTAL_NAV_ITEMS

const route = useRoute()

function isActive(tab: PortalNavItem): boolean {
  return isPortalNavActive(tab, route.path)
}
</script>

<template>
  <nav
    class="portal-safe-bottom portal-safe-x z-30 shrink-0 border-t border-border-light bg-white lg:hidden"
    aria-label="Điều hướng chính"
  >
    <ul class="flex items-stretch">
      <li v-for="tab in tabs" :key="tab.key" class="flex-1">
        <NuxtLink
          :to="tab.to"
          class="relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme/40"
          :class="isActive(tab) ? 'text-theme' : 'text-body'"
          :aria-current="isActive(tab) ? 'page' : undefined"
        >
          <span
            :data-active-indicator="isActive(tab) ? '' : undefined"
            class="flex h-7 min-w-10 items-center justify-center rounded-full transition-colors"
            :class="isActive(tab) ? 'bg-smoke-blue' : 'bg-transparent'"
            aria-hidden="true"
          >
            <component :is="tab.icon" class="h-5 w-5" />
          </span>
          <span class="whitespace-nowrap">{{ tab.label }}</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
