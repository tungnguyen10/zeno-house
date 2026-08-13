<script setup lang="ts">
import { isNavItemVisible, NAV_SETTINGS_ITEMS } from '~/utils/constants/navigation'

const route = useRoute()
const authStore = useAuthStore()

const items = computed(() => NAV_SETTINGS_ITEMS.filter(item => isNavItemVisible(item, {
  isAdmin: authStore.isAdmin,
  role: authStore.role,
})))

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <nav
    v-if="items.length > 1"
    class="mb-6 flex items-center gap-1 overflow-x-auto border-b border-ui-border no-scrollbar"
    aria-label="Điều hướng quản trị"
  >
    <NuxtLink
      v-for="item in items"
      :key="item.key"
      :to="item.to"
      class="relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40"
      :class="isActive(item.to) ? 'text-ui-accent' : 'text-ui-muted hover:text-ui-primary'"
      :aria-current="isActive(item.to) ? 'page' : undefined"
    >
      {{ item.label }}
      <span
        v-if="isActive(item.to)"
        class="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-ui-accent"
        aria-hidden="true"
      />
    </NuxtLink>
  </nav>
</template>
