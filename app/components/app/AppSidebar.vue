<script setup lang="ts">
import clsx from 'clsx'
import { NAV_ITEMS } from '~/utils/constants/navigation'
import type { NavItem } from '~/utils/constants/navigation'

const _props = withDefaults(defineProps<{
  navItems?: NavItem[]
}>(), {
  navItems: () => NAV_ITEMS,
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const route = useRoute()
const authStore = useAuthStore()

const userInitial = computed(() => {
  const email = authStore.user?.email ?? ''
  return email.charAt(0).toUpperCase() || 'U'
})

const visibleNavItems = computed(() =>
  _props.navItems.filter(item => !item.adminOnly || authStore.isAdmin),
)

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}

function navItemClass(to: string) {
  return clsx(
    'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
    isActive(to)
      ? 'bg-cyan/10 text-cyan'
      : 'text-muted hover:bg-dark-hover hover:text-white',
  )
}
</script>

<template>
  <aside class="flex w-64 shrink-0 flex-col bg-dark-card border-r border-dark-border h-full">
    <!-- Logo -->
    <div class="flex h-16 items-center px-5 border-b border-dark-border">
      <NuxtLink to="/" class="flex items-center" aria-label="Zeno House — Trang chủ">
        <IconLogo class="h-7 w-auto text-white" aria-hidden="true" />
      </NuxtLink>
      <!-- Close button on mobile -->
      <UiButton
        variant="ghost"
        icon-only
        class="ml-auto lg:hidden"
        aria-label="Đóng sidebar"
        @click="emit('close')"
      >
        <IconX class="h-5 w-5" aria-hidden="true" />
      </UiButton>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
      <ul class="space-y-0.5" role="list">
        <li v-for="item in visibleNavItems" :key="item.key">
          <NuxtLink
            :to="item.to"
            :class="navItemClass(item.to)"
            @click="emit('close')"
          >
            <span
              v-if="isActive(item.to)"
              class="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-cyan"
              aria-hidden="true"
            />
            <component
              :is="item.icon"
              class="shrink-0 w-5 h-5 text-current"
              aria-hidden="true"
            />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <!-- User info -->
    <div class="border-t border-dark-border px-3 py-4">
      <div class="flex items-center gap-3 rounded-lg px-3 py-2">
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan/20" aria-hidden="true">
          <span class="text-xs font-semibold text-cyan">{{ userInitial }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-white">{{ authStore.user?.email }}</p>
          <p class="truncate text-xs text-muted">{{ authStore.role ?? 'user' }}</p>
        </div>
      </div>
    </div>
  </aside>
</template>
