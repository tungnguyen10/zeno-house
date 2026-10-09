<script setup lang="ts">
import { getMobileTabItems } from '~/utils/constants/navigation'

const route = useRoute()
const authStore = useAuthStore()
const moreOpen = ref(false)
const formMode = useAppFormMode()

const tabs = computed(() => getMobileTabItems({ isAdmin: authStore.isAdmin, role: authStore.role }))

function isActive(to: string) {
  if (to === '/dashboard') return route.path === to
  return route.path === to || route.path.startsWith(`${to}/`)
}

// Inactive tabs collapse to an icon-only square; the active tab expands to
// show its label — avoids long labels ("Vận hành tháng") cramming 5 columns.
function tabLinkClass(active: boolean) {
  return [
    'flex h-12 items-center justify-center gap-1.5 rounded-xl',
    'text-[12px] font-medium transition-colors duration-150 motion-reduce:transition-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ui-accent/40',
    active
      ? 'bg-ui-accent/10 px-3.5 text-ui-accent'
      : 'w-12 text-ui-muted hover:bg-ui-hover hover:text-ui-primary',
  ]
}
</script>

<template>
  <nav
    class="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-[calc(0.75rem+env(safe-area-inset-left))] right-[calc(0.75rem+env(safe-area-inset-right))] z-30 rounded-2xl border border-ui-border bg-ui-chrome/95 shadow-lg shadow-ui-shadow/10 backdrop-blur-md lg:hidden"
    :class="formMode && 'max-sm:hidden'"
    aria-label="Điều hướng chính"
  >
    <ul class="mx-auto flex max-w-md items-center justify-between gap-1 px-1.5 py-1.5">
      <li v-for="tab in tabs" :key="tab.key" class="flex justify-center">
        <NuxtLink
          :to="tab.to"
          :class="tabLinkClass(isActive(tab.activeMatch ?? tab.to))"
          :aria-current="isActive(tab.activeMatch ?? tab.to) ? 'page' : undefined"
          :aria-label="tab.label"
        >
          <component :is="tab.icon" class="h-5 w-5 shrink-0" aria-hidden="true" />
          <span v-if="isActive(tab.activeMatch ?? tab.to)" class="whitespace-nowrap">{{ tab.label }}</span>
        </NuxtLink>
      </li>
      <li class="flex justify-center">
        <button
          type="button"
          :class="tabLinkClass(moreOpen)"
          :aria-expanded="moreOpen"
          aria-label="Thêm"
          @click="moreOpen = true"
        >
          <IconMoreVertical class="h-5 w-5 shrink-0" aria-hidden="true" />
          <span v-if="moreOpen" class="whitespace-nowrap">Thêm</span>
        </button>
      </li>
    </ul>
  </nav>

  <AppMoreSheet v-model="moreOpen" />
</template>
