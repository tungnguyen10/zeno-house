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
const appStore = useAppStore()
const { sidebarCollapsed } = storeToRefs(appStore)

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

const asideClass = computed(() =>
  clsx(
    'flex shrink-0 flex-col bg-dark-card border-r border-dark-border h-full',
    'transition-[width] duration-200',
    // Mobile drawer is always full width; only the desktop rail collapses.
    'w-64',
    sidebarCollapsed.value ? 'lg:w-16' : 'lg:w-64',
  ),
)

const headerClass = computed(() =>
  clsx(
    'group flex h-16 items-center gap-2 border-b border-dark-border',
    sidebarCollapsed.value ? 'px-5 lg:px-0' : 'px-5',
  ),
)

const logoLinkClass = computed(() =>
  clsx('flex items-center', sidebarCollapsed.value && 'lg:hidden'),
)

// Mini logo shows in the collapsed rail; hidden on hover so the toggle takes its place.
const miniLogoClass = computed(() =>
  clsx(
    'hidden',
    sidebarCollapsed.value && 'lg:flex lg:mx-auto lg:group-hover:hidden',
  ),
)

const collapseBtnClass = computed(() =>
  clsx(
    'hidden',
    sidebarCollapsed.value
      ? 'lg:mx-auto lg:group-hover:flex'
      : 'lg:flex lg:ml-auto',
  ),
)

function navItemClass(to: string) {
  return clsx(
    'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
    sidebarCollapsed.value && 'lg:justify-center lg:gap-0 lg:px-0',
    isActive(to)
      ? 'bg-cyan/10 text-cyan'
      : 'text-muted hover:bg-dark-hover hover:text-white',
  )
}

function labelClass() {
  return clsx('truncate', sidebarCollapsed.value && 'lg:hidden')
}
</script>

<template>
  <aside :class="asideClass">
    <!-- Logo -->
    <div :class="headerClass">
      <NuxtLink to="/" :class="logoLinkClass" aria-label="Zeno House — Trang chủ">
        <IconLogo class="h-7 w-auto text-white" aria-hidden="true" />
      </NuxtLink>

      <!-- Mini logo — desktop rail (hover swaps to the toggle) -->
      <NuxtLink to="/" :class="miniLogoClass" aria-label="Zeno House — Trang chủ">
        <IconLogoMini class="h-6 w-auto text-cyan" aria-hidden="true" />
      </NuxtLink>

      <!-- Collapse toggle — desktop only -->
      <UiButton
        variant="ghost"
        icon-only
        :class="collapseBtnClass"
        :aria-label="sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'"
        :aria-pressed="sidebarCollapsed"
        @click="appStore.toggleCollapsed()"
      >
        <IconPanelLeft class="h-5 w-5" aria-hidden="true" />
      </UiButton>

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
            :title="sidebarCollapsed ? item.label : undefined"
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
            <span :class="labelClass()">{{ item.label }}</span>
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <!-- User info -->
    <div class="border-t border-dark-border px-3 py-4">
      <div
        class="flex items-center gap-3 rounded-lg px-3 py-2"
        :class="sidebarCollapsed && 'lg:justify-center lg:px-0'"
      >
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan/20" aria-hidden="true">
          <span class="text-xs font-semibold text-cyan">{{ userInitial }}</span>
        </div>
        <div class="min-w-0 flex-1" :class="sidebarCollapsed && 'lg:hidden'">
          <p class="truncate text-sm font-medium text-white">{{ authStore.user?.email }}</p>
          <p class="truncate text-xs text-muted">{{ authStore.role ?? 'user' }}</p>
        </div>
      </div>
    </div>
  </aside>
</template>
