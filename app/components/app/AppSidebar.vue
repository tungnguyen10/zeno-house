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

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}

function navItemClass(to: string) {
  return clsx(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive(to)
      ? 'bg-cyan/10 text-cyan'
      : 'text-muted hover:bg-dark-hover hover:text-white',
  )
}
</script>

<template>
  <aside class="flex w-64 shrink-0 flex-col bg-dark-card border-r border-dark-border h-full">
    <!-- Logo -->
    <div class="flex h-16 items-center gap-2 px-5 border-b border-dark-border">
      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan">
        <span class="text-sm font-bold text-dark-deep">Z</span>
      </div>
      <span class="text-base font-semibold text-white">Zeno House</span>
      <!-- Close button on mobile -->
      <button
        type="button"
        class="ml-auto rounded-md p-1 text-muted hover:text-white lg:hidden"
        aria-label="Đóng sidebar"
        @click="emit('close')"
      >
        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
      <ul class="space-y-1" role="list">
        <li v-for="item in navItems" :key="item.key">
          <NuxtLink
            :to="item.to"
            :class="navItemClass(item.to)"
            @click="emit('close')"
          >
            <span class="shrink-0 w-5 h-5 text-current" aria-hidden="true">
              <!-- Icon placeholder — replaced by nuxt-svgo when SVGs are added -->
              <svg viewBox="0 0 20 20" fill="currentColor">
                <circle cx="10" cy="10" r="3" />
              </svg>
            </span>
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
