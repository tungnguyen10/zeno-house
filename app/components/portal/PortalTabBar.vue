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
          class="flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 pb-2 pt-3 text-[12px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme/40 motion-reduce:transition-none"
          :class="isActive(tab) ? 'text-theme' : 'text-muted'"
          :aria-current="isActive(tab) ? 'page' : undefined"
        >
          <span class="relative flex h-9 w-[56px] items-center justify-center">
            <span
              :data-active-indicator="isActive(tab) ? '' : undefined"
              class="absolute inset-0 rounded-full transition-colors duration-200 motion-reduce:transition-none"
              :class="isActive(tab) ? 'bg-smoke-blue' : 'bg-transparent'"
              aria-hidden="true"
            />
            <component
              :is="tab.icon"
              class="relative h-6 w-6"
              aria-hidden="true"
            />
          </span>
          <span class="whitespace-nowrap" :class="isActive(tab) ? 'font-semibold' : 'font-medium'">{{ tab.label }}</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
